-- Overtime approval / rejection
CREATE OR REPLACE FUNCTION public.set_overtime_approval(
  _ids uuid[],
  _status public.overtime_status,
  _reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated int := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only HEAD, ADMIN or SUPER_ADMIN can decide overtime';
  END IF;
  IF _status NOT IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'Status must be APPROVED or REJECTED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_records
             WHERE id = ANY(_ids) AND employee_id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot decide your own overtime';
  END IF;

  UPDATE public.attendance_records SET
    overtime_status = _status,
    overtime_minutes = CASE WHEN _status = 'REJECTED' THEN 0 ELSE overtime_minutes END,
    overtime_reason = COALESCE(_reason, overtime_reason),
    overtime_approved_by = auth.uid(),
    overtime_approved_at = now(),
    updated_at = now()
  WHERE id = ANY(_ids);
  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object('status','ok','updated', updated, 'decision', _status);
END $$;

REVOKE EXECUTE ON FUNCTION public.set_overtime_approval(uuid[], public.overtime_status, text) FROM anon;

-- Manual correction of an attendance result (raw punches stay untouched)
CREATE OR REPLACE FUNCTION public.correct_attendance_record(
  _record_id uuid,
  _field text,
  _new_value text,
  _reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec RECORD; old_val text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can correct attendance';
  END IF;
  IF COALESCE(trim(_reason),'') = '' THEN
    RAISE EXCEPTION 'A reason is required for every correction';
  END IF;
  IF _field NOT IN ('actual_start','actual_end','worked_minutes','overtime_minutes','status') THEN
    RAISE EXCEPTION 'Field % cannot be corrected', _field;
  END IF;

  SELECT * INTO rec FROM public.attendance_records WHERE id = _record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance record not found'; END IF;

  old_val := CASE _field
    WHEN 'actual_start' THEN rec.actual_start::text
    WHEN 'actual_end' THEN rec.actual_end::text
    WHEN 'worked_minutes' THEN rec.worked_minutes::text
    WHEN 'overtime_minutes' THEN rec.overtime_minutes::text
    ELSE rec.status::text END;

  IF _field = 'actual_start' THEN
    UPDATE public.attendance_records SET actual_start = _new_value::timestamptz WHERE id = _record_id;
  ELSIF _field = 'actual_end' THEN
    UPDATE public.attendance_records SET actual_end = _new_value::timestamptz WHERE id = _record_id;
  ELSIF _field = 'worked_minutes' THEN
    UPDATE public.attendance_records SET worked_minutes = _new_value::int WHERE id = _record_id;
  ELSIF _field = 'overtime_minutes' THEN
    UPDATE public.attendance_records SET overtime_minutes = _new_value::int,
      overtime_status = CASE WHEN _new_value::int > 0 THEN 'PENDING_APPROVAL'::public.overtime_status
                             ELSE 'NONE'::public.overtime_status END
    WHERE id = _record_id;
  ELSE
    UPDATE public.attendance_records SET status = _new_value::public.attendance_result_status WHERE id = _record_id;
  END IF;

  UPDATE public.attendance_records
     SET is_corrected = true, updated_at = now()
   WHERE id = _record_id;

  INSERT INTO public.attendance_corrections (
    attendance_record_id, employee_id, shift_date, field_name,
    old_value, new_value, reason, corrected_by
  ) VALUES (
    _record_id, rec.employee_id, rec.shift_date, _field,
    old_val, _new_value, _reason, auth.uid()
  );

  RETURN jsonb_build_object('status','ok','record_id', _record_id, 'field', _field);
END $$;

REVOKE EXECUTE ON FUNCTION public.correct_attendance_record(uuid, text, text, text) FROM anon;