-- ============================================================================
-- JALARAM HRPMS — GO-LIVE SQL (paste ALL of this into Supabase → SQL Editor → Run)
-- Project: sfziuvxfeyfhkzmcxpou
--
-- How to run:
--   1. Open https://supabase.com/dashboard/project/sfziuvxfeyfhkzmcxpou/sql/new
--   2. Paste this entire file
--   3. Click Run (or Ctrl/Cmd + Enter)
--   4. Confirm no errors in the Results panel
--
-- What this does:
--   • Adds profiles.must_change_password (required for Go-Live Credentials)
--   • Approved-OT-only payroll + attendance lock guards
--   • Security: staff cannot clear must_change_password / edit bank & statutory IDs
--   • Restricts derive_attendance to ADMIN / SUPER_ADMIN / FINANCE_ADMIN / HR_OFFICER
-- ============================================================================

-- Security: force password change on first login / after go-live reset
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Mark existing users who likely have temporary passwords (optional — admin can clear)
-- UPDATE public.profiles SET must_change_password = true WHERE email ILIKE '%@jalaramhr.local';

-- When go-live resets passwords, edge function should set must_change_password = true
CREATE OR REPLACE FUNCTION public.set_must_change_password(_user_id uuid, _value boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
     AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  -- Staff may only clear their own flag after changing password
  IF auth.uid() = _user_id AND _value = true THEN
    RAISE EXCEPTION 'Staff cannot force their own password reset flag on';
  END IF;
  UPDATE public.profiles SET must_change_password = _value WHERE id = _user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_must_change_password(uuid, boolean) TO authenticated;
-- Phase C: Approved OT only for payroll + attendance lock guards + approve/reject RPCs

-- 1) derive_attendance: only count APPROVED OT (and prefer approved days for worked metrics)
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
    SELECT
      COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE','PARTIAL')
        AND approval_status IN ('APPROVED','PENDING')),
      COUNT(*) FILTER (WHERE night_minutes > 0 AND approval_status = 'APPROVED'),
      COUNT(*) FILTER (WHERE (status = 'HOLIDAY' OR holiday_minutes > 0)
        AND approval_status = 'APPROVED'),
      COUNT(*) FILTER (WHERE status = 'OFF'),
      -- OT only when day is APPROVED (prevents paying unapproved overtime)
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

-- 2) Readiness check before locking attendance / calculating payroll
CREATE OR REPLACE FUNCTION public.attendance_payroll_readiness(_period_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD;
  d_start date;
  d_end date;
  pending_ot int := 0;
  pending_days int := 0;
  open_blockers int := 0;
  open_ot_exc int := 0;
BEGIN
  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  d_start := make_date(p.period_year, p.period_month, 1);
  d_end   := (d_start + INTERVAL '1 month - 1 day')::date;

  SELECT COUNT(*) INTO pending_ot
  FROM public.attendance_daily
  WHERE work_date BETWEEN d_start AND d_end
    AND ot_minutes > 0
    AND approval_status = 'PENDING';

  SELECT COUNT(*) INTO pending_days
  FROM public.attendance_daily
  WHERE work_date BETWEEN d_start AND d_end
    AND approval_status = 'PENDING'
    AND status NOT IN ('OFF', 'ON_LEAVE', 'HOLIDAY');

  SELECT COUNT(*) INTO open_blockers
  FROM public.attendance_exceptions
  WHERE work_date BETWEEN d_start AND d_end
    AND resolved = false
    AND severity = 'blocker';

  SELECT COUNT(*) INTO open_ot_exc
  FROM public.attendance_exceptions
  WHERE work_date BETWEEN d_start AND d_end
    AND resolved = false
    AND exception_type = 'OT_PENDING';

  RETURN jsonb_build_object(
    'ready', (pending_ot = 0 AND open_blockers = 0),
    'period_id', _period_id,
    'from', d_start,
    'to', d_end,
    'pending_ot_days', pending_ot,
    'pending_attendance_days', pending_days,
    'open_blocker_exceptions', open_blockers,
    'open_ot_exceptions', open_ot_exc,
    'message', CASE
      WHEN pending_ot > 0 THEN format('%s day(s) with unapproved overtime — approve or reject OT first', pending_ot)
      WHEN open_blockers > 0 THEN format('%s blocker exception(s) still open', open_blockers)
      ELSE 'Attendance ready for payroll lock'
    END
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.attendance_payroll_readiness(uuid) TO authenticated;

-- 3) Harden SoD trigger: block ATTENDANCE_LOCKED when OT/blockers pending
CREATE OR REPLACE FUNCTION public.enforce_payroll_sod()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  readiness jsonb;
BEGIN
  IF NEW.status = 'FINANCE_APPROVED' AND OLD.status IS DISTINCT FROM 'FINANCE_APPROVED' THEN
    IF NOT public.has_role(auth.uid(),'FINANCE_ADMIN') THEN
      RAISE EXCEPTION 'Only FINANCE_ADMIN may approve payroll (SoD)';
    END IF;
    IF NEW.hr_reviewed_by IS NOT NULL AND NEW.hr_reviewed_by = auth.uid() THEN
      RAISE EXCEPTION 'Segregation of duties: HR reviewer cannot also approve as Finance';
    END IF;
    NEW.finance_approved_by := auth.uid();
    NEW.finance_approved_at := now();
  END IF;
  IF NEW.status = 'HR_REVIEWED' AND OLD.status IS DISTINCT FROM 'HR_REVIEWED' THEN
    NEW.hr_reviewed_by := auth.uid();
    NEW.hr_reviewed_at := now();
  END IF;
  IF NEW.status = 'ATTENDANCE_LOCKED' AND OLD.status IS DISTINCT FROM 'ATTENDANCE_LOCKED' THEN
    readiness := public.attendance_payroll_readiness(NEW.id);
    IF NOT COALESCE((readiness->>'ready')::boolean, false) THEN
      RAISE EXCEPTION '%', COALESCE(readiness->>'message', 'Attendance not ready for lock');
    END IF;
    NEW.attendance_locked_by := auth.uid();
    NEW.attendance_locked_at := now();
  END IF;
  IF NEW.status = 'LOCKED' AND OLD.status IS DISTINCT FROM 'LOCKED' THEN
    IF NOT public.has_role(auth.uid(),'SUPER_ADMIN') THEN
      RAISE EXCEPTION 'Only SUPER_ADMIN can finalise (LOCK) payroll';
    END IF;
    NEW.locked_by := auth.uid();
    NEW.locked_at := now();
  END IF;
  IF OLD.status = 'LOCKED' AND NEW.status <> 'LOCKED' THEN
    RAISE EXCEPTION 'Payroll period is LOCKED and immutable';
  END IF;
  RETURN NEW;
END; $$;

-- 4) Bulk approve / reject attendance days (reject zeroes OT and resolves OT_PENDING exceptions)
CREATE OR REPLACE FUNCTION public.bulk_set_attendance_approval(
  _ids uuid[],
  _status public.attendance_approval_status,
  _zero_ot_on_reject boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated int := 0;
  id uuid;
  rec RECORD;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _status NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Status must be APPROVED or REJECTED';
  END IF;

  FOREACH id IN ARRAY _ids LOOP
    SELECT * INTO rec FROM public.attendance_daily WHERE attendance_daily.id = id;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.attendance_daily SET
      approval_status = _status,
      approved_at = now(),
      approved_by = auth.uid(),
      ot_minutes = CASE
        WHEN _status = 'REJECTED' AND _zero_ot_on_reject THEN 0
        ELSE ot_minutes
      END
    WHERE attendance_daily.id = id;

    -- Resolve related OT_PENDING exceptions for that employee/day
    UPDATE public.attendance_exceptions SET
      resolved = true,
      resolved_at = now(),
      resolved_by = auth.uid()
    WHERE employee_id = rec.employee_id
      AND work_date = rec.work_date
      AND exception_type = 'OT_PENDING'
      AND resolved = false;

    updated := updated + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', updated, 'status', _status);
END; $$;

GRANT EXECUTE ON FUNCTION public.bulk_set_attendance_approval(uuid[], public.attendance_approval_status, boolean) TO authenticated;

-- Ensure approved_by column exists (may already from earlier migration)
DO $$ BEGIN
  ALTER TABLE public.attendance_daily ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.attendance_exceptions ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN others THEN NULL;
END $$;
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
