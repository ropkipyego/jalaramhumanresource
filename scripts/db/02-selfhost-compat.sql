-- Idempotent fixes for migrations skipped on fresh self-hosted installs.
-- Replaces overlapping Supabase migrations 20260713140252 / 40346 / 40456.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS biometric_enroll_id text,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS offboarding_reason text;

ALTER TABLE public.onboarding_checklist_templates
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

ALTER TABLE public.employee_onboarding_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.attendance_exceptions DROP CONSTRAINT IF EXISTS attendance_exceptions_resolved_by_fkey;
ALTER TABLE public.attendance_daily DROP CONSTRAINT IF EXISTS attendance_daily_approved_by_fkey;
ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_uploaded_by_fkey;
ALTER TABLE public.disciplinary_records DROP CONSTRAINT IF EXISTS disciplinary_records_issued_by_fkey;
ALTER TABLE public.performance_reviews DROP CONSTRAINT IF EXISTS performance_reviews_reviewer_id_fkey;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_target_id_fkey;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_approved_by_fkey;
ALTER TABLE public.employee_loans DROP CONSTRAINT IF EXISTS employee_loans_approved_by_fkey;
ALTER TABLE public.loan_repayments DROP CONSTRAINT IF EXISTS loan_repayments_recorded_by_fkey;
ALTER TABLE public.leave_encashment_requests DROP CONSTRAINT IF EXISTS leave_encashment_requests_approved_by_fkey;
ALTER TABLE public.asset_assignments DROP CONSTRAINT IF EXISTS asset_assignments_assigned_by_fkey;
ALTER TABLE public.employee_onboarding_items DROP CONSTRAINT IF EXISTS employee_onboarding_items_completed_by_fkey;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_published_by_fkey;
ALTER TABLE public.vacancies DROP CONSTRAINT IF EXISTS vacancies_created_by_fkey;

-- UI calls clock_punch with text args ('in' / 'out'); attendance_engine uses punch_type enum.
CREATE OR REPLACE FUNCTION public.clock_punch(_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  punch public.punch_type;
  now_ts timestamptz := now();
  emp_id uuid := auth.uid();
BEGIN
  IF emp_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  punch := CASE lower(trim(_type))
    WHEN 'in' THEN 'IN'::public.punch_type
    WHEN 'out' THEN 'OUT'::public.punch_type
    ELSE upper(trim(_type))::public.punch_type
  END;

  INSERT INTO public.attendance_punches (employee_id, punch_at, punch_date, punch_type, source)
  VALUES (emp_id, now_ts, now_ts::date, punch, 'WEB');

  PERFORM public.compute_attendance_range(now_ts::date, now_ts::date, emp_id);

  RETURN jsonb_build_object('ok', true, 'punch_at', now_ts, 'punch_type', punch);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Duplicate punch at this time');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clock_punch(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.clock_punch(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_map_biometric_ids(_map jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; updated int := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can map biometric IDs';
  END IF;
  FOR r IN SELECT * FROM jsonb_to_recordset(_map) AS x(employee_id uuid, enroll_id text)
  LOOP
    UPDATE public.profiles SET biometric_enroll_id = r.enroll_id, updated_at = now()
    WHERE id = r.employee_id;
    updated := updated + 1;
  END LOOP;
  RETURN jsonb_build_object('status','ok','updated', updated);
END;
$$;
GRANT EXECUTE ON FUNCTION public.bulk_map_biometric_ids(jsonb) TO authenticated;
