-- Security: force password change on first login / after go-live reset
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Mark existing users who likely have temporary passwords (optional — admin can clear)
-- UPDATE public.profiles SET must_change_password = true WHERE email ILIKE '%@jalaramhr.local';

-- When go-live resets passwords, edge function should set must_change_password = true
CREATE OR REPLACE FUNCTION public.set_must_change_password(_user_id uuid, _value boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
     AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  -- Staff may only clear their own flag after changing password
  IF auth.uid() = _user_id AND _value = true THEN
    RAISE EXCEPTION 'Staff cannot force their own password reset flag on';
  END IF;
  UPDATE public.profiles SET must_change_password = _value WHERE id = _user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_must_change_password(uuid, boolean) TO authenticated;
