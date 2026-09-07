-- Demo data for rota + overtime + payroll smoke test (idempotent).
-- Uses current ISO week and today as the OT test day.

DO $$
DECLARE
  dept_id uuid;
  tmpl_id uuid;
  week_id uuid;
  nurse_id uuid := gen_random_uuid();
  nurse_email text := 'nurse.demo@jalaram.co.ke';
  week_start date := date_trunc('week', current_date)::date;
  test_dow int := EXTRACT(ISODOW FROM current_date)::int - 1;
  test_date date := current_date;
  period_id uuid;
  super_id uuid;
  ot_result record;
BEGIN
  SELECT id INTO super_id FROM auth.users WHERE email = 'admin@jalaram.co.ke' LIMIT 1;
  IF super_id IS NULL THEN
    RAISE EXCEPTION 'Super admin not found — run seed-superadmin.sql first';
  END IF;

  INSERT INTO public.departments (name, code, description)
  VALUES ('Nursing Demo', 'NUR-DEMO', 'Demo department for rota/OT tests')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO dept_id;
  IF dept_id IS NULL THEN
    SELECT id INTO dept_id FROM public.departments WHERE code = 'NUR-DEMO';
  END IF;

  INSERT INTO public.shift_templates (
    name, code, department_id, start_time, end_time,
    expected_hours, meal_break_minutes, is_active
  ) VALUES (
    'Day Shift 8-18', 'DAY-8-18', dept_id, '08:00', '18:00', 8, 30, true
  )
  ON CONFLICT (code) DO UPDATE SET department_id = EXCLUDED.department_id
  RETURNING id INTO tmpl_id;
  IF tmpl_id IS NULL THEN
    SELECT id INTO tmpl_id FROM public.shift_templates WHERE code = 'DAY-8-18';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = nurse_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      nurse_id, 'authenticated', 'authenticated',
      nurse_email, crypt('DemoNurse2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Jane Demo Nurse', 'staff_id', 'NUR-001'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), nurse_id,
      jsonb_build_object('sub', nurse_id::text, 'email', nurse_email),
      'email', nurse_id::text, now(), now(), now()
    );
  ELSE
    SELECT id INTO nurse_id FROM auth.users WHERE email = nurse_email;
  END IF;

  UPDATE public.profiles
  SET full_name = 'Jane Demo Nurse',
      staff_id = 'NUR-001',
      basic_salary = 45000,
      house_allowance = 8000,
      kra_pin = 'A123456789Z',
      nssf_number = 'NS123456',
      is_active = true,
      hr_status = 'ACTIVE'
  WHERE id = nurse_id;

  UPDATE public.profiles
  SET basic_salary = COALESCE(basic_salary, 1),
      kra_pin = COALESCE(kra_pin, 'A000000000A')
  WHERE id = super_id;

  DELETE FROM public.user_roles WHERE user_id = nurse_id AND role = 'STAFF';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (nurse_id, 'STAFF')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.employee_departments (employee_id, department_id, is_primary)
  VALUES (nurse_id, dept_id, true)
  ON CONFLICT (employee_id, department_id) DO NOTHING;

  INSERT INTO public.rota_weeks (department_id, week_start_date, status, published_at, published_by)
  VALUES (dept_id, week_start, 'published', now(), super_id)
  ON CONFLICT (department_id, week_start_date) DO UPDATE
    SET status = 'published', published_at = now(), published_by = super_id
  RETURNING id INTO week_id;
  IF week_id IS NULL THEN
    SELECT id INTO week_id FROM public.rota_weeks
    WHERE department_id = dept_id AND week_start_date = week_start;
  END IF;

  INSERT INTO public.rota_assignments (rota_week_id, employee_id, day_of_week, shift_code, shift_template_id)
  VALUES (week_id, nurse_id, test_dow, 'D', tmpl_id)
  ON CONFLICT (rota_week_id, employee_id, day_of_week) DO UPDATE
    SET shift_code = 'D', shift_template_id = tmpl_id;

  DELETE FROM public.attendance_punches
  WHERE employee_id = nurse_id AND punch_date = test_date;

  INSERT INTO public.attendance_punches (employee_id, punch_at, punch_date, punch_type, source)
  VALUES
    (nurse_id, test_date + time '07:55', test_date, 'IN', 'BIOMETRIC'),
    (nurse_id, test_date + time '19:00', test_date, 'OUT', 'BIOMETRIC');

  PERFORM public.compute_attendance_range(test_date, test_date, nurse_id);

  UPDATE public.attendance_daily
  SET approval_status = 'APPROVED',
      approved_by = super_id,
      approved_at = now()
  WHERE employee_id = nurse_id AND work_date = test_date;

  SELECT ot_minutes, worked_minutes, status
  INTO ot_result
  FROM public.attendance_daily
  WHERE employee_id = nurse_id AND work_date = test_date;

  RAISE NOTICE 'OT test day %: status=%, worked=% min, ot=% min',
    test_date, ot_result.status, ot_result.worked_minutes, ot_result.ot_minutes;

  INSERT INTO public.payroll_settings (scope)
  VALUES ('GLOBAL')
  ON CONFLICT (scope) DO NOTHING;

  INSERT INTO public.payroll_periods (period_year, period_month, status, created_by)
  VALUES (
    EXTRACT(YEAR FROM current_date)::int,
    EXTRACT(MONTH FROM current_date)::int,
    'DRAFT',
    super_id
  )
  ON CONFLICT (period_year, period_month) DO NOTHING
  RETURNING id INTO period_id;

  IF period_id IS NULL THEN
    SELECT id INTO period_id FROM public.payroll_periods
    WHERE period_year = EXTRACT(YEAR FROM current_date)::int
      AND period_month = EXTRACT(MONTH FROM current_date)::int;
  END IF;

  UPDATE public.payroll_periods
  SET status = 'ATTENDANCE_LOCKED',
      attendance_locked_by = super_id,
      attendance_locked_at = now()
  WHERE id = period_id;

  PERFORM set_config('request.jwt.claim.sub', super_id::text, true);
  BEGIN
    PERFORM public.calculate_payroll(period_id);
    RAISE NOTICE 'Payroll period % calculated for nurse NUR-001', period_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Payroll calculation skipped: %', SQLERRM;
  END;
END $$;

SELECT
  p.staff_id,
  p.full_name,
  ad.work_date,
  ad.status,
  ad.worked_minutes,
  ad.ot_minutes,
  ad.approval_status
FROM public.attendance_daily ad
JOIN public.profiles p ON p.id = ad.employee_id
WHERE p.staff_id = 'NUR-001'
  AND ad.work_date = current_date;

SELECT
  p.staff_id,
  pli.code,
  pli.label,
  pli.amount
FROM public.payroll_line_items pli
JOIN public.payroll_runs pr ON pr.id = pli.run_id
JOIN public.payroll_periods pp ON pp.id = pr.period_id
JOIN public.profiles p ON p.id = pr.employee_id
WHERE p.staff_id = 'NUR-001'
  AND pp.period_year = EXTRACT(YEAR FROM current_date)::int
  AND pp.period_month = EXTRACT(MONTH FROM current_date)::int
  AND pli.code IN ('OT', 'BASIC')
ORDER BY pli.code;
