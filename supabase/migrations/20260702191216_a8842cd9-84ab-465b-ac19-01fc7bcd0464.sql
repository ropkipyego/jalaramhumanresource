
-- Enums
DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('PERMANENT','CONTRACT','LOCUM','INTERN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_status AS ENUM ('ACTIVE','SUSPENDED','ON_LEAVE','TERMINATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_period_status AS ENUM (
    'DRAFT','ATTENDANCE_LOCKED','CALCULATED','HR_REVIEWED','FINANCE_APPROVED','LOCKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_line_kind AS ENUM ('EARNING','DEDUCTION','EMPLOYER_CONTRIB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.statutory_rate_type AS ENUM (
    'PAYE_BAND','NSSF_TIER1','NSSF_TIER2','SHIF','HOUSING_LEVY','PERSONAL_RELIEF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles compliance columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS kra_pin text,
  ADD COLUMN IF NOT EXISTS nssf_number text,
  ADD COLUMN IF NOT EXISTS shif_number text,
  ADD COLUMN IF NOT EXISTS practicing_license_no text,
  ADD COLUMN IF NOT EXISTS license_expiry_date date,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type,
  ADD COLUMN IF NOT EXISTS date_joined date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS basic_salary numeric(12,2),
  ADD COLUMN IF NOT EXISTS hr_status public.hr_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS address text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_kra_pin_unique
  ON public.profiles (kra_pin) WHERE kra_pin IS NOT NULL;

-- statutory_rates
CREATE TABLE IF NOT EXISTS public.statutory_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type public.statutory_rate_type NOT NULL,
  config jsonb NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS statutory_rates_type_from_idx
  ON public.statutory_rates (rate_type, effective_from DESC);
GRANT SELECT ON public.statutory_rates TO authenticated;
GRANT ALL ON public.statutory_rates TO service_role;
ALTER TABLE public.statutory_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statutory_rates_read_authenticated"
  ON public.statutory_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "statutory_rates_write_super_admin"
  ON public.statutory_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'SUPER_ADMIN'));
CREATE TRIGGER trg_statutory_rates_updated_at
  BEFORE UPDATE ON public.statutory_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payroll_settings
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE DEFAULT 'GLOBAL',
  standard_shift_hours numeric(5,2) NOT NULL DEFAULT 8,
  night_allowance_pct numeric(5,2) NOT NULL DEFAULT 15,
  weekend_allowance_pct numeric(5,2) NOT NULL DEFAULT 10,
  holiday_multiplier numeric(5,2) NOT NULL DEFAULT 2,
  overtime_rate_multiplier numeric(5,2) NOT NULL DEFAULT 1.5,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_settings_read" ON public.payroll_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_settings_write_super_admin" ON public.payroll_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'SUPER_ADMIN'));
CREATE TRIGGER trg_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payroll_periods
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status public.payroll_period_status NOT NULL DEFAULT 'DRAFT',
  notes text,
  attendance_locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attendance_locked_at timestamptz,
  hr_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hr_reviewed_at timestamptz,
  finance_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finance_approved_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_periods_read_admins"
  ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "payroll_periods_insert_admins"
  ON public.payroll_periods FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "payroll_periods_update_admins"
  ON public.payroll_periods FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE TRIGGER trg_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_payroll_sod()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'FINANCE_APPROVED' AND OLD.status IS DISTINCT FROM 'FINANCE_APPROVED' THEN
    IF NOT public.has_role(auth.uid(),'FINANCE_ADMIN') THEN
      RAISE EXCEPTION 'Only FINANCE_ADMIN may approve payroll (SoD)';
    END IF;
    IF NEW.hr_reviewed_by IS NOT NULL AND NEW.hr_reviewed_by = auth.uid() THEN
      RAISE EXCEPTION 'Segregation of duties: HR reviewer cannot also approve as Finance';
    END IF;
    NEW.finance_approved_by := auth.uid();
    NEW.finance_approved_at := now();
  END IF;
  IF NEW.status = 'HR_REVIEWED' AND OLD.status IS DISTINCT FROM 'HR_REVIEWED' THEN
    NEW.hr_reviewed_by := auth.uid();
    NEW.hr_reviewed_at := now();
  END IF;
  IF NEW.status = 'ATTENDANCE_LOCKED' AND OLD.status IS DISTINCT FROM 'ATTENDANCE_LOCKED' THEN
    NEW.attendance_locked_by := auth.uid();
    NEW.attendance_locked_at := now();
  END IF;
  IF NEW.status = 'LOCKED' AND OLD.status IS DISTINCT FROM 'LOCKED' THEN
    IF NOT public.has_role(auth.uid(),'SUPER_ADMIN') THEN
      RAISE EXCEPTION 'Only SUPER_ADMIN can finalise (LOCK) payroll';
    END IF;
    NEW.locked_by := auth.uid();
    NEW.locked_at := now();
  END IF;
  IF OLD.status = 'LOCKED' AND NEW.status <> 'LOCKED' THEN
    RAISE EXCEPTION 'Payroll period is LOCKED and immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payroll_periods_sod
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_sod();

-- payroll_runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  basic_salary numeric(12,2),
  gross_earnings numeric(12,2),
  total_deductions numeric(12,2),
  employer_contributions numeric(12,2),
  net_pay numeric(12,2),
  is_included boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);
CREATE INDEX IF NOT EXISTS payroll_runs_employee_idx ON public.payroll_runs(employee_id);
CREATE INDEX IF NOT EXISTS payroll_runs_period_idx ON public.payroll_runs(period_id);
GRANT SELECT ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_runs_read_own_or_admin"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[])
  );
CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payroll_line_items
CREATE TABLE IF NOT EXISTS public.payroll_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  kind public.payroll_line_kind NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_line_items_run_idx ON public.payroll_line_items(run_id);
GRANT SELECT ON public.payroll_line_items TO authenticated;
GRANT ALL ON public.payroll_line_items TO service_role;
ALTER TABLE public.payroll_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_line_items_read_own_or_admin"
  ON public.payroll_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs r
      WHERE r.id = payroll_line_items.run_id
        AND (
          r.employee_id = auth.uid()
          OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[])
        )
    )
  );

-- payroll_audit (append-only)
CREATE TABLE IF NOT EXISTS public.payroll_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_audit_entity_idx ON public.payroll_audit(entity_type, entity_id);
GRANT SELECT, INSERT ON public.payroll_audit TO authenticated;
GRANT ALL ON public.payroll_audit TO service_role;
ALTER TABLE public.payroll_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_audit_read_admins"
  ON public.payroll_audit FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "payroll_audit_insert_authenticated"
  ON public.payroll_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE OR REPLACE FUNCTION public.block_payroll_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'payroll_audit is append-only'; END; $$;
CREATE TRIGGER trg_block_payroll_audit_update
  BEFORE UPDATE OR DELETE ON public.payroll_audit
  FOR EACH ROW EXECUTE FUNCTION public.block_payroll_audit_mutation();

-- Audit triggers
CREATE OR REPLACE FUNCTION public.audit_payroll_periods()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (auth.uid(), 'payroll_period', COALESCE(NEW.id, OLD.id), TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_audit_payroll_periods
  AFTER INSERT OR UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.audit_payroll_periods();

CREATE OR REPLACE FUNCTION public.audit_profile_salary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.basic_salary IS DISTINCT FROM OLD.basic_salary THEN
    INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
    VALUES (auth.uid(), 'profile_salary', NEW.id, 'UPDATE',
      jsonb_build_object('basic_salary', OLD.basic_salary),
      jsonb_build_object('basic_salary', NEW.basic_salary));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_audit_profile_salary
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_salary();

CREATE OR REPLACE FUNCTION public.audit_statutory_rates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (auth.uid(), 'statutory_rate', COALESCE(NEW.id, OLD.id), TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_audit_statutory_rates
  AFTER INSERT OR UPDATE OR DELETE ON public.statutory_rates
  FOR EACH ROW EXECUTE FUNCTION public.audit_statutory_rates();

CREATE OR REPLACE FUNCTION public.audit_user_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payroll_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
  VALUES (auth.uid(), 'user_role', COALESCE(NEW.id, OLD.id), TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();

-- Seed statutory rates (Kenya 2024–2025) idempotently
INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'PAYE_BAND'::statutory_rate_type,
  jsonb_build_object('bands', jsonb_build_array(
    jsonb_build_object('upto', 24000, 'rate', 0.10),
    jsonb_build_object('upto', 32333, 'rate', 0.25),
    jsonb_build_object('upto', 500000, 'rate', 0.30),
    jsonb_build_object('upto', 800000, 'rate', 0.325),
    jsonb_build_object('upto', null,    'rate', 0.35)
  )),
  DATE '2024-07-01',
  'Kenya Finance Act 2023 PAYE bands. Editable by SUPER_ADMIN.'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='PAYE_BAND');

INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'PERSONAL_RELIEF', jsonb_build_object('monthly_kes', 2400), DATE '2024-07-01', 'KRA monthly personal relief'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='PERSONAL_RELIEF');

INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'NSSF_TIER1', jsonb_build_object('rate', 0.06, 'lower', 0, 'upper', 8000, 'employer_matches', true), DATE '2024-02-01', 'NSSF Act 2013 Tier I'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='NSSF_TIER1');

INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'NSSF_TIER2', jsonb_build_object('rate', 0.06, 'lower', 8000, 'upper', 72000, 'employer_matches', true), DATE '2025-02-01', 'NSSF Tier II (upper limit 72,000)'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='NSSF_TIER2');

INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'SHIF', jsonb_build_object('rate', 0.0275, 'min_kes', 300), DATE '2024-10-01', 'Social Health Insurance Fund (replaces NHIF)'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='SHIF');

INSERT INTO public.statutory_rates (rate_type, config, effective_from, notes)
SELECT 'HOUSING_LEVY', jsonb_build_object('employee_rate', 0.015, 'employer_rate', 0.015), DATE '2024-03-19', 'Affordable Housing Act 2024'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_rates WHERE rate_type='HOUSING_LEVY');

INSERT INTO public.payroll_settings (scope) VALUES ('GLOBAL')
ON CONFLICT (scope) DO NOTHING;
