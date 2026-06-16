
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    test_email TEXT := 'testuser@jalaram.co.ke';
    test_password TEXT := 'TestUser2026!';
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = test_email) THEN
        RAISE NOTICE 'Test user already exists';
        RETURN;
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id, 'authenticated', 'authenticated',
        test_email, crypt(test_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Test User"}'::jsonb,
        now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', test_email),
        'email', new_user_id::text, now(), now(), now()
    );

    INSERT INTO public.profiles (id, email, full_name, staff_id)
    VALUES (new_user_id, test_email, 'Test User', 'TEST001')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'STAFF')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
