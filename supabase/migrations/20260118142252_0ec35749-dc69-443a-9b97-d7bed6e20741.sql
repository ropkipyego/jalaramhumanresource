-- =============================================
-- HOSPITAL ROTA & LEAVE MANAGER DATABASE SCHEMA
-- =============================================

-- 1. Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('STAFF', 'HEAD', 'ADMIN', 'SUPER_ADMIN');

-- 2. Create leave_type enum
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'emergency', 'maternity', 'paternity', 'unpaid', 'other');

-- 3. Create leave_status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'returned');

-- 4. Create shift_code enum
CREATE TYPE public.shift_code AS ENUM ('D', 'N', 'OFF', 'PH');

-- 5. Create rota_status enum
CREATE TYPE public.rota_status AS ENUM ('draft', 'published');

-- =============================================
-- TABLES
-- =============================================

-- Departments table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Employee departments junction table (staff can belong to multiple departments)
CREATE TABLE public.employee_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_head BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (employee_id, department_id)
);

-- Department rules table
CREATE TABLE public.department_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL UNIQUE,
    min_staff_day INTEGER NOT NULL DEFAULT 2,
    min_staff_night INTEGER NOT NULL DEFAULT 1,
    max_consecutive_nights INTEGER NOT NULL DEFAULT 3,
    min_rest_hours INTEGER NOT NULL DEFAULT 11,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rota weeks table
CREATE TABLE public.rota_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    week_start_date DATE NOT NULL,
    status rota_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (department_id, week_start_date)
);

-- Rota assignments table
CREATE TABLE public.rota_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rota_week_id UUID REFERENCES public.rota_weeks(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    shift_code shift_code NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (rota_week_id, employee_id, day_of_week)
);

-- Leave requests table
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    leave_type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status leave_status NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_profiles_staff_id ON public.profiles(staff_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_employee_departments_employee ON public.employee_departments(employee_id);
CREATE INDEX idx_employee_departments_department ON public.employee_departments(department_id);
CREATE INDEX idx_rota_weeks_department ON public.rota_weeks(department_id);
CREATE INDEX idx_rota_weeks_date ON public.rota_weeks(week_start_date);
CREATE INDEX idx_rota_assignments_week ON public.rota_assignments(rota_week_id);
CREATE INDEX idx_rota_assignments_employee ON public.rota_assignments(employee_id);
CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_department ON public.leave_requests(department_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- =============================================
-- SECURITY DEFINER FUNCTIONS (for RLS)
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = ANY(_roles)
    )
$$;

-- Get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY 
        CASE role 
            WHEN 'SUPER_ADMIN' THEN 1 
            WHEN 'ADMIN' THEN 2 
            WHEN 'HEAD' THEN 3 
            WHEN 'STAFF' THEN 4 
        END
    LIMIT 1
$$;

-- Check if user is head of a specific department
CREATE OR REPLACE FUNCTION public.is_department_head(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employee_departments
        WHERE employee_id = _user_id
          AND department_id = _department_id
          AND is_head = true
    )
$$;

-- Get departments user is head of
CREATE OR REPLACE FUNCTION public.get_head_departments(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT department_id
    FROM public.employee_departments
    WHERE employee_id = _user_id
      AND is_head = true
$$;

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- DEPARTMENTS: All authenticated users can view
CREATE POLICY "Anyone can view departments"
    ON public.departments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Super admin can manage departments"
    ON public.departments FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
    WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- PROFILES: Users can view all profiles, edit their own
CREATE POLICY "Anyone can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Admin and super admin can manage profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]));

-- USER_ROLES: Only super admin can manage, users can view their own
CREATE POLICY "Users can view own role"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]));

CREATE POLICY "Super admin can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
    WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- EMPLOYEE_DEPARTMENTS: View based on role
CREATE POLICY "Anyone can view employee departments"
    ON public.employee_departments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin can manage employee departments"
    ON public.employee_departments FOR ALL
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]));

-- DEPARTMENT_RULES: Super admin manages, heads and admin can view
CREATE POLICY "Heads admin can view department rules"
    ON public.department_rules FOR SELECT
    TO authenticated
    USING (
        public.has_any_role(auth.uid(), ARRAY['HEAD', 'ADMIN', 'SUPER_ADMIN']::app_role[])
    );

CREATE POLICY "Super admin can manage department rules"
    ON public.department_rules FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
    WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- ROTA_WEEKS: Staff see own dept, heads manage own dept, admin sees all
CREATE POLICY "Staff can view own department rota weeks"
    ON public.rota_weeks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employee_departments
            WHERE employee_id = auth.uid()
              AND department_id = rota_weeks.department_id
        )
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    );

CREATE POLICY "Heads can manage own department rota weeks"
    ON public.rota_weeks FOR ALL
    TO authenticated
    USING (
        public.is_department_head(auth.uid(), department_id)
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    )
    WITH CHECK (
        public.is_department_head(auth.uid(), department_id)
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    );

-- ROTA_ASSIGNMENTS: Similar to rota_weeks
CREATE POLICY "Staff can view own department assignments"
    ON public.rota_assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rota_weeks rw
            JOIN public.employee_departments ed ON ed.department_id = rw.department_id
            WHERE rw.id = rota_assignments.rota_week_id
              AND ed.employee_id = auth.uid()
        )
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    );

CREATE POLICY "Heads can manage own department assignments"
    ON public.rota_assignments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rota_weeks rw
            WHERE rw.id = rota_assignments.rota_week_id
              AND (
                  public.is_department_head(auth.uid(), rw.department_id)
                  OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rota_weeks rw
            WHERE rw.id = rota_assignments.rota_week_id
              AND (
                  public.is_department_head(auth.uid(), rw.department_id)
                  OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
              )
        )
    );

-- LEAVE_REQUESTS: Staff see own, heads see dept, admin sees all
CREATE POLICY "Staff can view own leave requests"
    ON public.leave_requests FOR SELECT
    TO authenticated
    USING (
        employee_id = auth.uid()
        OR public.is_department_head(auth.uid(), department_id)
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    );

CREATE POLICY "Staff can create own leave requests"
    ON public.leave_requests FOR INSERT
    TO authenticated
    WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Staff can update own pending leave requests"
    ON public.leave_requests FOR UPDATE
    TO authenticated
    USING (
        (employee_id = auth.uid() AND status = 'pending')
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    )
    WITH CHECK (
        (employee_id = auth.uid() AND status = 'pending')
        OR public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[])
    );

CREATE POLICY "Staff can delete own pending leave requests"
    ON public.leave_requests FOR DELETE
    TO authenticated
    USING (employee_id = auth.uid() AND status = 'pending');

-- AUDIT_LOGS: Admin and super admin can view
CREATE POLICY "Admin can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['ADMIN', 'SUPER_ADMIN']::app_role[]));

CREATE POLICY "System can insert audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_department_rules_updated_at
    BEFORE UPDATE ON public.department_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rota_weeks_updated_at
    BEFORE UPDATE ON public.rota_weeks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rota_assignments_updated_at
    BEFORE UPDATE ON public.rota_assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();