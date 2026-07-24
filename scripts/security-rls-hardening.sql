-- Security linter fixes (RLS WITH CHECK, storage, anon exposure)
-- Paste into Supabase SQL Editor → Run once.
-- Safe for live: only policies / grants / small triggers.

-- ============================================================================
-- 1) employee_loans.loans_manage — add WITH CHECK matching USING
-- ============================================================================
DROP POLICY IF EXISTS "loans_manage" ON public.employee_loans;
CREATE POLICY "loans_manage" ON public.employee_loans
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]));

-- ============================================================================
-- 2) storage.objects — employee-documents SELECT / UPDATE / DELETE
-- ============================================================================
DROP POLICY IF EXISTS "docs_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "docs_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "docs_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "docs_storage_delete" ON storage.objects;

CREATE POLICY "docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
    )
  );

CREATE POLICY "docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
    )
  );

CREATE POLICY "docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
    )
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
    )
  );

CREATE POLICY "docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
    )
  );

-- ============================================================================
-- 3) performance_reviews.perf_write — tighten + lock employee_id / reviewer_id
-- ============================================================================
DROP POLICY IF EXISTS "perf_write" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_manage" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_insert" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_update" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_delete" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_admin_all" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_insert_reviewer" ON public.performance_reviews;
DROP POLICY IF EXISTS "perf_update_reviewer" ON public.performance_reviews;

CREATE POLICY "perf_admin_all" ON public.performance_reviews
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

CREATE POLICY "perf_insert_reviewer" ON public.performance_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[])
  );

CREATE POLICY "perf_update_reviewer" ON public.performance_reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_performance_review_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RETURN NEW;
  END IF;
  NEW.employee_id := OLD.employee_id;
  NEW.reviewer_id := OLD.reviewer_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_performance_review_keys ON public.performance_reviews;
CREATE TRIGGER trg_protect_performance_review_keys
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_performance_review_keys();

-- ============================================================================
-- 4) shift_swap_requests.swap_update — WITH CHECK + freeze parties
-- ============================================================================
DROP POLICY IF EXISTS "swap_update" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "swaps_update" ON public.shift_swap_requests;

CREATE POLICY "swap_update" ON public.shift_swap_requests
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[])
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['HEAD','ADMIN','SUPER_ADMIN']::app_role[])
  );

CREATE OR REPLACE FUNCTION public.protect_shift_swap_parties()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]) THEN
    RETURN NEW;
  END IF;
  NEW.requester_id := OLD.requester_id;
  NEW.target_id := OLD.target_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_shift_swap_parties ON public.shift_swap_requests;
CREATE TRIGGER trg_protect_shift_swap_parties
  BEFORE UPDATE ON public.shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_shift_swap_parties();

-- ============================================================================
-- 5) vacancies — authenticated only (no anon)
-- ============================================================================
DROP POLICY IF EXISTS "vac_read" ON public.vacancies;
DROP POLICY IF EXISTS "vac_write" ON public.vacancies;

CREATE POLICY "vac_read" ON public.vacancies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vac_write" ON public.vacancies
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[]));

REVOKE ALL ON TABLE public.vacancies FROM anon;
REVOKE ALL ON TABLE public.vacancies FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vacancies TO authenticated;

-- ============================================================================
-- 6) Revoke anon / PUBLIC table access (GraphQL + RLS anon lint)
-- ============================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm', 'f')
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tbl);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.tbl);
    EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','departments','employee_departments','rota_weeks','rota_assignments',
    'leave_requests','leave_entitlements','payroll_periods','payroll_lines','payroll_audit',
    'attendance_daily','attendance_punches','attendance_exceptions','shift_templates',
    'public_holidays','organization_settings','branches','positions','job_grades',
    'employee_documents','employee_loans','loan_repayments','shift_swap_requests',
    'performance_reviews','vacancies','applicants','notifications','audit_logs',
    'on_call_slots','announcements','assets','training_courses'
  ]
  LOOP
    BEGIN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 7) Revoke EXECUTE on public functions from anon (SECURITY DEFINER lint)
-- ============================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM PUBLIC;
