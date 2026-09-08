-- Production public HR foundation (self-host variant).
-- Same as supabase/migrations/20260118142252 but WITHOUT auth.users FK on profiles/user_roles.
-- Safe on existing DB: only creates missing objects; does not touch hr.* tables.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('STAFF', 'HEAD', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'emergency', 'maternity', 'paternity', 'unpaid', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_code AS ENUM ('D', 'N', 'OFF', 'PH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rota_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Standalone UUID — matches hr.app_credentials.user_id (no auth.users row required)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    staff_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.employee_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_head BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (employee_id, department_id)
);

CREATE TABLE IF NOT EXISTS public.department_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL UNIQUE,
    min_staff_day INTEGER NOT NULL DEFAULT 2,
    min_staff_night INTEGER NOT NULL DEFAULT 1,
    max_consecutive_nights INTEGER NOT NULL DEFAULT 3,
    min_rest_hours INTEGER NOT NULL DEFAULT 11,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rota_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    week_start_date DATE NOT NULL,
    status public.rota_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (department_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS public.rota_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rota_week_id UUID REFERENCES public.rota_weeks(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    shift_code public.shift_code NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (rota_week_id, employee_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    leave_type public.leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status public.leave_status NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON public.profiles(staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_employee_departments_employee ON public.employee_departments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_departments_department ON public.employee_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_rota_weeks_department ON public.rota_weeks(department_id);
CREATE INDEX IF NOT EXISTS idx_rota_weeks_date ON public.rota_weeks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_rota_assignments_week ON public.rota_assignments(rota_week_id);
CREATE INDEX IF NOT EXISTS idx_rota_assignments_employee ON public.rota_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_department ON public.leave_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = ANY(_roles)
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY CASE role
        WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'HEAD' THEN 3 WHEN 'STAFF' THEN 4
    END
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_department_head(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.employee_departments
        WHERE employee_id = _user_id AND department_id = _department_id AND is_head = true
    )
$$;

CREATE OR REPLACE FUNCTION public.get_head_departments(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT department_id FROM public.employee_departments
    WHERE employee_id = _user_id AND is_head = true
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.employee_departments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.department_rules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.rota_weeks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.rota_assignments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policies (idempotent via drop + create)
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin can manage departments" ON public.departments;
CREATE POLICY "Super admin can manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admin and super admin can manage profiles" ON public.profiles;
CREATE POLICY "Admin and super admin can manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));
DROP POLICY IF EXISTS "Super admin can manage roles" ON public.user_roles;
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "Anyone can view employee departments" ON public.employee_departments;
CREATE POLICY "Anyone can view employee departments" ON public.employee_departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage employee departments" ON public.employee_departments;
CREATE POLICY "Admin can manage employee departments" ON public.employee_departments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));

DROP POLICY IF EXISTS "Heads admin can view department rules" ON public.department_rules;
CREATE POLICY "Heads admin can view department rules" ON public.department_rules FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD', 'ADMIN', 'SUPER_ADMIN']::public.app_role[]));
DROP POLICY IF EXISTS "Super admin can manage department rules" ON public.department_rules;
CREATE POLICY "Super admin can manage department rules" ON public.department_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "Staff can view own department rota weeks" ON public.rota_weeks;
CREATE POLICY "Staff can view own department rota weeks" ON public.rota_weeks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employee_departments ed
            WHERE ed.employee_id = auth.uid() AND ed.department_id = rota_weeks.department_id)
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[])
  );
DROP POLICY IF EXISTS "Heads can manage own department rota weeks" ON public.rota_weeks;
CREATE POLICY "Heads can manage own department rota weeks" ON public.rota_weeks FOR ALL TO authenticated
  USING (public.is_department_head(auth.uid(), department_id)
         OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  WITH CHECK (public.is_department_head(auth.uid(), department_id)
              OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));

DROP POLICY IF EXISTS "Staff can view own department assignments" ON public.rota_assignments;
CREATE POLICY "Staff can view own department assignments" ON public.rota_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_weeks rw
      JOIN public.employee_departments ed ON ed.department_id = rw.department_id
      WHERE rw.id = rota_assignments.rota_week_id AND ed.employee_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[])
  );
DROP POLICY IF EXISTS "Heads can manage own department assignments" ON public.rota_assignments;
CREATE POLICY "Heads can manage own department assignments" ON public.rota_assignments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rota_weeks rw
    WHERE rw.id = rota_assignments.rota_week_id
      AND (public.is_department_head(auth.uid(), rw.department_id)
           OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rota_weeks rw
    WHERE rw.id = rota_assignments.rota_week_id
      AND (public.is_department_head(auth.uid(), rw.department_id)
           OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  ));

DROP POLICY IF EXISTS "Staff can view own leave requests" ON public.leave_requests;
CREATE POLICY "Staff can view own leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
         OR public.is_department_head(auth.uid(), department_id)
         OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));
DROP POLICY IF EXISTS "Staff can create own leave requests" ON public.leave_requests;
CREATE POLICY "Staff can create own leave requests" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
DROP POLICY IF EXISTS "Staff can update own pending leave requests" ON public.leave_requests;
CREATE POLICY "Staff can update own pending leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING ((employee_id = auth.uid() AND status = 'pending')
         OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]))
  WITH CHECK ((employee_id = auth.uid() AND status = 'pending')
              OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));
DROP POLICY IF EXISTS "Staff can delete own pending leave requests" ON public.leave_requests;
CREATE POLICY "Staff can delete own pending leave requests" ON public.leave_requests FOR DELETE TO authenticated
  USING (employee_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Admin can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::public.app_role[]));
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_department_rules_updated_at ON public.department_rules;
CREATE TRIGGER update_department_rules_updated_at BEFORE UPDATE ON public.department_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_rota_weeks_updated_at ON public.rota_weeks;
CREATE TRIGGER update_rota_weeks_updated_at BEFORE UPDATE ON public.rota_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_rota_assignments_updated_at ON public.rota_assignments;
CREATE TRIGGER update_rota_assignments_updated_at BEFORE UPDATE ON public.rota_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
