
-- ============ Shift swaps ============
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN original_date TO requester_date;
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN swap_date TO target_date;
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN original_shift TO requester_shift;
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN swap_shift TO target_shift;
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN approved_by TO reviewed_by;
ALTER TABLE public.shift_swap_requests
  RENAME COLUMN approved_at TO reviewed_at;

ALTER TABLE public.shift_swap_requests
  ADD CONSTRAINT shift_swap_requests_target_id_fkey
  FOREIGN KEY (target_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ============ On-call slots ============
ALTER TABLE public.on_call_slots DROP COLUMN IF EXISTS start_time;
ALTER TABLE public.on_call_slots DROP COLUMN IF EXISTS end_time;
ALTER TABLE public.on_call_slots
  ADD COLUMN slot_date DATE,
  ADD COLUMN start_time TIME NOT NULL DEFAULT '18:00',
  ADD COLUMN end_time   TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
UPDATE public.on_call_slots SET slot_date = CURRENT_DATE WHERE slot_date IS NULL;
ALTER TABLE public.on_call_slots ALTER COLUMN slot_date SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_on_call_slots_date ON public.on_call_slots(slot_date);

-- ============ Training courses / employee training ============
ALTER TABLE public.training_courses RENAME COLUMN name TO title;
ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS cpd_points NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT true;

ALTER TABLE public.employee_training
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS cpd_points NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at DATE;

-- ============ Assets ============
ALTER TABLE public.assets RENAME COLUMN code TO asset_tag;
ALTER TABLE public.assets RENAME COLUMN category TO asset_type;

-- ============ Profiles: offboarding ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offboarding_reason TEXT;

-- ============ Offboarding function ============
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

  SELECT id, full_name, staff_id, hr_status INTO emp
  FROM public.profiles WHERE id = _employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF emp.hr_status = 'TERMINATED' THEN
    RAISE EXCEPTION 'Employee is already offboarded';
  END IF;

  UPDATE public.profiles
     SET hr_status = 'TERMINATED',
         is_active = false,
         offboarded_at = now(),
         offboarding_reason = _reason,
         updated_at = now()
   WHERE id = _employee_id;

  -- Remove department memberships so they no longer appear in rota lists
  DELETE FROM public.employee_departments WHERE employee_id = _employee_id;

  -- Audit trail
  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (auth.uid(), 'employee_offboarding', _employee_id, 'OFFBOARD',
          jsonb_build_object('hr_status', emp.hr_status),
          jsonb_build_object('hr_status', 'TERMINATED', 'reason', _reason));

  -- Notify all admins
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

  RETURN jsonb_build_object('status','ok','employee_id', _employee_id);
END $$;

GRANT EXECUTE ON FUNCTION public.offboard_employee(uuid, text) TO authenticated;

-- Bulk-map biometric enroll IDs
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
END $$;
GRANT EXECUTE ON FUNCTION public.bulk_map_biometric_ids(jsonb) TO authenticated;
