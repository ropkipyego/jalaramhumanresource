-- Non-destructive super-admin bootstrap WITHOUT auth schema (local/dev only).
-- Creates profile + SUPER_ADMIN role if missing. Does NOT delete users.
-- Set password separately: scripts/db/reset-admin-password.sh (uses Node bcrypt).

DO $$
DECLARE
  existing_id uuid;
  new_user_id uuid := gen_random_uuid();
  admin_email text := lower('${ADMIN_EMAIL}');
  admin_name text := '${ADMIN_NAME}';
  v_staff_id text := '${STAFF_ID}';
BEGIN
  SELECT id INTO existing_id FROM public.profiles WHERE lower(email) = admin_email LIMIT 1;

  IF existing_id IS NOT NULL THEN
    new_user_id := existing_id;
    UPDATE public.profiles
    SET full_name = admin_name,
        staff_id = v_staff_id,
        is_active = true,
        hr_status = 'ACTIVE',
        must_change_password = false
    WHERE id = new_user_id;
    RAISE NOTICE 'Updated existing profile for %', admin_email;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, staff_id, is_active, hr_status, must_change_password)
    VALUES (new_user_id, admin_email, admin_name, v_staff_id, true, 'ACTIVE', false);
    RAISE NOTICE 'Created profile for %', admin_email;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = new_user_id AND role = 'SUPER_ADMIN';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'SUPER_ADMIN')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
