-- Phase 1: Biometric Attendance & Overtime module schema

DO $$ BEGIN CREATE TYPE public.punch_source AS ENUM ('BIOMETRIC','MANUAL','WEB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.punch_type AS ENUM ('IN','OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.import_batch_status AS ENUM ('PENDING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_result_status AS ENUM (
    'PRESENT','LATE','EARLY_DEPARTURE','OVERTIME','MISSING_IN','MISSING_OUT',
    'NO_PUNCHES','ANOMALY','MANUAL_REVIEW','APPROVED','REJECTED','OFF','ON_LEAVE','HOLIDAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.overtime_status AS ENUM ('NONE','CALCULATED','PENDING_APPROVAL','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_enroll_id text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_biometric_enroll_id_unique
  ON public.profiles (biometric_enroll_id) WHERE biometric_enroll_id IS NOT NULL;

-- ---------- RAW LAYER ----------
CREATE TABLE IF NOT EXISTS public.attendance_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  source text NOT NULL DEFAULT 'ZKTECO',
  date_from date,
  date_to date,
  total_rows int NOT NULL DEFAULT 0,
  inserted_rows int NOT NULL DEFAULT 0,
  skipped_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  warning_count int NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.import_batch_status NOT NULL DEFAULT 'PENDING',
  imported_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_import_batches TO authenticated;
GRANT ALL ON public.attendance_import_batches TO service_role;
ALTER TABLE public.attendance_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_batches_select" ON public.attendance_import_batches FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "import_batches_manage" ON public.attendance_import_batches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  punch_at timestamptz NOT NULL,
  punch_date date NOT NULL,
  punch_time time,
  punch_type public.punch_type,
  source public.punch_source NOT NULL DEFAULT 'BIOMETRIC',
  device_id text,
  raw_value text,
  raw_staff_id text,
  batch_id uuid REFERENCES public.attendance_import_batches(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_punches_emp_at_unique
  ON public.attendance_punches (employee_id, punch_at);
CREATE INDEX IF NOT EXISTS idx_attendance_punches_employee_date
  ON public.attendance_punches (employee_id, punch_date);
CREATE INDEX IF NOT EXISTS idx_attendance_punches_date
  ON public.attendance_punches (punch_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_punches TO authenticated;
GRANT ALL ON public.attendance_punches TO service_role;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "punches_select" ON public.attendance_punches FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "punches_self_insert" ON public.attendance_punches FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE POLICY "punches_manage" ON public.attendance_punches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- SCHEDULE LAYER ----------
CREATE TABLE IF NOT EXISTS public.shift_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  shift_code text NOT NULL,
  shift_definition_id uuid REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  sequence int NOT NULL DEFAULT 1,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  crosses_midnight boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'ROTA',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_date, shift_code, sequence)
);
CREATE INDEX IF NOT EXISTS idx_shift_instances_date ON public.shift_instances (shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_instances_emp_date ON public.shift_instances (employee_id, shift_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_instances TO authenticated;
GRANT ALL ON public.shift_instances TO service_role;
ALTER TABLE public.shift_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_instances_select" ON public.shift_instances FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "shift_instances_manage" ON public.shift_instances FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE TRIGGER trg_shift_instances_updated BEFORE UPDATE ON public.shift_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- PROCESSING RUNS ----------
CREATE TABLE IF NOT EXISTS public.attendance_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  calculation_version int NOT NULL DEFAULT 1,
  engine_version text NOT NULL DEFAULT 'v1',
  shift_count int NOT NULL DEFAULT 0,
  record_count int NOT NULL DEFAULT 0,
  anomaly_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED',
  notes text,
  run_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_runs_period ON public.attendance_processing_runs (period_start, period_end);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_processing_runs TO authenticated;
GRANT ALL ON public.attendance_processing_runs TO service_role;
ALTER TABLE public.attendance_processing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_runs_select" ON public.attendance_processing_runs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "attendance_runs_manage" ON public.attendance_processing_runs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

-- ---------- DERIVED LAYER ----------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  shift_instance_id uuid REFERENCES public.shift_instances(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  shift_type text NOT NULL DEFAULT 'UNSCHEDULED',
  sequence int NOT NULL DEFAULT 1,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  worked_minutes int NOT NULL DEFAULT 0,
  scheduled_minutes int NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  early_departure_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  overtime_reason text,
  overtime_status public.overtime_status NOT NULL DEFAULT 'NONE',
  overtime_approved_by uuid REFERENCES public.profiles(id),
  overtime_approved_at timestamptz,
  status public.attendance_result_status NOT NULL DEFAULT 'NO_PUNCHES',
  anomaly_code text,
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_punch_ids uuid[] NOT NULL DEFAULT '{}',
  intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_corrected boolean NOT NULL DEFAULT false,
  calculation_version int NOT NULL DEFAULT 1,
  processing_run_id uuid REFERENCES public.attendance_processing_runs(id) ON DELETE SET NULL,
  source_import_id uuid REFERENCES public.attendance_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_date, shift_type, sequence)
);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records (shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_date ON public.attendance_records (employee_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records (status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_ot ON public.attendance_records (overtime_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_records_select" ON public.attendance_records FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "attendance_records_manage" ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE TRIGGER trg_attendance_records_updated BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  corrected_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_record ON public.attendance_corrections (attendance_record_id);
GRANT SELECT, INSERT ON public.attendance_corrections TO authenticated;
GRANT ALL ON public.attendance_corrections TO service_role;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_corrections_select" ON public.attendance_corrections FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','HEAD','FINANCE_ADMIN']::app_role[]));
CREATE POLICY "attendance_corrections_insert" ON public.attendance_corrections FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));