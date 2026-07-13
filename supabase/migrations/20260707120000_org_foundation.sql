-- Phase 1 Foundation: Organization setup, positions, grades, employee extensions

DO $$ BEGIN
  CREATE TYPE public.gender AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Hospital / organization settings (singleton row)
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  name text NOT NULL DEFAULT 'Jalaram Hospital',
  logo_url text,
  kra_pin text,
  phone text,
  email text,
  address text,
  website text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.organization_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Job grades (salary bands)
CREATE TABLE IF NOT EXISTS public.job_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  level integer NOT NULL DEFAULT 1,
  min_salary numeric(12,2),
  max_salary numeric(12,2),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Positions
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text NOT NULL UNIQUE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Extended employee profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gender public.gender,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS probation_end_date date;

-- Onboarding checklist templates
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-employee onboarding progress
CREATE TABLE IF NOT EXISTS public.employee_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.onboarding_checklist_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, title)
);

INSERT INTO public.onboarding_checklist_templates (title, sort_order) VALUES
  ('Email Created', 1),
  ('ID Card Issued', 2),
  ('Fingerprint Registered', 3),
  ('Uniform Issued', 4),
  ('Laptop Issued', 5),
  ('Orientation Completed', 6)
ON CONFLICT (title) DO NOTHING;

-- updated_at triggers
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_grades_updated_at
  BEFORE UPDATE ON public.job_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Protect admin-only profile fields from self-service edits
CREATE OR REPLACE FUNCTION public.protect_profile_self_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]);
  IF NOT is_admin AND auth.uid() = NEW.id THEN
    NEW.staff_id          := OLD.staff_id;
    NEW.full_name         := OLD.full_name;
    NEW.email             := OLD.email;
    NEW.basic_salary      := OLD.basic_salary;
    NEW.hr_status         := OLD.hr_status;
    NEW.employment_type   := OLD.employment_type;
    NEW.designation       := OLD.designation;
    NEW.date_joined       := OLD.date_joined;
    NEW.contract_end_date := OLD.contract_end_date;
    NEW.house_allowance   := OLD.house_allowance;
    NEW.branch_id         := OLD.branch_id;
    NEW.position_id       := OLD.position_id;
    NEW.grade_id          := OLD.grade_id;
    NEW.manager_id        := OLD.manager_id;
    NEW.gender            := OLD.gender;
    NEW.date_of_birth     := OLD.date_of_birth;
    NEW.passport_no       := OLD.passport_no;
    NEW.probation_end_date:= OLD.probation_end_date;
  END IF;
  RETURN NEW;
END; $$;

-- RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view organization settings"
  ON public.organization_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage organization settings"
  ON public.organization_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Authenticated can view active branches"
  ON public.branches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage branches"
  ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Authenticated can view job grades"
  ON public.job_grades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage job grades"
  ON public.job_grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Authenticated can view positions"
  ON public.positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage positions"
  ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Authenticated can view onboarding templates"
  ON public.onboarding_checklist_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage onboarding templates"
  ON public.onboarding_checklist_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Staff can view own onboarding items"
  ON public.employee_onboarding_items FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[])
  );

CREATE POLICY "Admin can manage onboarding items"
  ON public.employee_onboarding_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Seed default branches
INSERT INTO public.branches (name, code, address) VALUES
  ('Nakuru', 'NKR', 'Nakuru Branch'),
  ('Nairobi', 'NBO', 'Nairobi Branch'),
  ('Kisumu', 'KSM', 'Kisumu Branch')
ON CONFLICT (code) DO NOTHING;

-- Seed sample job grades
INSERT INTO public.job_grades (name, code, level, min_salary, max_salary) VALUES
  ('Grade 1', 'G1', 1, 25000, 45000),
  ('Grade 2', 'G2', 2, 45000, 75000),
  ('Grade 3', 'G3', 3, 75000, 120000),
  ('Grade 4', 'G4', 4, 120000, 200000),
  ('Grade 5', 'G5', 5, 200000, 500000)
ON CONFLICT (code) DO NOTHING;
