
-- =========================================================
-- PART 1: Harden existing functions (fix mutable search_path)
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
  END LOOP;
END $$;

-- =========================================================
-- PART 2: Helper role checks (reuse existing has_role/has_any_role)
-- =========================================================

-- =========================================================
-- PART 3: New tables
-- =========================================================

-- ---------- Branches ----------
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text, city text, phone text, email text,
  is_hq boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_read" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_write" ON public.branches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Organization Settings (singleton) ----------
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL DEFAULT 'Jalaram Hospital',
  legal_name text, kra_pin text, nssf_number text, shif_number text,
  address text, city text, country text DEFAULT 'Kenya',
  phone text, email text, website text, logo_url text,
  timezone text DEFAULT 'Africa/Nairobi',
  currency text DEFAULT 'KES',
  fiscal_year_start_month int DEFAULT 1,
  payroll_cutoff_day int DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.organization_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_write" ON public.organization_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'SUPER_ADMIN'));

-- ---------- Job Grades ----------
CREATE TABLE public.job_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  level int NOT NULL DEFAULT 1,
  min_salary numeric,
  max_salary numeric,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_grades TO authenticated;
GRANT ALL ON public.job_grades TO service_role;
ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grades_read" ON public.job_grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "grades_write" ON public.job_grades FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Positions ----------
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text UNIQUE NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_read" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "positions_write" ON public.positions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Employee Documents ----------
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text,
  file_url text,
  file_name text,
  issue_date date,
  expiry_date date,
  notes text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_self_read" ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "docs_admin_write" ON public.employee_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Onboarding checklists ----------
CREATE TABLE public.onboarding_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_checklist_templates TO authenticated;
GRANT ALL ON public.onboarding_checklist_templates TO service_role;
ALTER TABLE public.onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onb_tpl_read" ON public.onboarding_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "onb_tpl_write" ON public.onboarding_checklist_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.employee_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.onboarding_checklist_templates(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id),
  notes text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_onboarding_items TO authenticated;
GRANT ALL ON public.employee_onboarding_items TO service_role;
ALTER TABLE public.employee_onboarding_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onb_items_read" ON public.employee_onboarding_items FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "onb_items_write" ON public.employee_onboarding_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Attendance daily & exceptions ----------
CREATE TABLE public.attendance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  expected_shift text,
  shift_template_id uuid REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  worked_minutes int DEFAULT 0,
  late_minutes int DEFAULT 0,
  early_minutes int DEFAULT 0,
  overtime_minutes int DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  approval_status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  source text DEFAULT 'rota',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_daily TO authenticated;
GRANT ALL ON public.attendance_daily TO service_role;
ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_daily_read" ON public.attendance_daily FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "att_daily_write" ON public.attendance_daily FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  exception_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  description text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_exceptions TO authenticated;
GRANT ALL ON public.attendance_exceptions TO service_role;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_exc_read" ON public.attendance_exceptions FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "att_exc_write" ON public.attendance_exceptions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Shift swap requests ----------
CREATE TABLE public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  original_date date NOT NULL,
  original_shift text,
  swap_date date NOT NULL,
  swap_shift text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_swap_requests TO authenticated;
GRANT ALL ON public.shift_swap_requests TO service_role;
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap_read" ON public.shift_swap_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "swap_insert" ON public.shift_swap_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "swap_update" ON public.shift_swap_requests FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "swap_delete" ON public.shift_swap_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- On-call slots ----------
CREATE TABLE public.on_call_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.on_call_slots TO authenticated;
GRANT ALL ON public.on_call_slots TO service_role;
ALTER TABLE public.on_call_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oncall_read" ON public.on_call_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "oncall_write" ON public.on_call_slots FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Performance reviews ----------
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_period_start date NOT NULL,
  review_period_end date NOT NULL,
  overall_rating numeric,
  strengths text,
  areas_for_improvement text,
  goals text,
  employee_comments text,
  reviewer_comments text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_read" ON public.performance_reviews FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR reviewer_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "perf_write" ON public.performance_reviews FOR ALL TO authenticated
  USING (reviewer_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (reviewer_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Training ----------
CREATE TABLE public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  provider text,
  duration_hours numeric,
  is_mandatory boolean NOT NULL DEFAULT false,
  validity_months int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_courses TO authenticated;
GRANT ALL ON public.training_courses TO service_role;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_read" ON public.training_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "train_write" ON public.training_courses FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.employee_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.training_courses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'assigned',
  enrolled_date date,
  completion_date date,
  expiry_date date,
  score numeric,
  certificate_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_training TO authenticated;
GRANT ALL ON public.employee_training TO service_role;
ALTER TABLE public.employee_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp_train_read" ON public.employee_training FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "emp_train_write" ON public.employee_training FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Disciplinary ----------
CREATE TABLE public.disciplinary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES public.profiles(id),
  incident_date date NOT NULL,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'minor',
  description text NOT NULL,
  action_taken text,
  status text NOT NULL DEFAULT 'open',
  hearing_date date,
  resolution text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_records TO authenticated;
GRANT ALL ON public.disciplinary_records TO service_role;
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_read" ON public.disciplinary_records FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "disc_write" ON public.disciplinary_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Announcements ----------
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  priority text DEFAULT 'normal',
  published_by uuid REFERENCES public.profiles(id),
  published_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  target_departments uuid[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_write" ON public.announcements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Recruitment ----------
CREATE TABLE public.vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  description text,
  requirements text,
  location text,
  employment_type text DEFAULT 'permanent',
  headcount int DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  posted_date date,
  closing_date date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacancies TO authenticated;
GRANT ALL ON public.vacancies TO service_role;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vac_read" ON public.vacancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "vac_write" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid REFERENCES public.vacancies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  cv_url text,
  cover_letter text,
  status text NOT NULL DEFAULT 'new',
  rating numeric,
  notes text,
  applied_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_read" ON public.applicants FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "app_write" ON public.applicants FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Loans ----------
CREATE TABLE public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_type text NOT NULL DEFAULT 'salary_advance',
  principal_amount numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  term_months int NOT NULL DEFAULT 1,
  monthly_deduction numeric NOT NULL,
  outstanding_balance numeric NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'pending',
  purpose text,
  requested_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loans TO authenticated;
GRANT ALL ON public.employee_loans TO service_role;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_read" ON public.employee_loans FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "loans_insert_self" ON public.employee_loans FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "loans_manage" ON public.employee_loans FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "loans_delete" ON public.employee_loans FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  source text DEFAULT 'payroll',
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_repayments TO authenticated;
GRANT ALL ON public.loan_repayments TO service_role;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repay_read" ON public.loan_repayments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_loans l WHERE l.id = loan_id
    AND (l.employee_id = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))));
CREATE POLICY "repay_write" ON public.loan_repayments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));

-- ---------- Leave encashment ----------
CREATE TABLE public.leave_encashment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  days_requested numeric NOT NULL,
  amount numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  paid_in_period uuid REFERENCES public.payroll_periods(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_encashment_requests TO authenticated;
GRANT ALL ON public.leave_encashment_requests TO service_role;
ALTER TABLE public.leave_encashment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enc_read" ON public.leave_encashment_requests FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "enc_insert_self" ON public.leave_encashment_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "enc_manage" ON public.leave_encashment_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "enc_delete" ON public.leave_encashment_requests FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- Assets ----------
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  category text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric,
  condition text DEFAULT 'good',
  location text,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_read" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_write" ON public.assets FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  returned_date date,
  condition_out text,
  condition_in text,
  assigned_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_read" ON public.asset_assignments FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "aa_write" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- =========================================================
-- PART 4: updated_at triggers on all new tables that have that column
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'branches','organization_settings','job_grades','positions','employee_documents',
    'onboarding_checklist_templates','employee_onboarding_items','attendance_daily',
    'attendance_exceptions','shift_swap_requests','on_call_slots','performance_reviews',
    'training_courses','employee_training','disciplinary_records','announcements',
    'vacancies','applicants','employee_loans','leave_encashment_requests','assets',
    'asset_assignments'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_upd BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- =========================================================
-- PART 5: Seed defaults
-- =========================================================
INSERT INTO public.organization_settings (organization_name, country, currency, timezone)
VALUES ('Jalaram Hospital','Kenya','KES','Africa/Nairobi')
ON CONFLICT DO NOTHING;

INSERT INTO public.branches (name, code, city, is_hq, is_active) VALUES
  ('Head Office','HQ','Nairobi', true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.job_grades (name, code, level, min_salary, max_salary, description) VALUES
  ('Grade 1 - Support','G1',1,15000,30000,'Support and auxiliary staff'),
  ('Grade 2 - Junior','G2',2,25000,55000,'Junior technical/clinical'),
  ('Grade 3 - Mid','G3',3,50000,110000,'Mid-level professionals'),
  ('Grade 4 - Senior','G4',4,100000,220000,'Senior clinical/managerial'),
  ('Grade 5 - Lead','G5',5,200000,450000,'Department heads & consultants')
ON CONFLICT (code) DO NOTHING;
