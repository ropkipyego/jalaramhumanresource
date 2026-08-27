-- Phase 3: real import + rota→shift instances + engine data feed

DROP FUNCTION IF EXISTS public.import_attendance_punches(jsonb);

CREATE OR REPLACE FUNCTION public.import_attendance_punches(
  _punches jsonb,
  _file_name text DEFAULT 'upload.xlsx',
  _source text DEFAULT 'ZKTECO'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  batch_id uuid;
  punch jsonb;
  emp_id uuid;
  inserted int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  d_from date; d_to date;
  p_at timestamptz;
  p_type public.punch_type;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can import attendance';
  END IF;

  INSERT INTO public.attendance_import_batches (file_name, source, status, imported_by)
  VALUES (COALESCE(_file_name,'upload.xlsx'), COALESCE(_source,'ZKTECO'), 'PENDING', auth.uid())
  RETURNING id INTO batch_id;

  FOR punch IN SELECT * FROM jsonb_array_elements(_punches) LOOP
    emp_id := NULLIF(punch->>'employee_id','')::uuid;
    IF emp_id IS NULL THEN
      SELECT id INTO emp_id FROM public.profiles
      WHERE upper(trim(staff_id)) = upper(trim(COALESCE(punch->>'staff_id','')))
         OR upper(trim(COALESCE(biometric_enroll_id,''))) = upper(trim(COALESCE(punch->>'staff_id','')))
      LIMIT 1;
    END IF;

    IF emp_id IS NULL THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('row', punch->>'row',
        'staff_id', punch->>'staff_id', 'error', 'Staff/enroll ID not mapped');
      CONTINUE;
    END IF;

    p_at := NULLIF(punch->>'punch_at','')::timestamptz;
    IF p_at IS NULL THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('row', punch->>'row', 'error', 'Invalid datetime');
      CONTINUE;
    END IF;

    p_type := NULLIF(punch->>'punch_type','')::public.punch_type;

    BEGIN
      INSERT INTO public.attendance_punches (
        employee_id, punch_at, punch_date, punch_time, punch_type,
        source, batch_id, raw_staff_id, raw_value, device_id
      ) VALUES (
        emp_id, p_at, (p_at AT TIME ZONE 'Africa/Nairobi')::date,
        (p_at AT TIME ZONE 'Africa/Nairobi')::time, p_type,
        'BIOMETRIC', batch_id, punch->>'staff_id', punch->>'raw_value', punch->>'device_id'
      );
      inserted := inserted + 1;
      IF d_from IS NULL OR (p_at AT TIME ZONE 'Africa/Nairobi')::date < d_from
        THEN d_from := (p_at AT TIME ZONE 'Africa/Nairobi')::date; END IF;
      IF d_to IS NULL OR (p_at AT TIME ZONE 'Africa/Nairobi')::date > d_to
        THEN d_to := (p_at AT TIME ZONE 'Africa/Nairobi')::date; END IF;
    EXCEPTION WHEN unique_violation THEN
      skipped := skipped + 1;
    END;
  END LOOP;

  UPDATE public.attendance_import_batches SET
    status = 'COMPLETED', date_from = d_from, date_to = d_to,
    total_rows = jsonb_array_length(_punches), inserted_rows = inserted,
    skipped_rows = skipped, error_rows = jsonb_array_length(errors),
    errors_json = errors, completed_at = now()
  WHERE id = batch_id;

  RETURN jsonb_build_object('batch_id', batch_id, 'inserted', inserted,
    'skipped', skipped, 'errors', errors, 'date_from', d_from, 'date_to', d_to);
END $$;

REVOKE EXECUTE ON FUNCTION public.import_attendance_punches(jsonb, text, text) FROM anon;

-- Build shift instances from the published rota
CREATE OR REPLACE FUNCTION public.sync_shift_instances_from_rota(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created int := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can build shifts';
  END IF;
  IF _from > _to THEN RAISE EXCEPTION 'from date must be on or before to date'; END IF;

  DELETE FROM public.shift_instances
  WHERE shift_date BETWEEN _from AND _to AND source = 'ROTA';

  WITH src AS (
    SELECT
      ra.employee_id,
      rw.department_id,
      (rw.week_start_date + ra.day_of_week)::date AS shift_date,
      ra.shift_code::text AS shift_code,
      st.id AS template_id,
      st.start_time, st.end_time, COALESCE(st.crosses_midnight,false) AS crosses_midnight
    FROM public.rota_assignments ra
    JOIN public.rota_weeks rw ON rw.id = ra.rota_week_id
    LEFT JOIN LATERAL (
      SELECT t.* FROM public.shift_templates t
      WHERE (ra.shift_template_id IS NOT NULL AND t.id = ra.shift_template_id)
         OR (ra.shift_template_id IS NULL AND t.is_active
             AND upper(t.code) = upper(ra.shift_code::text)
             AND (t.department_id = rw.department_id OR t.department_id IS NULL))
      ORDER BY (t.department_id = rw.department_id) DESC NULLS LAST
      LIMIT 1
    ) st ON true
    WHERE rw.status = 'published'
      AND (rw.week_start_date + ra.day_of_week)::date BETWEEN _from AND _to
  )
  INSERT INTO public.shift_instances (
    employee_id, department_id, shift_date, shift_code, shift_definition_id,
    sequence, scheduled_start, scheduled_end, crosses_midnight, source, created_by
  )
  SELECT
    employee_id, department_id, shift_date, shift_code, template_id, 1,
    CASE WHEN start_time IS NULL THEN NULL
         ELSE (shift_date + start_time) AT TIME ZONE 'Africa/Nairobi' END,
    CASE WHEN end_time IS NULL THEN NULL
         ELSE ((shift_date + CASE WHEN crosses_midnight THEN 1 ELSE 0 END) + end_time)
              AT TIME ZONE 'Africa/Nairobi' END,
    crosses_midnight, 'ROTA', auth.uid()
  FROM src
  ON CONFLICT (employee_id, shift_date, shift_code, sequence) DO UPDATE SET
    department_id = EXCLUDED.department_id,
    shift_definition_id = EXCLUDED.shift_definition_id,
    scheduled_start = EXCLUDED.scheduled_start,
    scheduled_end = EXCLUDED.scheduled_end,
    crosses_midnight = EXCLUDED.crosses_midnight,
    updated_at = now();

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN jsonb_build_object('status','ok','from',_from,'to',_to,'shifts',created);
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_shift_instances_from_rota(date, date) FROM anon;

-- Data feed for the calculation engine
CREATE OR REPLACE FUNCTION public.attendance_engine_input(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE shifts jsonb; punches jsonb; settings jsonb;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', si.id, 'employee_id', si.employee_id, 'department_id', si.department_id,
    'shift_date', si.shift_date, 'shift_code', si.shift_code, 'sequence', si.sequence,
    'scheduled_start', si.scheduled_start, 'scheduled_end', si.scheduled_end,
    'crosses_midnight', si.crosses_midnight,
    'grace_before_min', st.grace_before_min, 'grace_after_min', st.grace_after_min,
    'meal_break_minutes', st.meal_break_minutes, 'paid_break', st.paid_break,
    'min_ot_minutes', st.min_ot_minutes, 'ot_round_minutes', st.ot_round_minutes,
    'non_working', (upper(si.shift_code) IN ('OFF','O','REST'))
  )), '[]'::jsonb) INTO shifts
  FROM public.shift_instances si
  LEFT JOIN public.shift_templates st ON st.id = si.shift_definition_id
  WHERE si.shift_date BETWEEN _from AND _to;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'employee_id', p.employee_id,
    'punch_at', p.punch_at, 'punch_type', p.punch_type
  )), '[]'::jsonb) INTO punches
  FROM public.attendance_punches p
  WHERE p.punch_date BETWEEN (_from - 1) AND (_to + 1);

  SELECT jsonb_build_object(
    'lateThresholdMin', s.late_threshold_min, 'graceMin', s.grace_min,
    'minOtMin', s.min_ot_min, 'otRoundMin', s.ot_round_min,
    'maxDailyOtMin', s.max_daily_ot_min
  ) INTO settings FROM public.attendance_settings s WHERE s.id = true;

  RETURN jsonb_build_object('shifts', shifts, 'punches', punches,
    'settings', COALESCE(settings, '{}'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION public.attendance_engine_input(date, date) FROM anon;