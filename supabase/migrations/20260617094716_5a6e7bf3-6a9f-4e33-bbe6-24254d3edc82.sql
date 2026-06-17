
-- 1) profiles: restrict SELECT to self or HEAD/ADMIN/SUPER_ADMIN
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or staff via role"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['HEAD'::app_role,'ADMIN'::app_role,'SUPER_ADMIN'::app_role])
);

-- 2) employee_departments: restrict broad SELECT
DROP POLICY IF EXISTS "Anyone can view employee departments" ON public.employee_departments;
CREATE POLICY "Users can view own or dept head/admin can view"
ON public.employee_departments FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_department_head(auth.uid(), department_id)
  OR public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role])
);

-- 3) invitations: rescope public -> authenticated
DROP POLICY IF EXISTS "Admin can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admin can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admin can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admin can view invitations" ON public.invitations;

CREATE POLICY "Admin can create invitations" ON public.invitations
FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

CREATE POLICY "Admin can delete invitations" ON public.invitations
FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

CREATE POLICY "Admin can update invitations" ON public.invitations
FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

CREATE POLICY "Admin can view invitations" ON public.invitations
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

-- 4) leave_entitlements: rescope public -> authenticated
DROP POLICY IF EXISTS "Admin can manage entitlements" ON public.leave_entitlements;
DROP POLICY IF EXISTS "Users can view own entitlements" ON public.leave_entitlements;

CREATE POLICY "Admin can manage entitlements" ON public.leave_entitlements
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

CREATE POLICY "Users can view own entitlements" ON public.leave_entitlements
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN'::app_role,'SUPER_ADMIN'::app_role]));

-- 5) Revoke EXECUTE on SECURITY DEFINER helpers from anon (keep for authenticated; RLS needs them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_department_head(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_head_departments(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calculate_used_leave_days(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_or_create_leave_entitlement(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_department_head(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_head_departments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_used_leave_days(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_leave_entitlement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) TO authenticated;
