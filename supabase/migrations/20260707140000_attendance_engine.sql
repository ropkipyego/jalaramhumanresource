
-- Phase B: Attendance — punches, biometric import, daily computation engine

DO $$ BEGIN
  CREATE TYPE public.punch_source AS ENUM ('BIOMETRIC', 'MANUAL', 'WEB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.punch_type AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_day_status AS ENUM (
    'PRESENT', 'LATE', 'PARTIAL', 'ABSENT', 'ON_LEAVE', 'OFF', 'HOLIDAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_exception_type AS ENUM (
    'LATE', 'ABSENT', 'EARLY_LEAVE', 'MISSING_OUT', 'MISSING_IN',
    'OT_PENDING', 'UNMATCHED_STAFF', 'DUPLICATE_PUNCH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_batch_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional biometric enroll ID when device ID differs from staff_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS biometric_enroll_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_biometric_enroll_id_unique
  ON public.profiles (biometric_enroll_id) WHERE biometric_enroll_id IS NOT NULL;

-- Import batches (audit trail for biometric uploads)
CREATE TABLE IF NOT EXISTS public.attendance_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  date_from date,
  date_to date,
  total_rows int NOT NULL DEFAULT 0,
  inserted_rows int NOT NULL DEFAULT 0,
  skipped_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.import_batch_status NOT NULL DEFAULT 'PENDING',
  imported_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Raw punch records (biometric, web clock, manual)
CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  punch_at timestamptz NOT NULL,
  punch_date date NOT NULL,
  punch_type public.punch_type NOT NULL,
  source public.punch_source NOT NULL DEFAULT 'BIOMETRIC',
  device_id text,
  batch_id uuid REFERENCES public.attendance_import_batches(id) ON DELETE SET NULL,
  raw_staff_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, punch_at, punch_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_punches_employee_date
  ON public.attendance_punches (employee_id, punch_date);
CREATE INDEX IF NOT EXISTS idx_attendance_punches_date
  ON public.attendance_punches (punch_date);

-- Computed daily attendance
CREATE TABLE IF NOT EXISTS public.attendance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  expected_shift_code text,
  shift_template_id uuid REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  expected_start timestamptz,
  expected_end timestamptz,
  first_in timestamptz,
  last_out timestamptz,
  worked_minutes int NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  early_leave_minutes int NOT NULL DEFAULT 0,
  ot_minutes int NOT NULL DEFAULT 0,
  night_minutes int NOT NULL DEFAULT 0,
  weekend_minutes int NOT NULL DEFAULT 0,
  holiday_minutes int NOT NULL DEFAULT 0,
  status public.attendance_day_status NOT NULL DEFAULT 'ABSENT',
  approval_status public.attendance_approval_status NOT NULL DEFAULT 'PENDING',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  batch_id uuid REFERENCES public.attendance_import_batches(id) ON DELETE SET NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON public.attendance_daily (work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_status ON public.attendance_daily (status, approval_status);

-- Exception queue
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id uuid REFERENCES public.attendance_daily(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  exception_type public.attendance_exception_type NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  description text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_open
  ON public.attendance_exceptions (resolved, work_date);

-- RLS
ALTER TABLE public.attendance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_import_batches"
  ON public.attendance_import_batches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE POLICY "staff_view_own_punches"
  ON public.attendance_punches FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[])
  );

CREATE POLICY "admin_insert_punches"
  ON public.attendance_punches FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  );

CREATE POLICY "admin_manage_punches"
  ON public.attendance_punches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE POLICY "staff_view_own_daily"
  ON public.attendance_daily FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[])
  );

CREATE POLICY "admin_manage_daily"
  ON public.attendance_daily FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE POLICY "staff_view_own_exceptions"
  ON public.attendance_exceptions FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[])
  );

CREATE POLICY "admin_manage_exceptions"
  ON public.attendance_exceptions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[]));

-- Resolve employee from staff_id or biometric_enroll_id
CREATE OR REPLACE FUNCTION public.resolve_employee_by_identifier(_id text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp_id uuid;
  norm text;
BEGIN
  norm := upper(trim(_id));
  IF norm = '' OR norm IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO emp_id FROM public.profiles
    WHERE upper(trim(staff_id)) = norm
       OR upper(trim(COALESCE(biometric_enroll_id, ''))) = norm
    LIMIT 1;
  RETURN emp_id;
END; $$;

-- Bulk import punches from parsed JSON
CREATE OR REPLACE FUNCTION public.import_attendance_punches(
  _punches jsonb,
  _file_name text,
  _imported_by uuid DEFAULT auth.uid()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  batch_id uuid;
  punch jsonb;
  emp_id uuid;
  inserted int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  d_from date;
  d_to date;
  p_at timestamptz;
  p_type public.punch_type;
  p_source public.punch_source;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can import attendance';
  END IF;

  INSERT INTO public.attendance_import_batches (file_name, status, imported_by)
  VALUES (_file_name, 'PENDING', _imported_by)
  RETURNING id INTO batch_id;

  FOR punch IN SELECT * FROM jsonb_array_elements(_punches) LOOP
    emp_id := (punch->>'employee_id')::uuid;
    IF emp_id IS NULL THEN
      emp_id := public.resolve_employee_by_identifier(punch->>'staff_id');
    END IF;

    IF emp_id IS NULL THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object(
        'row', punch->>'row',
        'staff_id', punch->>'staff_id',
        'error', 'Staff ID not found in system'
      );
      CONTINUE;
    END IF;

    p_at := (punch->>'punch_at')::timestamptz;
    IF p_at IS NULL THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('row', punch->>'row', 'error', 'Invalid datetime');
      CONTINUE;
    END IF;

    p_type := (punch->>'punch_type')::public.punch_type;
    IF p_type IS NULL THEN p_type := 'IN'; END IF;

    p_source := COALESCE((punch->>'source')::public.punch_source, 'BIOMETRIC');

    BEGIN
      INSERT INTO public.attendance_punches (
        employee_id, punch_at, punch_date, punch_type, source,
        batch_id, raw_staff_id, device_id, notes
      ) VALUES (
        emp_id, p_at, p_at::date, p_type, p_source,
        batch_id, punch->>'staff_id', punch->>'device_id', punch->>'notes'
      );
      inserted := inserted + 1;
      IF d_from IS NULL OR p_at::date < d_from THEN d_from := p_at::date; END IF;
      IF d_to IS NULL OR p_at::date > d_to THEN d_to := p_at::date; END IF;
    EXCEPTION WHEN unique_violation THEN
      skipped := skipped + 1;
    END;
  END LOOP;

  UPDATE public.attendance_import_batches SET
    status = 'COMPLETED',
    date_from = d_from,
    date_to = d_to,
    total_rows = jsonb_array_length(_punches),
    inserted_rows = inserted,
    skipped_rows = skipped,
    error_rows = jsonb_array_length(errors),
    errors_json = errors,
    completed_at = now()
  WHERE id = batch_id;

  -- Auto-compute attendance for imported date range
  IF d_from IS NOT NULL AND d_to IS NOT NULL THEN
    PERFORM public.compute_attendance_range(d_from, d_to, NULL);
  END IF;

  RETURN jsonb_build_object(
    'batch_id', batch_id,
    'inserted', inserted,
    'skipped', skipped,
    'errors', errors,
    'date_from', d_from,
    'date_to', d_to
  );
END; $$;

-- Web / manual clock punch
CREATE OR REPLACE FUNCTION public.clock_punch(_type public.punch_type DEFAULT 'IN')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp_id uuid := auth.uid();
  now_ts timestamptz := now();
BEGIN
  IF emp_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.attendance_punches (employee_id, punch_at, punch_date, punch_type, source)
  VALUES (emp_id, now_ts, now_ts::date, _type, 'WEB');

  PERFORM public.compute_attendance_range(now_ts::date, now_ts::date, emp_id);

  RETURN jsonb_build_object('ok', true, 'punch_at', now_ts, 'punch_type', _type);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Duplicate punch at this time');
END; $$;

-- Core attendance computation engine
CREATE OR REPLACE FUNCTION public.compute_attendance_range(
  _from date,
  _to date,
  _employee_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  settings RECORD;
  emp RECORD;
  d date;
  dow int;
  week_start date;
  v_shift_code text;
  v_shift_template_id uuid;
  v_start_time time;
  v_end_time time;
  v_crosses_midnight boolean;
  v_expected_hours numeric;
  v_meal_break int;
  v_grace_before int;
  v_grace_after int;
  v_is_night boolean;
  exp_start timestamptz;
  exp_end timestamptz;
  shift_code text;
  first_in timestamptz;
  last_out timestamptz;
  worked int;
  late int;
  early int;
  ot int;
  night_m int;
  wknd_m int;
  hol_m int;
  day_status public.attendance_day_status;
  on_leave boolean;
  is_holiday boolean;
  grace int;
  late_thresh int;
  min_ot int;
  ot_round int;
  max_daily_ot int;
  meal_break int;
  expected_mins int;
  daily_id uuid;
  computed int := 0;
BEGIN
  IF _from > _to THEN RAISE EXCEPTION 'from date must be <= to date'; END IF;

  SELECT * INTO settings FROM public.attendance_settings WHERE id = true;
  grace := COALESCE(settings.grace_min, 5);
  late_thresh := COALESCE(settings.late_threshold_min, 10);
  min_ot := COALESCE(settings.min_ot_min, 30);
  ot_round := COALESCE(settings.ot_round_min, 15);
  max_daily_ot := COALESCE(settings.max_daily_ot_min, 240);

  FOR emp IN
    SELECT id, staff_id, full_name FROM public.profiles
    WHERE hr_status = 'ACTIVE'
      AND (_employee_id IS NULL OR id = _employee_id)
  LOOP
    d := _from;
    WHILE d <= _to LOOP
      shift_code := NULL;
      v_shift_template_id := NULL;
      v_start_time := NULL;
      v_end_time := NULL;
      v_crosses_midnight := false;
      v_expected_hours := NULL;
      v_meal_break := 30;
      v_grace_before := NULL;
      v_grace_after := NULL;
      v_is_night := false;
      on_leave := false;
      is_holiday := false;
      day_status := 'ABSENT';

      -- Approved leave?
      SELECT EXISTS (
        SELECT 1 FROM public.leave_requests
        WHERE employee_id = emp.id AND status = 'approved'
          AND d BETWEEN start_date AND end_date
      ) INTO on_leave;

      IF on_leave THEN
        day_status := 'ON_LEAVE';
        INSERT INTO public.attendance_daily (
          employee_id, work_date, status, approval_status, computed_at
        ) VALUES (emp.id, d, day_status, 'APPROVED', now())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          status = EXCLUDED.status, computed_at = now();
        computed := computed + 1;
        d := d + 1;
        CONTINUE;
      END IF;

      -- Public holiday?
      SELECT EXISTS (
        SELECT 1 FROM public.public_holidays WHERE holiday_date = d
      ) INTO is_holiday;

      -- Expected shift from published rota
      dow := EXTRACT(ISODOW FROM d)::int - 1; -- Mon=0
      week_start := d - dow;

      SELECT ra.shift_code::text, ra.shift_template_id, st.start_time, st.end_time,
             st.crosses_midnight, st.expected_hours, st.meal_break_minutes,
             st.grace_before_min, st.grace_after_min, COALESCE(st.is_night, false)
      INTO v_shift_code, v_shift_template_id, v_start_time, v_end_time,
           v_crosses_midnight, v_expected_hours, v_meal_break,
           v_grace_before, v_grace_after, v_is_night
      FROM public.rota_assignments ra
      JOIN public.rota_weeks rw ON rw.id = ra.rota_week_id
      LEFT JOIN public.shift_templates st ON st.id = ra.shift_template_id
      WHERE ra.employee_id = emp.id
        AND rw.week_start_date = week_start
        AND ra.day_of_week = dow
        AND rw.status = 'published'
      LIMIT 1;

      shift_code := v_shift_code;

      IF shift_code = 'OFF' THEN
        day_status := 'OFF';
        INSERT INTO public.attendance_daily (employee_id, work_date, expected_shift_code, status, approval_status, computed_at)
        VALUES (emp.id, d, shift_code, day_status, 'APPROVED', now())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          expected_shift_code = EXCLUDED.expected_shift_code, status = EXCLUDED.status, computed_at = now();
        computed := computed + 1;
        d := d + 1;
        CONTINUE;
      END IF;

      IF shift_code = 'PH' OR (is_holiday AND shift_code IS NULL) THEN
        day_status := 'HOLIDAY';
      END IF;

      -- Build expected window from template or shift code defaults
      IF v_shift_template_id IS NOT NULL AND v_start_time IS NOT NULL THEN
        exp_start := d + v_start_time;
        IF v_crosses_midnight THEN
          exp_end := (d + 1) + v_end_time;
        ELSE
          exp_end := d + v_end_time;
        END IF;
        expected_mins := (COALESCE(v_expected_hours, 8) * 60)::int;
        meal_break := COALESCE(v_meal_break, 30);
      ELSIF shift_code = 'N' THEN
        exp_start := d + time '18:30';
        exp_end := (d + 1) + time '06:30';
        expected_mins := 720;
        meal_break := 30;
      ELSIF shift_code = 'D' OR shift_code IS NOT NULL THEN
        exp_start := d + time '08:00';
        exp_end := d + time '18:00';
        expected_mins := 600;
        meal_break := 30;
      ELSE
        -- No rota — use punches only (flexible workers)
        exp_start := d + time '08:00';
        exp_end := d + time '17:00';
        expected_mins := 480;
        meal_break := 30;
      END IF;

      -- Collect punches in window (include cross-midnight buffer)
      SELECT MIN(punch_at) FILTER (WHERE punch_type = 'IN'),
             MAX(punch_at) FILTER (WHERE punch_type = 'OUT')
      INTO first_in, last_out
      FROM public.attendance_punches
      WHERE employee_id = emp.id
        AND punch_at >= exp_start - (COALESCE(v_grace_before, grace) || ' minutes')::interval
        AND punch_at <= exp_end + (COALESCE(v_grace_after, grace) || ' minutes')::interval;

      -- Fallback: any punch on calendar day if no IN/OUT typed
      IF first_in IS NULL THEN
        SELECT MIN(punch_at) INTO first_in
        FROM public.attendance_punches
        WHERE employee_id = emp.id AND punch_date = d;
      END IF;
      IF last_out IS NULL THEN
        SELECT MAX(punch_at) INTO last_out
        FROM public.attendance_punches
        WHERE employee_id = emp.id AND punch_date = d;
      END IF;

      worked := 0; late := 0; early := 0; ot := 0; night_m := 0; wknd_m := 0; hol_m := 0;

      IF first_in IS NOT NULL AND last_out IS NOT NULL AND last_out > first_in THEN
        worked := GREATEST(0, EXTRACT(EPOCH FROM (last_out - first_in))::int / 60 - meal_break);
        late := GREATEST(0, EXTRACT(EPOCH FROM (first_in - exp_start))::int / 60 - late_thresh);
        early := GREATEST(0, EXTRACT(EPOCH FROM (exp_end - last_out))::int / 60 - grace);
        ot := GREATEST(0, worked - expected_mins);
        IF ot < min_ot THEN ot := 0;
        ELSE ot := (ot / ot_round) * ot_round; END IF;
        ot := LEAST(ot, max_daily_ot);

        IF shift_code = 'N' OR v_is_night THEN
          night_m := worked;
        END IF;

        IF EXTRACT(ISODOW FROM d) IN (6, 7) THEN wknd_m := worked; END IF;
        IF is_holiday OR shift_code = 'PH' THEN hol_m := worked; END IF;

        IF day_status = 'HOLIDAY' THEN
          day_status := 'PRESENT';
        ELSIF late > 0 THEN
          day_status := 'LATE';
        ELSE
          day_status := 'PRESENT';
        END IF;
      ELSIF first_in IS NOT NULL OR last_out IS NOT NULL THEN
        day_status := 'PARTIAL';
      ELSIF shift_code IS NOT NULL AND shift_code NOT IN ('OFF','PH') AND NOT is_holiday THEN
        day_status := 'ABSENT';
      ELSIF shift_code IS NULL AND first_in IS NULL THEN
        day_status := 'OFF';
      END IF;

      INSERT INTO public.attendance_daily (
        employee_id, work_date, expected_shift_code, shift_template_id,
        expected_start, expected_end, first_in, last_out,
        worked_minutes, late_minutes, early_leave_minutes, ot_minutes,
        night_minutes, weekend_minutes, holiday_minutes,
        status, approval_status, computed_at
      ) VALUES (
        emp.id, d, shift_code, v_shift_template_id,
        exp_start, exp_end, first_in, last_out,
        worked, late, early, ot, night_m, wknd_m, hol_m,
        day_status,
        CASE WHEN day_status IN ('OFF','ON_LEAVE','HOLIDAY') THEN 'APPROVED'::public.attendance_approval_status
             ELSE 'PENDING'::public.attendance_approval_status END,
        now()
      )
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        expected_shift_code = EXCLUDED.expected_shift_code,
        shift_template_id = EXCLUDED.shift_template_id,
        expected_start = EXCLUDED.expected_start,
        expected_end = EXCLUDED.expected_end,
        first_in = EXCLUDED.first_in,
        last_out = EXCLUDED.last_out,
        worked_minutes = EXCLUDED.worked_minutes,
        late_minutes = EXCLUDED.late_minutes,
        early_leave_minutes = EXCLUDED.early_leave_minutes,
        ot_minutes = EXCLUDED.ot_minutes,
        night_minutes = EXCLUDED.night_minutes,
        weekend_minutes = EXCLUDED.weekend_minutes,
        holiday_minutes = EXCLUDED.holiday_minutes,
        status = EXCLUDED.status,
        approval_status = CASE
          WHEN EXCLUDED.status IN ('OFF','ON_LEAVE','HOLIDAY') THEN 'APPROVED'::public.attendance_approval_status
          WHEN attendance_daily.approval_status = 'APPROVED' THEN 'APPROVED'::public.attendance_approval_status
          ELSE 'PENDING'::public.attendance_approval_status
        END,
        computed_at = now()
      RETURNING id INTO daily_id;

      -- Clear old exceptions for this day
      DELETE FROM public.attendance_exceptions
      WHERE employee_id = emp.id AND work_date = d;

      -- Raise exceptions
      IF day_status = 'ABSENT' AND shift_code IS NOT NULL AND shift_code NOT IN ('OFF') THEN
        INSERT INTO public.attendance_exceptions (daily_id, employee_id, work_date, exception_type, severity, description)
        VALUES (daily_id, emp.id, d, 'ABSENT', 'blocker', 'No punches recorded for scheduled shift');
      END IF;
      IF late > 0 THEN
        INSERT INTO public.attendance_exceptions (daily_id, employee_id, work_date, exception_type, severity, description)
        VALUES (daily_id, emp.id, d, 'LATE', 'warning', format('Late by %s minutes', late));
      END IF;
      IF early > 0 THEN
        INSERT INTO public.attendance_exceptions (daily_id, employee_id, work_date, exception_type, severity, description)
        VALUES (daily_id, emp.id, d, 'EARLY_LEAVE', 'warning', format('Left early by %s minutes', early));
      END IF;
      IF day_status = 'PARTIAL' THEN
        INSERT INTO public.attendance_exceptions (daily_id, employee_id, work_date, exception_type, severity, description)
        VALUES (daily_id, emp.id, d, 'MISSING_OUT', 'warning', 'Incomplete punch pair (missing IN or OUT)');
      END IF;
      IF ot >= min_ot THEN
        INSERT INTO public.attendance_exceptions (daily_id, employee_id, work_date, exception_type, severity, description)
        VALUES (daily_id, emp.id, d, 'OT_PENDING', 'info', format('Overtime %s minutes pending approval', ot));
      END IF;

      computed := computed + 1;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('computed_days', computed, 'from', _from, 'to', _to);
END; $$;

GRANT EXECUTE ON FUNCTION public.import_attendance_punches(jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_punch(public.punch_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_attendance_range(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_employee_by_identifier(text) TO authenticated;

-- Update payroll derive_attendance to use computed attendance when available
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
  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  d_start := make_date(p.period_year, p.period_month, 1);
  d_end   := (d_start + INTERVAL '1 month - 1 day')::date;

  FOR emp IN
    SELECT id, full_name, staff_id, basic_salary, kra_pin, hr_status
    FROM public.profiles WHERE hr_status = 'ACTIVE'
  LOOP
    -- Prefer computed attendance_daily (approved or pending with punches)
    SELECT
      COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE','PARTIAL')),
      COUNT(*) FILTER (WHERE night_minutes > 0),
      COUNT(*) FILTER (WHERE status = 'HOLIDAY' OR holiday_minutes > 0),
      COUNT(*) FILTER (WHERE status = 'OFF'),
      COALESCE(SUM(ot_minutes), 0),
      COALESCE(SUM(worked_minutes), 0)
    INTO days_worked, night_shifts, ph_worked, off_days, total_ot_min, total_worked_min
    FROM public.attendance_daily
    WHERE employee_id = emp.id AND work_date BETWEEN d_start AND d_end;

    SELECT COUNT(*) INTO att_days
    FROM public.attendance_daily
    WHERE employee_id = emp.id AND work_date BETWEEN d_start AND d_end;

    -- Fallback to rota if no attendance computed
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
