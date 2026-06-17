
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name text;
  _staff_id text;
BEGIN
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _staff_id := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'staff_id',''),
    'AUTO-' || substr(NEW.id::text, 1, 8)
  );

  -- Ensure uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE staff_id = _staff_id) THEN
    _staff_id := 'AUTO-' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, staff_id)
  VALUES (NEW.id, NEW.email, _full_name, _staff_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'STAFF'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles using guaranteed-unique AUTO- staff_ids
INSERT INTO public.profiles (id, email, full_name, staff_id)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email,'@',1)),
  'AUTO-' || substr(au.id::text,1,8)
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Backfill default STAFF role for users missing any role
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'STAFF'::app_role
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
