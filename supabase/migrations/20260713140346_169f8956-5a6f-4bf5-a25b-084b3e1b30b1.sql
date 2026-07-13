
-- 1. profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS biometric_enroll_id text;

-- 2. attendance_daily column rename to match UI
ALTER TABLE public.attendance_daily RENAME COLUMN clock_in TO first_in;
ALTER TABLE public.attendance_daily RENAME COLUMN clock_out TO last_out;
ALTER TABLE public.attendance_daily RENAME COLUMN overtime_minutes TO ot_minutes;
ALTER TABLE public.attendance_daily RENAME COLUMN expected_shift TO expected_shift_code;

-- 3. onboarding templates & items
ALTER TABLE public.onboarding_checklist_templates
  ADD COLUMN IF NOT EXISTS title text;
UPDATE public.onboarding_checklist_templates SET title = name WHERE title IS NULL;

ALTER TABLE public.employee_onboarding_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;
UPDATE public.employee_onboarding_items SET title = item_name WHERE title IS NULL;
ALTER TABLE public.employee_onboarding_items ALTER COLUMN item_name DROP NOT NULL;

-- 4. Drop secondary profiles FKs to disambiguate PostgREST embedding
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

-- 5. Stub RPCs so ClockInOut / AttendanceImport / AttendanceRecords work
CREATE OR REPLACE FUNCTION public.clock_punch(_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := CURRENT_DATE; _now timestamptz := now(); _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.attendance_daily(employee_id, work_date, first_in, last_out, source, status)
  VALUES (_uid, _today,
          CASE WHEN _kind='in' THEN _now END,
          CASE WHEN _kind='out' THEN _now END,
          'manual','present')
  ON CONFLICT (employee_id, work_date) DO UPDATE
    SET first_in = COALESCE(public.attendance_daily.first_in, EXCLUDED.first_in),
        last_out = CASE WHEN _kind='out' THEN _now ELSE public.attendance_daily.last_out END,
        updated_at = now();
  RETURN jsonb_build_object('status','ok','kind',_kind,'at',_now);
END $$;

CREATE OR REPLACE FUNCTION public.import_attendance_punches(_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inserted int := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can import punches';
  END IF;
  RETURN jsonb_build_object('status','ok','inserted',_inserted,'note','stub - implement importer');
END $$;

CREATE OR REPLACE FUNCTION public.compute_attendance_range(_start date, _end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN jsonb_build_object('status','ok','from',_start,'to',_end,'note','stub - recompute pending');
END $$;

REVOKE EXECUTE ON FUNCTION public.clock_punch(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_attendance_punches(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_attendance_range(date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.clock_punch(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_attendance_punches(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_attendance_range(date,date) TO authenticated;
