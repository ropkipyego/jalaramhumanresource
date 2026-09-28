-- Live hotfix: PostgREST FK hints + self-hosted admin RPCs (skipped migration 20260724140000).
-- Safe to re-run (idempotent).

-- PostgREST embeds need named FKs (02-selfhost-compat dropped target/approved FKs).
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_target_id_fkey;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_requester_id_fkey;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_reviewed_by_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_swap_requests' AND column_name = 'target_id'
  ) THEN
    ALTER TABLE public.shift_swap_requests
      ADD CONSTRAINT shift_swap_requests_requester_id_fkey
      FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.shift_swap_requests
      ADD CONSTRAINT shift_swap_requests_target_id_fkey
      FOREIGN KEY (target_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_swap_requests' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE public.shift_swap_requests
      ADD CONSTRAINT shift_swap_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_swap_requests' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.shift_swap_requests
      ADD CONSTRAINT shift_swap_requests_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_category text NOT NULL DEFAULT 'NON_MEDICAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_staff_category_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_staff_category_check
      CHECK (staff_category IN ('MEDICAL', 'NON_MEDICAL'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Self-hosted password reset (hr.app_credentials + must_change_password) — no auth.users required.
CREATE OR REPLACE FUNCTION public.admin_reset_staff_password(
  _user_id uuid,
  _password text DEFAULT 'ChangeMe123!'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, hr
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Staff profile not found';
  END IF;

  UPDATE public.profiles
  SET must_change_password = true, is_active = true, updated_at = now()
  WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'via', 'profile_flags_only');
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_reset_staff_password(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_reset_staff_password(uuid, text) IS
  'Sets must_change_password on profile. Use NestJS POST /api/v1/staff/reset-password to set hr.app_credentials hash.';
