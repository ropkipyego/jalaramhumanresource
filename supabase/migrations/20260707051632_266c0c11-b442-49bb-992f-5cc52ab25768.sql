
-- Phase A: Time & Attendance foundations

-- 1) Shift Templates
CREATE TABLE public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department_id UUID NULL REFERENCES public.departments(id) ON DELETE SET NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  crosses_midnight BOOLEAN NOT NULL DEFAULT false,
  expected_hours NUMERIC(5,2) NOT NULL DEFAULT 8,
  grace_before_min INT NOT NULL DEFAULT 10,
  grace_after_min INT NOT NULL DEFAULT 10,
  min_ot_minutes INT NOT NULL DEFAULT 30,
  ot_round_minutes INT NOT NULL DEFAULT 15,
  meal_break_minutes INT NOT NULL DEFAULT 30,
  paid_break BOOLEAN NOT NULL DEFAULT false,
  is_night BOOLEAN NOT NULL DEFAULT false,
  is_weekend BOOLEAN NOT NULL DEFAULT false,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shift_templates TO authenticated;
GRANT ALL ON public.shift_templates TO service_role;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_templates_read_auth" ON public.shift_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_templates_write_admin" ON public.shift_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
GRANT INSERT, UPDATE, DELETE ON public.shift_templates TO authenticated;
CREATE TRIGGER trg_shift_templates_uat BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Public Holidays
CREATE TYPE public.holiday_scope AS ENUM ('NATIONAL','HOSPITAL','COUNTY','CUSTOM');
CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  scope public.holiday_scope NOT NULL DEFAULT 'NATIONAL',
  county TEXT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (holiday_date, name, scope)
);
GRANT SELECT ON public.public_holidays TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.public_holidays TO authenticated;
GRANT ALL ON public.public_holidays TO service_role;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_read_auth" ON public.public_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_write_admin" ON public.public_holidays FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));
CREATE TRIGGER trg_public_holidays_uat BEFORE UPDATE ON public.public_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Attendance Settings (singleton)
CREATE TABLE public.attendance_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  late_threshold_min INT NOT NULL DEFAULT 10,
  grace_min INT NOT NULL DEFAULT 5,
  min_ot_min INT NOT NULL DEFAULT 30,
  ot_round_min INT NOT NULL DEFAULT 15,
  max_daily_ot_min INT NOT NULL DEFAULT 240,
  max_monthly_ot_min INT NOT NULL DEFAULT 3600,
  night_start TIME NOT NULL DEFAULT '22:00',
  night_end TIME NOT NULL DEFAULT '06:00',
  night_diff_pct NUMERIC(5,2) NOT NULL DEFAULT 15,
  saturday_working BOOLEAN NOT NULL DEFAULT true,
  sunday_working BOOLEAN NOT NULL DEFAULT true,
  weekend_ot_pct NUMERIC(5,2) NOT NULL DEFAULT 150,
  weekend_allow_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  approval_levels INT NOT NULL DEFAULT 3,
  lock_after_payroll BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL
);
GRANT SELECT ON public.attendance_settings TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_settings_read_auth" ON public.attendance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "att_settings_write_super" ON public.attendance_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'SUPER_ADMIN'));
INSERT INTO public.attendance_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 4) Additive link on rota_assignments (keeps existing D/N/OFF/PH working)
ALTER TABLE public.rota_assignments
  ADD COLUMN IF NOT EXISTS shift_template_id UUID NULL REFERENCES public.shift_templates(id) ON DELETE SET NULL;

-- 5) Seed common Kenya national holidays (2026) - editable
INSERT INTO public.public_holidays (holiday_date, name, scope, is_paid) VALUES
  ('2026-01-01','New Year''s Day','NATIONAL',true),
  ('2026-04-03','Good Friday','NATIONAL',true),
  ('2026-04-06','Easter Monday','NATIONAL',true),
  ('2026-05-01','Labour Day','NATIONAL',true),
  ('2026-06-01','Madaraka Day','NATIONAL',true),
  ('2026-10-10','Huduma Day','NATIONAL',true),
  ('2026-10-20','Mashujaa Day','NATIONAL',true),
  ('2026-12-12','Jamhuri Day','NATIONAL',true),
  ('2026-12-25','Christmas Day','NATIONAL',true),
  ('2026-12-26','Boxing Day','NATIONAL',true)
ON CONFLICT DO NOTHING;

-- 6) Seed sample shift templates
INSERT INTO public.shift_templates (name, code, start_time, end_time, crosses_midnight, expected_hours, is_night) VALUES
  ('Day Shift','DAY','08:00','18:00',false,10,false),
  ('Night Shift','NIGHT','18:30','06:30',true,12,true),
  ('Morning','MORN','06:00','14:00',false,8,false),
  ('Afternoon','AFT','14:00','22:00',false,8,false)
ON CONFLICT (code) DO NOTHING;
