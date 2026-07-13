-- ============================================================
-- HRPMS Pro Modules: leave extensions, docs, loans, swaps,
-- recruitment, performance, training, assets, announcements
-- ============================================================

-- Leave type extensions (safe add)
DO $$ BEGIN
  ALTER TYPE public.leave_type ADD VALUE 'compassionate';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.leave_type ADD VALUE 'study';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Leave entitlement extensions
ALTER TABLE public.leave_entitlements
  ADD COLUMN IF NOT EXISTS carried_forward numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encashed_days numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_carry_forward numeric(6,2) NOT NULL DEFAULT 5;

-- Leave encashment requests
DO $$ BEGIN
  CREATE TYPE public.leave_encash_status AS ENUM ('pending','approved','rejected','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.leave_encashment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  days numeric(6,2) NOT NULL CHECK (days > 0),
  amount numeric(12,2),
  status public.leave_encash_status NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Employee documents
DO $$ BEGIN
  CREATE TYPE public.document_kind AS ENUM (
    'CV','CERTIFICATE','LICENSE','CONTRACT','PASSPORT','ID_COPY','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.document_kind NOT NULL DEFAULT 'OTHER',
  title text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  uploaded_by uuid REFERENCES public.profiles(id),
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Loans & advances
DO $$ BEGIN
  CREATE TYPE public.loan_type AS ENUM ('SALARY_ADVANCE','EMERGENCY','STAFF_LOAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.loan_status AS ENUM ('PENDING','APPROVED','ACTIVE','SETTLED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_type public.loan_type NOT NULL DEFAULT 'SALARY_ADVANCE',
  principal numeric(12,2) NOT NULL CHECK (principal > 0),
  interest_rate numeric(5,2) NOT NULL DEFAULT 0,
  monthly_deduction numeric(12,2) NOT NULL CHECK (monthly_deduction > 0),
  balance numeric(12,2) NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status public.loan_status NOT NULL DEFAULT 'PENDING',
  reason text,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Shift swap requests
DO $$ BEGIN
  CREATE TYPE public.swap_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  requester_date date NOT NULL,
  target_date date NOT NULL,
  requester_shift text,
  target_shift text,
  reason text,
  status public.swap_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- On-call schedule
CREATE TABLE IF NOT EXISTS public.on_call_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL DEFAULT '18:00',
  end_time time NOT NULL DEFAULT '08:00',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, employee_id, slot_date)
);

-- Recruitment
DO $$ BEGIN
  CREATE TYPE public.vacancy_status AS ENUM ('OPEN','CLOSED','FILLED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM (
    'APPLIED','SHORTLISTED','INTERVIEW','OFFERED','HIRED','REJECTED','WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  openings integer NOT NULL DEFAULT 1,
  description text,
  requirements text,
  status public.vacancy_status NOT NULL DEFAULT 'OPEN',
  posted_at date NOT NULL DEFAULT CURRENT_DATE,
  closes_at date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_path text,
  cover_letter text,
  status public.application_status NOT NULL DEFAULT 'APPLIED',
  interview_score numeric(5,2),
  interview_notes text,
  interview_date timestamptz,
  offer_salary numeric(12,2),
  hired_employee_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance reviews
DO $$ BEGIN
  CREATE TYPE public.review_period AS ENUM ('QUARTERLY','ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('DRAFT','SUBMITTED','ACKNOWLEDGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id),
  period_type public.review_period NOT NULL DEFAULT 'QUARTERLY',
  period_label text NOT NULL,
  goals text,
  achievements text,
  kpi_score numeric(5,2),
  supervisor_comments text,
  employee_comments text,
  promotion_recommended boolean NOT NULL DEFAULT false,
  status public.review_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Training & CPD
CREATE TABLE IF NOT EXISTS public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  provider text,
  is_internal boolean NOT NULL DEFAULT true,
  cpd_points numeric(6,2) NOT NULL DEFAULT 0,
  duration_hours numeric(6,2),
  description text,
  is_mandatory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.training_courses(id) ON DELETE SET NULL,
  course_title text NOT NULL,
  completed_at date,
  certificate_path text,
  cpd_points numeric(6,2) NOT NULL DEFAULT 0,
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Asset management
DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM (
    'LAPTOP','DESKTOP','TABLET','PHONE','UNIFORM','LOCKER_KEY','ACCESS_CARD','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.asset_status AS ENUM ('AVAILABLE','ASSIGNED','RETURNED','LOST','DAMAGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text NOT NULL UNIQUE,
  asset_type public.asset_type NOT NULL DEFAULT 'OTHER',
  name text NOT NULL,
  serial_number text,
  status public.asset_status NOT NULL DEFAULT 'AVAILABLE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT CURRENT_DATE,
  returned_at date,
  assigned_by uuid REFERENCES public.profiles(id),
  condition_out text,
  condition_in text,
  notes text
);

-- Announcements / communication
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_emergency boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Disciplinary records
CREATE TABLE IF NOT EXISTS public.disciplinary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text NOT NULL,
  action_taken text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket for employee documents (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS helpers
ALTER TABLE public.leave_encashment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_call_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;

-- Leave encashment
CREATE POLICY "encash_select" ON public.leave_encashment_requests FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "encash_insert" ON public.leave_encashment_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "encash_manage" ON public.leave_encashment_requests FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));

-- Documents
CREATE POLICY "docs_select" ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[]));
CREATE POLICY "docs_manage" ON public.employee_documents FOR ALL TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE POLICY "docs_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  ));
CREATE POLICY "docs_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  ));
CREATE POLICY "docs_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  ));

-- Loans
CREATE POLICY "loans_select" ON public.employee_loans FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "loans_insert_own" ON public.employee_loans FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "loans_manage" ON public.employee_loans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "repay_select" ON public.loan_repayments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_loans l WHERE l.id = loan_id AND (l.employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))));
CREATE POLICY "repay_manage" ON public.loan_repayments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));

-- Shift swaps
CREATE POLICY "swaps_select" ON public.shift_swap_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "swaps_insert" ON public.shift_swap_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "swaps_update" ON public.shift_swap_requests FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));

-- On-call
CREATE POLICY "oncall_select" ON public.on_call_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "oncall_manage" ON public.on_call_slots FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));

-- Recruitment
CREATE POLICY "vacancy_select" ON public.vacancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "vacancy_manage" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "applicant_select" ON public.applicants FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "applicant_manage" ON public.applicants FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Performance
CREATE POLICY "perf_select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR reviewer_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "perf_manage" ON public.performance_reviews FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) OR reviewer_id = auth.uid())
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]) OR reviewer_id = auth.uid());

-- Training
CREATE POLICY "courses_select" ON public.training_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_manage" ON public.training_courses FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "emp_train_select" ON public.employee_training FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "emp_train_manage" ON public.employee_training FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Assets
CREATE POLICY "assets_select" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_manage" ON public.assets FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "assign_select" ON public.asset_assignments FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "assign_manage" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Announcements
CREATE POLICY "ann_select" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_manage" ON public.announcements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Disciplinary
CREATE POLICY "disc_select" ON public.disciplinary_records FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD']::app_role[]));
CREATE POLICY "disc_manage" ON public.disciplinary_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- Triggers
CREATE TRIGGER update_employee_loans_updated_at BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vacancies_updated_at BEFORE UPDATE ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applicants_updated_at BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sample training courses
INSERT INTO public.training_courses (title, provider, is_internal, cpd_points, is_mandatory)
SELECT * FROM (VALUES
  ('Fire Safety & Evacuation', 'Hospital', true, 2::numeric, true),
  ('Infection Prevention & Control', 'Hospital', true, 3::numeric, true),
  ('BLS / CPR', 'External', false, 5::numeric, true),
  ('Customer Care', 'Hospital', true, 1::numeric, false)
) AS v(title, provider, is_internal, cpd_points, is_mandatory)
WHERE NOT EXISTS (SELECT 1 FROM public.training_courses t WHERE t.title = v.title);

-- Apply approved loan deductions + OT into payroll calculation
CREATE OR REPLACE FUNCTION public.calculate_payroll(_period_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD;
  attendance jsonb;
  emp jsonb;
  missing jsonb := '[]'::jsonb;
  paye_bands jsonb;
  personal_relief numeric := 2400;
  nssf1_rate numeric := 0.06; nssf1_upper numeric := 8000;
  nssf2_rate numeric := 0.06; nssf2_lower numeric := 8000; nssf2_upper numeric := 72000;
  shif_rate numeric := 0.0275; shif_min numeric := 300;
  hl_emp numeric := 0.015; hl_er numeric := 0.015;
  emp_id uuid;
  basic numeric; house_allow numeric; daily_rate numeric;
  night_pct numeric := 0.15; ph_mult numeric := 2.0; ot_mult numeric := 1.5;
  night_al numeric; ph_al numeric; unpaid_ded numeric; ot_pay numeric; loan_ded numeric;
  gross numeric; nssf1 numeric; nssf2 numeric; nssf_total numeric;
  shif numeric; hl_e numeric; hl_r numeric;
  taxable numeric; paye numeric := 0; band jsonb; prev_cap numeric; cap numeric; rate numeric; slice numeric;
  net numeric; run_id uuid;
  total_runs int := 0;
  ot_mins int; loan_rec RECORD;
  loan_deduct numeric; loan_new_bal numeric;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN can run payroll calculation';
  END IF;

  SELECT * INTO p FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF p.status NOT IN ('ATTENDANCE_LOCKED','CALCULATED') THEN
    RAISE EXCEPTION 'Period must be ATTENDANCE_LOCKED before calculation';
  END IF;

  SELECT config INTO paye_bands FROM public.statutory_rates
    WHERE rate_type='PAYE_BAND' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'monthly_kes')::numeric INTO personal_relief FROM public.statutory_rates
    WHERE rate_type='PERSONAL_RELIEF' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'upper')::numeric
    INTO nssf1_rate, nssf1_upper FROM public.statutory_rates
    WHERE rate_type='NSSF_TIER1' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'lower')::numeric, (config->>'upper')::numeric
    INTO nssf2_rate, nssf2_lower, nssf2_upper FROM public.statutory_rates
    WHERE rate_type='NSSF_TIER2' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'rate')::numeric, (config->>'min_kes')::numeric
    INTO shif_rate, shif_min FROM public.statutory_rates
    WHERE rate_type='SHIF' ORDER BY effective_from DESC LIMIT 1;
  SELECT (config->>'employee_rate')::numeric, (config->>'employer_rate')::numeric
    INTO hl_emp, hl_er FROM public.statutory_rates
    WHERE rate_type='HOUSING_LEVY' ORDER BY effective_from DESC LIMIT 1;

  SELECT overtime_rate_multiplier INTO ot_mult FROM public.payroll_settings LIMIT 1;
  ot_mult := COALESCE(ot_mult, 1.5);

  attendance := public.derive_attendance(_period_id);

  FOR emp IN SELECT * FROM jsonb_array_elements(attendance) LOOP
    IF (emp->>'basic_salary') IS NULL OR (emp->>'basic_salary')::numeric <= 0
       OR COALESCE(emp->>'kra_pin','') = '' THEN
      missing := missing || jsonb_build_object(
        'staff_id', emp->>'staff_id',
        'full_name', emp->>'full_name',
        'missing', CASE
          WHEN (emp->>'basic_salary') IS NULL OR (emp->>'basic_salary')::numeric <= 0
            THEN 'basic_salary' ELSE 'kra_pin' END
      );
    END IF;
  END LOOP;
  IF jsonb_array_length(missing) > 0 THEN
    RETURN jsonb_build_object('status','missing_data','missing', missing);
  END IF;

  DELETE FROM public.payroll_runs WHERE period_id = _period_id;

  FOR emp IN SELECT * FROM jsonb_array_elements(attendance) LOOP
    emp_id := (emp->>'employee_id')::uuid;
    basic  := (emp->>'basic_salary')::numeric;
    SELECT COALESCE(house_allowance,0) INTO house_allow FROM public.profiles WHERE id = emp_id;
    daily_rate  := basic / 30.0;
    night_al    := (emp->>'night_shifts')::int * daily_rate * night_pct;
    ph_al       := (emp->>'public_holidays_worked')::int * daily_rate * (ph_mult - 1);
    unpaid_ded  := (emp->>'unpaid_leave_days')::int * daily_rate;
    ot_mins     := COALESCE((emp->>'ot_minutes')::int, 0);
    ot_pay      := (ot_mins / 60.0) * (basic / 30.0 / 8.0) * ot_mult;

    loan_ded := 0;
    FOR loan_rec IN
      SELECT id, monthly_deduction, balance FROM public.employee_loans
      WHERE employee_id = emp_id AND status = 'ACTIVE' AND balance > 0
    LOOP
      loan_ded := loan_ded + LEAST(loan_rec.monthly_deduction, loan_rec.balance);
    END LOOP;

    gross := basic + house_allow + night_al + ph_al + ot_pay;

    nssf1 := LEAST(basic, nssf1_upper) * nssf1_rate;
    nssf2 := GREATEST(LEAST(basic, nssf2_upper) - nssf2_lower, 0) * nssf2_rate;
    nssf_total := nssf1 + nssf2;
    shif := GREATEST(gross * shif_rate, shif_min);
    hl_e := gross * hl_emp;
    hl_r := gross * hl_er;

    taxable := GREATEST(gross - nssf_total - shif - hl_e, 0);
    paye := 0; prev_cap := 0;
    FOR band IN SELECT jsonb_array_elements(COALESCE(paye_bands->'bands', '[]'::jsonb)) LOOP
      rate := (band->>'rate')::numeric;
      cap  := NULLIF(band->>'upto','')::numeric;
      IF cap IS NULL THEN
        slice := GREATEST(taxable - prev_cap, 0);
      ELSE
        slice := GREATEST(LEAST(taxable, cap) - prev_cap, 0);
      END IF;
      paye := paye + slice * rate;
      IF cap IS NULL OR taxable <= cap THEN EXIT; END IF;
      prev_cap := cap;
    END LOOP;
    paye := GREATEST(paye - personal_relief, 0);

    net := gross - paye - nssf_total - shif - hl_e - unpaid_ded - loan_ded;

    INSERT INTO public.payroll_runs (
      period_id, employee_id, basic_salary, gross_earnings,
      total_deductions, employer_contributions, net_pay,
      computed_at, attendance_json
    ) VALUES (
      _period_id, emp_id, basic, gross,
      (paye + nssf_total + shif + hl_e + unpaid_ded + loan_ded),
      (nssf_total + hl_r),
      net, now(), emp
    ) RETURNING id INTO run_id;

    INSERT INTO public.payroll_line_items(run_id, kind, code, label, amount) VALUES
      (run_id,'EARNING','BASIC','Basic Salary', basic),
      (run_id,'EARNING','HOUSE','House Allowance', house_allow),
      (run_id,'EARNING','NIGHT','Night Shift Allowance', night_al),
      (run_id,'EARNING','PH','Public Holiday Allowance', ph_al),
      (run_id,'EARNING','OT','Overtime Pay', ot_pay),
      (run_id,'DEDUCTION','PAYE','PAYE (Income Tax)', paye),
      (run_id,'DEDUCTION','NSSF','NSSF (Tier I + II)', nssf_total),
      (run_id,'DEDUCTION','SHIF','SHIF Contribution', shif),
      (run_id,'DEDUCTION','HOUSING','Affordable Housing Levy', hl_e),
      (run_id,'DEDUCTION','UNPAID_LEAVE','Unpaid Leave Deduction', unpaid_ded),
      (run_id,'DEDUCTION','LOAN','Loan / Advance Deduction', loan_ded),
      (run_id,'EMPLOYER_CONTRIB','NSSF_ER','NSSF Employer Match', nssf_total),
      (run_id,'EMPLOYER_CONTRIB','HOUSING_ER','Housing Levy Employer', hl_r);

    -- Apply loan repayments
    FOR loan_rec IN
      SELECT id, monthly_deduction, balance FROM public.employee_loans
      WHERE employee_id = emp_id AND status = 'ACTIVE' AND balance > 0
    LOOP
      loan_deduct := LEAST(loan_rec.monthly_deduction, loan_rec.balance);
      loan_new_bal := loan_rec.balance - loan_deduct;
      INSERT INTO public.loan_repayments (loan_id, period_id, amount, notes)
      VALUES (loan_rec.id, _period_id, loan_deduct, 'Payroll deduction');
      UPDATE public.employee_loans SET
        balance = loan_new_bal,
        status = CASE WHEN loan_new_bal <= 0 THEN 'SETTLED'::public.loan_status ELSE status END,
        updated_at = now()
      WHERE id = loan_rec.id;
    END LOOP;

    total_runs := total_runs + 1;
  END LOOP;

  UPDATE public.payroll_periods SET status = 'CALCULATED' WHERE id = _period_id;
  RETURN jsonb_build_object('status','ok','runs', total_runs);
END; $$;

GRANT EXECUTE ON FUNCTION public.calculate_payroll(uuid) TO authenticated;
