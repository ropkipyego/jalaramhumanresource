-- Staff may fill statutory / bank / license; HR keeps salary & employment locks.
-- Also allow staff to upload their own documents.

CREATE OR REPLACE FUNCTION public.protect_profile_self_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN','FINANCE_ADMIN']::app_role[]);
  IF NOT is_admin AND auth.uid() = NEW.id THEN
    -- HR-owned / security — staff cannot change these
    NEW.staff_id          := OLD.staff_id;
    NEW.full_name         := OLD.full_name;
    NEW.email             := OLD.email;
    NEW.basic_salary      := OLD.basic_salary;
    NEW.house_allowance   := OLD.house_allowance;
    NEW.hr_status         := OLD.hr_status;
    NEW.employment_type   := OLD.employment_type;
    NEW.designation       := OLD.designation;
    NEW.date_joined       := OLD.date_joined;
    NEW.contract_end_date := OLD.contract_end_date;
    NEW.branch_id         := OLD.branch_id;
    NEW.position_id       := OLD.position_id;
    NEW.grade_id          := OLD.grade_id;
    NEW.manager_id        := OLD.manager_id;
    NEW.gender            := OLD.gender;
    NEW.date_of_birth     := OLD.date_of_birth;
    NEW.passport_no       := OLD.passport_no;
    NEW.probation_end_date:= OLD.probation_end_date;
    NEW.must_change_password := OLD.must_change_password;
    NEW.biometric_enroll_id := OLD.biometric_enroll_id;
    -- Allowed for staff (Phase 2+): national_id, kra_pin, nssf_number, shif_number,
    -- bank_*, practicing_license_no, license_expiry_date, phone, address, next_of_kin_*
  END IF;
  RETURN NEW;
END; $$;

-- Staff can insert/update/delete their own documents (My Profile / My Documents)
DROP POLICY IF EXISTS "docs_admin_write" ON public.employee_documents;
DROP POLICY IF EXISTS "docs_manage" ON public.employee_documents;
DROP POLICY IF EXISTS "docs_self_write" ON public.employee_documents;

CREATE POLICY "docs_self_write" ON public.employee_documents
  FOR ALL TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  );

-- Storage: staff folder = their user id
DROP POLICY IF EXISTS "docs_storage_insert" ON storage.objects;
CREATE POLICY "docs_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_any_role(auth.uid(), ARRAY['ADMIN','SUPER_ADMIN']::app_role[])
  ));
