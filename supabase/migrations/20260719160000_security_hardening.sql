-- Security hardening before go-live
-- 1) Block staff from clearing must_change_password / editing bank & statutory IDs
-- 2) Restrict derive_attendance to payroll roles (prevents salary dump)

CREATE OR REPLACE FUNCTION public.protect_profile_self_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]);
  IF NOT is_admin AND auth.uid() = NEW.id THEN
    NEW.staff_id          := OLD.staff_id;
    NEW.full_name         := OLD.full_name;
    NEW.email             := OLD.email;
    NEW.basic_salary      := OLD.basic_salary;
    NEW.hr_status         := OLD.hr_status;
    NEW.employment_type   := OLD.employment_type;
    NEW.designation       := OLD.designation;
    NEW.date_joined       := OLD.date_joined;
    NEW.contract_end_date := OLD.contract_end_date;
    NEW.house_allowance   := OLD.house_allowance;
    NEW.branch_id         := OLD.branch_id;
    NEW.position_id       := OLD.position_id;
    NEW.grade_id          := OLD.grade_id;
    NEW.manager_id        := OLD.manager_id;
    NEW.gender            := OLD.gender;
    NEW.date_of_birth     := OLD.date_of_birth;
    NEW.passport_no       := OLD.passport_no;
    NEW.probation_end_date:= OLD.probation_end_date;
    -- Force-password gate + payroll diversion fields
    NEW.must_change_password := OLD.must_change_password;
    NEW.kra_pin           := OLD.kra_pin;
    NEW.nssf_number       := OLD.nssf_number;
    NEW.shif_number       := OLD.shif_number;
    NEW.national_id       := OLD.national_id;
    NEW.bank_name         := OLD.bank_name;
    NEW.bank_branch       := OLD.bank_branch;
    NEW.bank_account      := OLD.bank_account;
    NEW.biometric_enroll_id := OLD.biometric_enroll_id;
  END IF;
  RETURN NEW;
END; $$;

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
  total_ot_min int; total_worked_min int;
  att_days int;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_any_role(
       auth.uid(),
       ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]
     ) THEN
    RAISE EXCEPTION 'Not authorized to derive attendance for payroll';
  END IF;

  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  d_start := make_date(p.period_year, p.period_month, 1);
  d_end   := (d_start + INTERVAL '1 month - 1 day')::date;

  FOR emp IN
    SELECT id, full_name, staff_id, basic_salary, kra_pin, hr_status
    FROM public.profiles WHERE hr_status = 'ACTIVE'
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE','PARTIAL')
        AND approval_status IN ('APPROVED','PENDING')),
      COUNT(*) FILTER (WHERE night_minutes > 0 AND approval_status = 'APPROVED'),
      COUNT(*) FILTER (WHERE (status = 'HOLIDAY' OR holiday_minutes > 0)
        AND approval_status = 'APPROVED'),
      COUNT(*) FILTER (WHERE status = 'OFF'),
      COALESCE(SUM(ot_minutes) FILTER (WHERE approval_status = 'APPROVED'), 0),
      COALESCE(SUM(worked_minutes) FILTER (WHERE approval_status = 'APPROVED'), 0)
    INTO days_worked, night_shifts, ph_worked, off_days, total_ot_min, total_worked_min
    FROM public.attendance_daily
    WHERE employee_id = emp.id AND work_date BETWEEN d_start AND d_end;

    SELECT COUNT(*) INTO att_days
    FROM public.attendance_daily
    WHERE employee_id = emp.id AND work_date BETWEEN d_start AND d_end;

    IF att_days = 0 THEN
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
      total_ot_min := 0;
      total_worked_min := 0;
    END IF;

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
      'unpaid_leave_days', COALESCE(unpaid_leave,0),
      'ot_minutes', COALESCE(total_ot_min,0),
      'worked_minutes', COALESCE(total_worked_min,0),
      'source', CASE WHEN att_days > 0 THEN 'attendance_daily' ELSE 'rota' END
    );
    result := result || row_json;
  END LOOP;
  RETURN result;
END; $$;
