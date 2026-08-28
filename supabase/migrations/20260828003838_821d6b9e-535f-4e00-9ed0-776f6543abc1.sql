REVOKE EXECUTE ON FUNCTION public.import_attendance_punches(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_attendance_punches(jsonb, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_shift_instances_from_rota(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_shift_instances_from_rota(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.attendance_engine_input(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_engine_input(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_overtime_approval(uuid[], public.overtime_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_overtime_approval(uuid[], public.overtime_status, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.correct_attendance_record(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_attendance_record(uuid, text, text, text) TO authenticated;