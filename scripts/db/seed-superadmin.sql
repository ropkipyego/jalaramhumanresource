-- Wipe all users and create a single SUPER_ADMIN (run after migrations).
-- Substitute ${ADMIN_EMAIL} ${ADMIN_PASSWORD} ${ADMIN_NAME} ${STAFF_ID} via envsubst.

BEGIN;

ALTER TABLE public.profiles DISABLE TRIGGER USER;

DELETE FROM auth.identities;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM auth.users;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  admin_email text := '${ADMIN_EMAIL}';
  admin_password text := '${ADMIN_PASSWORD}';
  admin_name text := '${ADMIN_NAME}';
  v_staff_id text := '${STAFF_ID}';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    admin_email, crypt(admin_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', admin_name, 'staff_id', v_staff_id),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', admin_email),
    'email', new_user_id::text, now(), now(), now()
  );

  UPDATE public.profiles
  SET full_name = admin_name,
      staff_id = v_staff_id,
      is_active = true,
      hr_status = 'ACTIVE',
      must_change_password = false
  WHERE id = new_user_id;

  DELETE FROM public.user_roles WHERE user_id = new_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'SUPER_ADMIN');

  RAISE NOTICE 'Super admin created: % (staff_id %)', admin_email, v_staff_id;
END $$;

COMMIT;
