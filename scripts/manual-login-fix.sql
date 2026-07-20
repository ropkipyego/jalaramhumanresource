-- ============================================================================
-- JALARAM HR — Bulk update login emails + optional password reset
-- Paste into Supabase → SQL Editor → Run each section separately
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0 — Export roster (run this first, copy results into Excel)
-- Fill a column "new_email" next to each person, then use STEP 1
-- ----------------------------------------------------------------------------
SELECT
  id AS user_id,
  staff_id,
  full_name,
  email AS current_email,
  hr_status,
  is_active
FROM public.profiles
WHERE COALESCE(hr_status, 'ACTIVE') = 'ACTIVE'
ORDER BY full_name;


-- ----------------------------------------------------------------------------
-- STEP 1 — Paste your email fixes below, then Run THIS whole block
-- Format: ('uuid-from-step-0', 'new.name@jalaram.co.ke'),
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE IF NOT EXISTS email_fixes (
  user_id uuid PRIMARY KEY,
  new_email text NOT NULL
);

TRUNCATE email_fixes;

INSERT INTO email_fixes (user_id, new_email) VALUES
  -- >>> REPLACE THESE EXAMPLE ROWS WITH YOUR REAL LIST <<<
  ('00000000-0000-0000-0000-000000000001', 'example1@jalaram.co.ke'),
  ('00000000-0000-0000-0000-000000000002', 'example2@jalaram.co.ke');
  -- Add more lines. Last line has NO trailing comma.

-- Normalize emails
UPDATE email_fixes SET new_email = lower(trim(new_email));

-- Safety checks (will stop if something is wrong)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM email_fixes WHERE new_email !~* '@jalaram\.co\.ke$') THEN
    RAISE EXCEPTION 'Every new_email must end with @jalaram.co.ke';
  END IF;

  IF EXISTS (
    SELECT new_email FROM email_fixes GROUP BY new_email HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate emails in your paste list';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN email_fixes f ON lower(p.email) = f.new_email AND p.id <> f.user_id
  ) THEN
    RAISE EXCEPTION 'A new email is already used by another staff profile';
  END IF;

  IF EXISTS (
    SELECT 1 FROM email_fixes f
    LEFT JOIN public.profiles p ON p.id = f.user_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more user_id values were not found in profiles';
  END IF;
END $$;

-- Update Auth login email
UPDATE auth.users u
SET
  email = f.new_email,
  email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
  raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('email', f.new_email),
  updated_at = now()
FROM email_fixes f
WHERE u.id = f.user_id;

-- Update email identity (needed for password login)
UPDATE auth.identities i
SET
  identity_data = COALESCE(i.identity_data, '{}'::jsonb)
    || jsonb_build_object('email', f.new_email, 'email_verified', true),
  updated_at = now()
FROM email_fixes f
WHERE i.user_id = f.user_id
  AND i.provider = 'email';

-- Update profile email shown in the app
UPDATE public.profiles p
SET email = f.new_email
FROM email_fixes f
WHERE p.id = f.user_id;

-- Show what changed
SELECT
  p.staff_id,
  p.full_name,
  p.email AS new_login_email,
  'OK' AS status
FROM public.profiles p
JOIN email_fixes f ON f.user_id = p.id
ORDER BY p.full_name;


-- ----------------------------------------------------------------------------
-- STEP 2 — Reset ALL active staff passwords to ChangeMe123!
-- Run AFTER emails are correct. Staff must change password on next login.
-- ----------------------------------------------------------------------------
/*
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users u
SET
  encrypted_password = crypt('ChangeMe123!', gen_salt('bf')),
  email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
  updated_at = now()
FROM public.profiles p
WHERE u.id = p.id
  AND p.is_active = true
  AND COALESCE(p.hr_status, 'ACTIVE') = 'ACTIVE';

UPDATE public.profiles
SET must_change_password = true
WHERE is_active = true
  AND COALESCE(hr_status, 'ACTIVE') = 'ACTIVE';
*/


-- ----------------------------------------------------------------------------
-- STEP 3 — Handout list (copy to Excel / WhatsApp privately)
-- ----------------------------------------------------------------------------
/*
SELECT
  staff_id,
  full_name,
  email AS login_email,
  'ChangeMe123!' AS temporary_password,
  'https://jalaramhumanresource.lovable.app' AS login_url
FROM public.profiles
WHERE is_active = true
  AND COALESCE(hr_status, 'ACTIVE') = 'ACTIVE'
ORDER BY full_name;
*/
