-- Portal account management WITHOUT Edge Functions
-- Paste into Supabase SQL Editor → Run once.
-- Enables: change login email, reset password, SUPER_ADMIN permanent purge.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Allow hard delete only when purge RPC sets this flag
CREATE OR REPLACE FUNCTION public.prevent_profile_hard_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.allow_profile_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hard delete of staff profiles is not allowed from the app. Use User Accounts → Purge (SUPER_ADMIN) or Offboard to keep history.';
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_profile_hard_delete ON public.profiles;
CREATE TRIGGER trg_prevent_profile_hard_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_hard_delete();

-- ---------------------------------------------------------------------------
-- 1) Change login email (Auth + profile) — ADMIN / SUPER_ADMIN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_staff_email(_user_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new text := lower(trim(_email));
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_any_role(_actor, ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can change login emails';
  END IF;
  IF _new IS NULL OR _new !~* '^[^@]+@jalaram\.co\.ke$' THEN
    RAISE EXCEPTION 'Email must be a valid @jalaram.co.ke address';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Staff profile not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = _new AND id <> _user_id) THEN
    RAISE EXCEPTION 'Email % is already used by another staff member', _new;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _new AND id <> _user_id) THEN
    RAISE EXCEPTION 'Email % is already used by another login account', _new;
  END IF;

  UPDATE auth.users
  SET
    email = _new,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', _new),
    updated_at = now()
  WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Auth login for this staff — create/invite the user first';
  END IF;

  UPDATE auth.identities
  SET
    identity_data = COALESCE(identity_data, '{}'::jsonb)
      || jsonb_build_object('email', _new, 'email_verified', true),
    updated_at = now()
  WHERE user_id = _user_id AND provider = 'email';

  UPDATE public.profiles SET email = _new, updated_at = now() WHERE id = _user_id;

  BEGIN
    PERFORM public.log_audit(
      'staff_email_corrected', 'profiles', _user_id,
      NULL, jsonb_build_object('email', _new, 'by', _actor)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'email', _new);
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_staff_email(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Reset password to ChangeMe123! + force change — ADMIN / SUPER_ADMIN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_staff_password(
  _user_id uuid,
  _password text DEFAULT 'ChangeMe123!'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _pwd text := COALESCE(nullif(trim(_password), ''), 'ChangeMe123!');
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_any_role(_actor, ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can reset passwords';
  END IF;
  IF length(_pwd) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'No Auth login for this staff';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(_pwd, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    updated_at = now()
  WHERE id = _user_id;

  UPDATE public.profiles
  SET must_change_password = true, is_active = true, updated_at = now()
  WHERE id = _user_id;

  BEGIN
    PERFORM public.log_audit(
      'password_reset_admin', 'auth.users', _user_id,
      NULL, jsonb_build_object('by', _actor)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'reset_count', 1);
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_reset_staff_password(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Permanent purge — SUPER_ADMIN only. Type DELETE to confirm.
--    Use for duplicate / mistaken accounts. Prefer Offboard for real leavers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_purge_staff(_user_id uuid, _confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  emp RECORD;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_actor, 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can permanently delete accounts';
  END IF;
  IF upper(trim(_confirm)) <> 'DELETE' THEN
    RAISE EXCEPTION 'Type DELETE to confirm permanent purge';
  END IF;
  IF _user_id = _actor THEN
    RAISE EXCEPTION 'You cannot purge your own account';
  END IF;

  SELECT id, staff_id, full_name, email, hr_status INTO emp
  FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found'; END IF;

  -- Audit before wipe
  BEGIN
    PERFORM public.log_audit(
      'staff_purged', 'profiles', _user_id,
      jsonb_build_object(
        'staff_id', emp.staff_id, 'full_name', emp.full_name,
        'email', emp.email, 'hr_status', emp.hr_status
      ),
      jsonb_build_object('purged_by', _actor, 'at', now())
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (
    _actor, 'employee_purge', _user_id, 'PURGE',
    jsonb_build_object('staff_id', emp.staff_id, 'email', emp.email, 'full_name', emp.full_name),
    jsonb_build_object('purged', true)
  );

  -- Detach lightweight memberships first
  DELETE FROM public.employee_departments WHERE employee_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;

  -- Allow profile delete for this transaction only
  PERFORM set_config('app.allow_profile_purge', 'on', true);

  BEGIN
    DELETE FROM public.profiles WHERE id = _user_id;
  EXCEPTION WHEN foreign_key_violation THEN
    -- Still referenced (payroll, attendance, etc.) — anonymize instead of fail
    UPDATE public.profiles SET
      full_name = '[Deleted] ' || COALESCE(emp.staff_id, left(_user_id::text, 8)),
      email = 'deleted+' || replace(_user_id::text, '-', '') || '@jalaram.co.ke',
      phone = NULL,
      is_active = false,
      hr_status = 'TERMINATED',
      must_change_password = false,
      offboarded_at = COALESCE(offboarded_at, now()),
      offboarding_reason = COALESCE(offboarding_reason, '') || ' | PURGED (history kept due to linked records)',
      updated_at = now()
    WHERE id = _user_id;

    BEGIN
      UPDATE auth.users
      SET
        email = 'deleted+' || replace(_user_id::text, '-', '') || '@jalaram.co.ke',
        banned_until = '2099-01-01 00:00:00+00',
        encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
        updated_at = now()
      WHERE id = _user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'mode', 'anonymized',
      'message', 'Account closed and anonymized — payroll/attendance history kept.'
    );
  END;

  -- Remove Auth user if profile fully deleted
  DELETE FROM auth.identities WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'purged',
    'message', 'Account permanently deleted.'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_purge_staff(uuid, text) TO authenticated;
