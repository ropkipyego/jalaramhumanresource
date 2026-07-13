
-- profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL;

-- organization_settings alignment (add `name` alias + updated_by)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;
UPDATE public.organization_settings SET name = organization_name WHERE name IS NULL;

-- onboarding template sort order
ALTER TABLE public.onboarding_checklist_templates
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Recreate RPCs with the argument names the UI passes
DROP FUNCTION IF EXISTS public.clock_punch(text);
CREATE OR REPLACE FUNCTION public.clock_punch(_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := CURRENT_DATE; _now timestamptz := now(); _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.attendance_daily(employee_id, work_date, first_in, last_out, source, status)
  VALUES (_uid, _today,
          CASE WHEN _type='in' THEN _now END,
          CASE WHEN _type='out' THEN _now END,
          'manual','present')
  ON CONFLICT (employee_id, work_date) DO UPDATE
    SET first_in = COALESCE(public.attendance_daily.first_in, EXCLUDED.first_in),
        last_out = CASE WHEN _type='out' THEN _now ELSE public.attendance_daily.last_out END,
        updated_at = now();
  RETURN jsonb_build_object('status','ok','type',_type,'at',_now);
END $$;
GRANT EXECUTE ON FUNCTION public.clock_punch(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.clock_punch(text) FROM anon;

DROP FUNCTION IF EXISTS public.import_attendance_punches(jsonb);
CREATE OR REPLACE FUNCTION public.import_attendance_punches(_punches jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can import punches';
  END IF;
  RETURN jsonb_build_object('status','ok','received', jsonb_array_length(_punches),'note','stub');
END $$;
GRANT EXECUTE ON FUNCTION public.import_attendance_punches(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.import_attendance_punches(jsonb) FROM anon;

DROP FUNCTION IF EXISTS public.compute_attendance_range(date, date);
CREATE OR REPLACE FUNCTION public.compute_attendance_range(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN jsonb_build_object('status','ok','from',_from,'to',_to,'note','stub');
END $$;
GRANT EXECUTE ON FUNCTION public.compute_attendance_range(date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_attendance_range(date, date) FROM anon;
