
-- ============================================================
-- Phase 2 Payroll Engine
-- ============================================================

-- 1. Extra profile columns (banking + house allowance)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS house_allowance numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Attendance blob on payroll_runs
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS attendance_json jsonb;

-- 3. Self-service profile protection trigger
-- Non-admin users editing their own row cannot change sensitive fields.
CREATE OR REPLACE FUNCTION public.protect_profile_self_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]);
  IF NOT is_admin AND auth.uid() = NEW.id THEN
    NEW.staff_id         := OLD.staff_id;
    NEW.full_name        := OLD.full_name;
    NEW.email            := OLD.email;
    NEW.basic_salary     := OLD.basic_salary;
    NEW.hr_status        := OLD.hr_status;
    NEW.employment_type  := OLD.employment_type;
    NEW.designation      := OLD.designation;
    NEW.date_joined      := OLD.date_joined;
    NEW.contract_end_date:= OLD.contract_end_date;
    NEW.house_allowance  := OLD.house_allowance;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_profile_self_edit ON public.profiles;
CREATE TRIGGER trg_protect_profile_self_edit
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_self_edit();

-- 4. Attendance derivation
CREATE OR REPLACE FUNCTION public.derive_attendance(_period_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD;
  d_start date;
  d_end date;
  emp RECORD;
  result jsonb := '[]'::jsonb;
  row_json jsonb;
  days_worked int; night_shifts int; ph_worked int; off_days int;
  paid_leave int; unpaid_leave int;
BEGIN
  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  d_start := make_date(p.period_year, p.period_month, 1);
  d_end   := (d_start + INTERVAL '1 month - 1 day')::date;

  FOR emp IN
    SELECT id, full_name, staff_id, basic_salary, kra_pin, hr_status
    FROM public.profiles WHERE hr_status = 'ACTIVE'
  LOOP
    -- Count shifts from PUBLISHED rota weeks that intersect the month
    SELECT
      COUNT(*) FILTER (WHERE ra.shift_code IN ('D','N')),
      COUNT(*) FILTER (WHERE ra.shift_code = 'N'),
      COUNT(*) FILTER (WHERE ra.shift_code = 'PH'),
      COUNT(*) FILTER (WHERE ra.shift_code = 'OFF')
    INTO days_worked, night_shifts, ph_worked, off_days
    FROM public.rota_assignments ra
    JOIN public.rota_weeks rw ON rw.id = ra.rota_week_id
    WHERE ra.employee_id = emp.id
      AND rw.status = 'published'
      AND (rw.week_start_date + ra.day_of_week) BETWEEN d_start AND d_end;

    -- Leave days (approved)
    SELECT
      COALESCE(SUM(CASE WHEN leave_type <> 'unpaid'
        THEN (LEAST(end_date, d_end) - GREATEST(start_date, d_start) + 1) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN leave_type = 'unpaid'
        THEN (LEAST(end_date, d_end) - GREATEST(start_date, d_start) + 1) ELSE 0 END),0)
    INTO paid_leave, unpaid_leave
    FROM public.leave_requests
    WHERE employee_id = emp.id AND status = 'approved'
      AND start_date <= d_end AND end_date >= d_start;

    row_json := jsonb_build_object(
      'employee_id', emp.id,
      'staff_id', emp.staff_id,
      'full_name', emp.full_name,
      'basic_salary', emp.basic_salary,
      'kra_pin', emp.kra_pin,
      'days_worked', COALESCE(days_worked,0),
      'night_shifts', COALESCE(night_shifts,0),
      'public_holidays_worked', COALESCE(ph_worked,0),
      'off_days', COALESCE(off_days,0),
      'paid_leave_days', COALESCE(paid_leave,0),
      'unpaid_leave_days', COALESCE(unpaid_leave,0)
    );
    result := result || row_json;
  END LOOP;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.derive_attendance(uuid) TO authenticated;

-- 5. Calculation engine
CREATE OR REPLACE FUNCTION public.calculate_payroll(_period_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD;
  attendance jsonb;
  emp jsonb;
  missing jsonb := '[]'::jsonb;

  -- Rates
  paye_bands jsonb;
  personal_relief numeric := 2400;
  nssf1_rate numeric := 0.06; nssf1_upper numeric := 8000;
  nssf2_rate numeric := 0.06; nssf2_lower numeric := 8000; nssf2_upper numeric := 72000;
  shif_rate numeric := 0.0275; shif_min numeric := 300;
  hl_emp numeric := 0.015; hl_er numeric := 0.015;

  -- Per employee
  emp_id uuid;
  basic numeric; house_allow numeric; daily_rate numeric;
  night_pct numeric := 0.15; ph_mult numeric := 2.0;
  night_al numeric; ph_al numeric; unpaid_ded numeric;
  gross numeric; nssf1 numeric; nssf2 numeric; nssf_total numeric;
  shif numeric; hl_e numeric; hl_r numeric;
  taxable numeric; paye numeric := 0; band jsonb; prev_cap numeric; cap numeric; rate numeric; slice numeric;
  net numeric; run_id uuid;
  total_runs int := 0;
BEGIN
  -- Auth: only ADMIN/SUPER_ADMIN can trigger calculation
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can run payroll calculation';
  END IF;

  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF p.status NOT IN ('ATTENDANCE_LOCKED','CALCULATED') THEN
    RAISE EXCEPTION 'Period must be ATTENDANCE_LOCKED before calculation';
  END IF;

  -- Load latest active rates (by rate_type, most recent effective_from)
  SELECT config INTO paye_bands FROM public.statutory_rates
    WHERE rate_type='PAYE_BAND' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'monthly_kes')::numeric INTO personal_relief FROM public.statutory_rates
    WHERE rate_type='PERSONAL_RELIEF' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'upper')::numeric
    INTO nssf1_rate, nssf1_upper FROM public.statutory_rates
    WHERE rate_type='NSSF_TIER1' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'lower')::numeric, (config->>'upper')::numeric
    INTO nssf2_rate, nssf2_lower, nssf2_upper FROM public.statutory_rates
    WHERE rate_type='NSSF_TIER2' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'min_kes')::numeric
    INTO shif_rate, shif_min FROM public.statutory_rates
    WHERE rate_type='SHIF' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'employee_rate')::numeric, (config->>'employer_rate')::numeric
    INTO hl_emp, hl_er FROM public.statutory_rates
    WHERE rate_type='HOUSING_LEVY' ORDER BY effective_from DESC LIMIT 1;

  attendance := public.derive_attendance(_period_id);

  -- Validate compliance data first
  FOR emp IN SELECT * FROM jsonb_array_elements(attendance) LOOP
    IF (emp->>'basic_salary') IS NULL OR (emp->>'basic_salary')::numeric <= 0
       OR COALESCE(emp->>'kra_pin','') = '' THEN
      missing := missing || jsonb_build_object(
        'staff_id', emp->>'staff_id',
        'full_name', emp->>'full_name',
        'missing', CASE
          WHEN (emp->>'basic_salary') IS NULL OR (emp->>'basic_salary')::numeric <= 0
            THEN 'basic_salary' ELSE 'kra_pin' END
      );
    END IF;
  END LOOP;
  IF jsonb_array_length(missing) > 0 THEN
    RETURN jsonb_build_object('status','missing_data','missing', missing);
  END IF;

  -- Wipe previous runs for this period (idempotent recompute)
  DELETE FROM public.payroll_runs WHERE period_id = _period_id;

  FOR emp IN SELECT * FROM jsonb_array_elements(attendance) LOOP
    emp_id := (emp->>'employee_id')::uuid;
    basic  := (emp->>'basic_salary')::numeric;
    SELECT COALESCE(house_allowance,0) INTO house_allow FROM public.profiles WHERE id = emp_id;
    daily_rate  := basic / 30.0;
    night_al    := (emp->>'night_shifts')::int * daily_rate * night_pct;
    ph_al       := (emp->>'public_holidays_worked')::int * daily_rate * (ph_mult - 1);
    unpaid_ded  := (emp->>'unpaid_leave_days')::int * daily_rate;

    gross := basic + house_allow + night_al + ph_al;

    -- NSSF
    nssf1 := LEAST(basic, nssf1_upper) * nssf1_rate;
    nssf2 := GREATEST(LEAST(basic, nssf2_upper) - nssf2_lower, 0) * nssf2_rate;
    nssf_total := nssf1 + nssf2;

    -- SHIF
    shif := GREATEST(gross * shif_rate, shif_min);

    -- Housing Levy
    hl_e := gross * hl_emp;
    hl_r := gross * hl_er;

    -- PAYE bands (progressive) on gross - NSSF - SHIF - HousingLevy
    taxable := GREATEST(gross - nssf_total - shif - hl_e, 0);
    paye := 0; prev_cap := 0;
    FOR band IN SELECT jsonb_array_elements(paye_bands->'bands') LOOP
      rate := (band->>'rate')::numeric;
      cap  := NULLIF(band->>'upto','')::numeric;
      IF cap IS NULL THEN
        slice := GREATEST(taxable - prev_cap, 0);
      ELSE
        slice := GREATEST(LEAST(taxable, cap) - prev_cap, 0);
      END IF;
      paye := paye + slice * rate;
      IF cap IS NULL OR taxable <= cap THEN EXIT; END IF;
      prev_cap := cap;
    END LOOP;
    paye := GREATEST(paye - personal_relief, 0);

    net := gross - paye - nssf_total - shif - hl_e - unpaid_ded;

    INSERT INTO public.payroll_runs (
      period_id, employee_id, basic_salary, gross_earnings,
      total_deductions, employer_contributions, net_pay,
      computed_at, attendance_json
    ) VALUES (
      _period_id, emp_id, basic, gross,
      (paye + nssf_total + shif + hl_e + unpaid_ded),
      (nssf_total + hl_r),
      net, now(), emp
    ) RETURNING id INTO run_id;

    -- Line items
    INSERT INTO public.payroll_line_items(run_id, kind, code, label, amount) VALUES
      (run_id,'EARNING','BASIC','Basic Salary', basic),
      (run_id,'EARNING','HOUSE','House Allowance', house_allow),
      (run_id,'EARNING','NIGHT','Night Shift Allowance', night_al),
      (run_id,'EARNING','PH','Public Holiday Allowance', ph_al),
      (run_id,'DEDUCTION','PAYE','PAYE (Income Tax)', paye),
      (run_id,'DEDUCTION','NSSF','NSSF (Tier I + II)', nssf_total),
      (run_id,'DEDUCTION','SHIF','SHIF Contribution', shif),
      (run_id,'DEDUCTION','HOUSING','Affordable Housing Levy', hl_e),
      (run_id,'DEDUCTION','UNPAID_LEAVE','Unpaid Leave Deduction', unpaid_ded),
      (run_id,'EMPLOYER_CONTRIB','NSSF_ER','NSSF Employer Match', nssf_total),
      (run_id,'EMPLOYER_CONTRIB','HOUSING_ER','Housing Levy Employer', hl_r);

    total_runs := total_runs + 1;
  END LOOP;

  UPDATE public.payroll_periods SET status = 'CALCULATED' WHERE id = _period_id;

  RETURN jsonb_build_object('status','ok','runs', total_runs);
END; $$;

GRANT EXECUTE ON FUNCTION public.calculate_payroll(uuid) TO authenticated;

-- 6. Handle_new_user: stop auto-overwriting provided staff_id.
--    If the row provides a staff_id, honour it — even if it clashes we let the
--    unique constraint raise so the bulk uploader sees the real error.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _full_name text;
  _staff_id text;
BEGIN
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _staff_id := NULLIF(NEW.raw_user_meta_data->>'staff_id','');
  IF _staff_id IS NULL THEN
    _staff_id := 'AUTO-' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, staff_id)
  VALUES (NEW.id, NEW.email, _full_name, _staff_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'STAFF'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;
