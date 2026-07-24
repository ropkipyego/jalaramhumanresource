-- Live-safe: timed day templates + soft offboard (keep records & audit)
-- Paste into Supabase SQL Editor and Run once.

-- 1) Common timed day templates (reception / housekeeping style)
-- Unique codes; attendance uses start_time when rota_assignments.shift_template_id is set.
INSERT INTO public.shift_templates (
  name, code, start_time, end_time, crosses_midnight, expected_hours,
  grace_before_min, grace_after_min, is_night, is_active
) VALUES
  ('Day 06:30', 'DAY_0630', '06:30', '15:30', false, 9, 10, 10, false, true),
  ('Day 07:00', 'DAY_0700', '07:00', '16:00', false, 9, 10, 10, false, true),
  ('Day 08:00', 'DAY_0800', '08:00', '17:00', false, 9, 10, 10, false, true),
  ('Day 09:00', 'DAY_0900', '09:00', '18:00', false, 9, 10, 10, false, true),
  ('Day 10:00', 'DAY_1000', '10:00', '19:00', false, 9, 10, 10, false, true)
ON CONFLICT (code) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  expected_hours = EXCLUDED.expected_hours,
  is_active = true;

-- 2) Soft offboard: never delete the person; keep audit; block login via is_active
CREATE OR REPLACE FUNCTION public.offboard_employee(_employee_id UUID, _reason TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp RECORD;
  admin_row RECORD;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can offboard employees';
  END IF;

  SELECT id, full_name, staff_id, hr_status, email, is_active INTO emp
  FROM public.profiles WHERE id = _employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF emp.hr_status = 'TERMINATED' THEN
    RAISE EXCEPTION 'Employee is already offboarded';
  END IF;

  -- Soft close only — profile row stays forever for history / payroll / audits
  UPDATE public.profiles
     SET hr_status = 'TERMINATED',
         is_active = false,
         offboarded_at = now(),
         offboarding_reason = _reason,
         updated_at = now()
   WHERE id = _employee_id;

  -- Soft-ban Auth login without deleting the Auth user (keeps id for FK history)
  BEGIN
    UPDATE auth.users
       SET banned_until = '2099-01-01 00:00:00+00',
           updated_at = now()
     WHERE id = _employee_id;
  EXCEPTION WHEN undefined_column OR OTHERS THEN
    NULL; -- App also blocks inactive profiles on login
  END;

  DELETE FROM public.employee_departments WHERE employee_id = _employee_id;

  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (auth.uid(), 'employee_offboarding', _employee_id, 'OFFBOARD',
          jsonb_build_object('hr_status', emp.hr_status, 'is_active', emp.is_active, 'email', emp.email),
          jsonb_build_object('hr_status', 'TERMINATED', 'is_active', false, 'reason', _reason));

  BEGIN
    PERFORM public.log_audit(
      'employee_offboarded',
      'profiles',
      _employee_id,
      jsonb_build_object('hr_status', emp.hr_status),
      jsonb_build_object('reason', _reason, 'staff_id', emp.staff_id, 'full_name', emp.full_name, 'hr_status', 'TERMINATED')
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  FOR admin_row IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('ADMIN','SUPER_ADMIN','HEAD')
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (admin_row.user_id, 'employee_offboarded',
            'Employee offboarded',
            emp.full_name || ' (' || emp.staff_id || ') has been offboarded. Reason: ' || COALESCE(_reason,'—'),
            '/staff/' || _employee_id,
            jsonb_build_object('employee_id', _employee_id, 'reason', _reason));
  END LOOP;

  RETURN jsonb_build_object('status','ok','employee_id', _employee_id, 'soft_delete', true);
END $$;

-- 3) Prevent hard-delete of profiles (accidental wipe)
CREATE OR REPLACE FUNCTION public.prevent_profile_hard_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete of staff profiles is not allowed. Use Offboard instead — history must be kept.';
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_profile_hard_delete ON public.profiles;
CREATE TRIGGER trg_prevent_profile_hard_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_hard_delete();
