export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance_settings: {
        Row: {
          approval_levels: number
          grace_min: number
          id: boolean
          late_threshold_min: number
          lock_after_payroll: boolean
          max_daily_ot_min: number
          max_monthly_ot_min: number
          min_ot_min: number
          night_diff_pct: number
          night_end: string
          night_start: string
          ot_round_min: number
          saturday_working: boolean
          sunday_working: boolean
          updated_at: string
          updated_by: string | null
          weekend_allow_pct: number
          weekend_ot_pct: number
        }
        Insert: {
          approval_levels?: number
          grace_min?: number
          id?: boolean
          late_threshold_min?: number
          lock_after_payroll?: boolean
          max_daily_ot_min?: number
          max_monthly_ot_min?: number
          min_ot_min?: number
          night_diff_pct?: number
          night_end?: string
          night_start?: string
          ot_round_min?: number
          saturday_working?: boolean
          sunday_working?: boolean
          updated_at?: string
          updated_by?: string | null
          weekend_allow_pct?: number
          weekend_ot_pct?: number
        }
        Update: {
          approval_levels?: number
          grace_min?: number
          id?: boolean
          late_threshold_min?: number
          lock_after_payroll?: boolean
          max_daily_ot_min?: number
          max_monthly_ot_min?: number
          min_ot_min?: number
          night_diff_pct?: number
          night_end?: string
          night_start?: string
          ot_round_min?: number
          saturday_working?: boolean
          sunday_working?: boolean
          updated_at?: string
          updated_by?: string | null
          weekend_allow_pct?: number
          weekend_ot_pct?: number
        }
        Relationships: []
      }
      attendance_daily: {
        Row: {
          approval_status: Database["public"]["Enums"]["attendance_approval_status"]
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          computed_at: string
          early_leave_minutes: number
          employee_id: string
          expected_end: string | null
          expected_shift_code: string | null
          expected_start: string | null
          first_in: string | null
          holiday_minutes: number
          id: string
          last_out: string | null
          late_minutes: number
          night_minutes: number
          notes: string | null
          ot_minutes: number
          shift_template_id: string | null
          status: Database["public"]["Enums"]["attendance_day_status"]
          weekend_minutes: number
          work_date: string
          worked_minutes: number
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["attendance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          computed_at?: string
          early_leave_minutes?: number
          employee_id: string
          expected_end?: string | null
          expected_shift_code?: string | null
          expected_start?: string | null
          first_in?: string | null
          holiday_minutes?: number
          id?: string
          last_out?: string | null
          late_minutes?: number
          night_minutes?: number
          notes?: string | null
          ot_minutes?: number
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["attendance_day_status"]
          weekend_minutes?: number
          work_date: string
          worked_minutes?: number
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["attendance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          computed_at?: string
          early_leave_minutes?: number
          employee_id?: string
          expected_end?: string | null
          expected_shift_code?: string | null
          expected_start?: string | null
          first_in?: string | null
          holiday_minutes?: number
          id?: string
          last_out?: string | null
          late_minutes?: number
          night_minutes?: number
          notes?: string | null
          ot_minutes?: number
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["attendance_day_status"]
          weekend_minutes?: number
          work_date?: string
          worked_minutes?: number
        }
        Relationships: []
      }
      attendance_exceptions: {
        Row: {
          created_at: string
          daily_id: string | null
          description: string
          employee_id: string
          exception_type: Database["public"]["Enums"]["attendance_exception_type"]
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          work_date: string
        }
        Insert: {
          created_at?: string
          daily_id?: string | null
          description: string
          employee_id: string
          exception_type: Database["public"]["Enums"]["attendance_exception_type"]
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          work_date: string
        }
        Update: {
          created_at?: string
          daily_id?: string | null
          description?: string
          employee_id?: string
          exception_type?: Database["public"]["Enums"]["attendance_exception_type"]
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          work_date?: string
        }
        Relationships: []
      }
      attendance_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          error_rows: number
          errors_json: Json
          file_name: string
          id: string
          imported_by: string | null
          inserted_rows: number
          skipped_rows: number
          status: Database["public"]["Enums"]["import_batch_status"]
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_rows?: number
          errors_json?: Json
          file_name: string
          id?: string
          imported_by?: string | null
          inserted_rows?: number
          skipped_rows?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_rows?: number
          errors_json?: Json
          file_name?: string
          id?: string
          imported_by?: string | null
          inserted_rows?: number
          skipped_rows?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
        }
        Relationships: []
      }
      attendance_punches: {
        Row: {
          batch_id: string | null
          created_at: string
          device_id: string | null
          employee_id: string
          id: string
          notes: string | null
          punch_at: string
          punch_date: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          raw_staff_id: string | null
          source: Database["public"]["Enums"]["punch_source"]
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          device_id?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          punch_at: string
          punch_date: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          raw_staff_id?: string | null
          source?: Database["public"]["Enums"]["punch_source"]
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          device_id?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          punch_at?: string
          punch_date?: string
          punch_type?: Database["public"]["Enums"]["punch_type"]
          raw_staff_id?: string | null
          source?: Database["public"]["Enums"]["punch_source"]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_onboarding_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          employee_id: string
          id: string
          is_completed: boolean
          notes: string | null
          template_id: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          template_id?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          template_id?: string | null
          title?: string
        }
        Relationships: []
      }
      job_grades: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: number
          max_salary: number | null
          min_salary: number | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          max_salary?: number | null
          min_salary?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          max_salary?: number | null
          min_salary?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          address: string | null
          email: string | null
          id: boolean
          kra_pin: string | null
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: boolean
          kra_pin?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: boolean
          kra_pin?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          description: string | null
          grade_id: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          grade_id?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          grade_id?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_rules: {
        Row: {
          created_at: string
          department_id: string
          id: string
          max_consecutive_nights: number
          min_rest_hours: number
          min_staff_day: number
          min_staff_night: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          max_consecutive_nights?: number
          min_rest_hours?: number
          min_staff_day?: number
          min_staff_night?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          max_consecutive_nights?: number
          min_rest_hours?: number
          min_staff_day?: number
          min_staff_night?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_departments: {
        Row: {
          created_at: string
          department_id: string
          employee_id: string
          id: string
          is_head: boolean
          is_primary: boolean
        }
        Insert: {
          created_at?: string
          department_id: string
          employee_id: string
          id?: string
          is_head?: boolean
          is_primary?: boolean
        }
        Update: {
          created_at?: string
          department_id?: string
          employee_id?: string
          id?: string
          is_head?: boolean
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_departments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_entitlements: {
        Row: {
          annual_days: number
          created_at: string
          employee_id: string
          id: string
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          annual_days?: number
          created_at?: string
          employee_id: string
          id?: string
          updated_at?: string
          used_days?: number
          year?: number
        }
        Update: {
          annual_days?: number
          created_at?: string
          employee_id?: string
          id?: string
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_entitlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          department_id: string
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          department_id: string
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          department_id?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      payroll_line_items: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["payroll_line_kind"]
          label: string
          meta: Json | null
          run_id: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["payroll_line_kind"]
          label: string
          meta?: Json | null
          run_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payroll_line_kind"]
          label?: string
          meta?: Json | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          attendance_locked_at: string | null
          attendance_locked_by: string | null
          created_at: string
          created_by: string | null
          finance_approved_at: string | null
          finance_approved_by: string | null
          hr_reviewed_at: string | null
          hr_reviewed_by: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payroll_period_status"]
          updated_at: string
        }
        Insert: {
          attendance_locked_at?: string | null
          attendance_locked_by?: string | null
          created_at?: string
          created_by?: string | null
          finance_approved_at?: string | null
          finance_approved_by?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payroll_period_status"]
          updated_at?: string
        }
        Update: {
          attendance_locked_at?: string | null
          attendance_locked_by?: string | null
          created_at?: string
          created_by?: string | null
          finance_approved_at?: string | null
          finance_approved_by?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payroll_period_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          attendance_json: Json | null
          basic_salary: number | null
          computed_at: string | null
          created_at: string
          employee_id: string
          employer_contributions: number | null
          exclusion_reason: string | null
          gross_earnings: number | null
          id: string
          is_included: boolean
          net_pay: number | null
          period_id: string
          total_deductions: number | null
          updated_at: string
        }
        Insert: {
          attendance_json?: Json | null
          basic_salary?: number | null
          computed_at?: string | null
          created_at?: string
          employee_id: string
          employer_contributions?: number | null
          exclusion_reason?: string | null
          gross_earnings?: number | null
          id?: string
          is_included?: boolean
          net_pay?: number | null
          period_id: string
          total_deductions?: number | null
          updated_at?: string
        }
        Update: {
          attendance_json?: Json | null
          basic_salary?: number | null
          computed_at?: string | null
          created_at?: string
          employee_id?: string
          employer_contributions?: number | null
          exclusion_reason?: string | null
          gross_earnings?: number | null
          id?: string
          is_included?: boolean
          net_pay?: number | null
          period_id?: string
          total_deductions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          created_at: string
          holiday_multiplier: number
          id: string
          night_allowance_pct: number
          overtime_rate_multiplier: number
          scope: string
          standard_shift_hours: number
          updated_at: string
          updated_by: string | null
          weekend_allowance_pct: number
        }
        Insert: {
          created_at?: string
          holiday_multiplier?: number
          id?: string
          night_allowance_pct?: number
          overtime_rate_multiplier?: number
          scope?: string
          standard_shift_hours?: number
          updated_at?: string
          updated_by?: string | null
          weekend_allowance_pct?: number
        }
        Update: {
          created_at?: string
          holiday_multiplier?: number
          id?: string
          night_allowance_pct?: number
          overtime_rate_multiplier?: number
          scope?: string
          standard_shift_hours?: number
          updated_at?: string
          updated_by?: string | null
          weekend_allowance_pct?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number | null
          biometric_enroll_id: string | null
          branch_id: string | null
          contract_end_date: string | null
          created_at: string
          date_joined: string | null
          date_of_birth: string | null
          designation: string | null
          email: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          grade_id: string | null
          house_allowance: number
          hr_status: Database["public"]["Enums"]["hr_status"]
          id: string
          is_active: boolean
          kra_pin: string | null
          license_expiry_date: string | null
          manager_id: string | null
          national_id: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          nssf_number: string | null
          passport_no: string | null
          phone: string | null
          position_id: string | null
          practicing_license_no: string | null
          probation_end_date: string | null
          shif_number: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          branch_id?: string | null
          contract_end_date?: string | null
          created_at?: string
          date_joined?: string | null
          date_of_birth?: string | null
          designation?: string | null
          email: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          grade_id?: string | null
          house_allowance?: number
          hr_status?: Database["public"]["Enums"]["hr_status"]
          id: string
          is_active?: boolean
          kra_pin?: string | null
          license_expiry_date?: string | null
          manager_id?: string | null
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          nssf_number?: string | null
          passport_no?: string | null
          phone?: string | null
          position_id?: string | null
          practicing_license_no?: string | null
          probation_end_date?: string | null
          shif_number?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          branch_id?: string | null
          contract_end_date?: string | null
          created_at?: string
          date_joined?: string | null
          date_of_birth?: string | null
          designation?: string | null
          email?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          grade_id?: string | null
          house_allowance?: number
          hr_status?: Database["public"]["Enums"]["hr_status"]
          id?: string
          is_active?: boolean
          kra_pin?: string | null
          license_expiry_date?: string | null
          manager_id?: string | null
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          nssf_number?: string | null
          passport_no?: string | null
          phone?: string | null
          position_id?: string | null
          practicing_license_no?: string | null
          probation_end_date?: string | null
          shif_number?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          county: string | null
          created_at: string
          holiday_date: string
          id: string
          is_paid: boolean
          name: string
          notes: string | null
          scope: Database["public"]["Enums"]["holiday_scope"]
          updated_at: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          holiday_date: string
          id?: string
          is_paid?: boolean
          name: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["holiday_scope"]
          updated_at?: string
        }
        Update: {
          county?: string | null
          created_at?: string
          holiday_date?: string
          id?: string
          is_paid?: boolean
          name?: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["holiday_scope"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rota_assignments: {
        Row: {
          created_at: string
          day_of_week: number
          employee_id: string
          id: string
          notes: string | null
          rota_week_id: string
          shift_code: Database["public"]["Enums"]["shift_code"]
          shift_template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          employee_id: string
          id?: string
          notes?: string | null
          rota_week_id: string
          shift_code: Database["public"]["Enums"]["shift_code"]
          shift_template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          employee_id?: string
          id?: string
          notes?: string | null
          rota_week_id?: string
          shift_code?: Database["public"]["Enums"]["shift_code"]
          shift_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_rota_week_id_fkey"
            columns: ["rota_week_id"]
            isOneToOne: false
            referencedRelation: "rota_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_weeks: {
        Row: {
          created_at: string
          department_id: string
          id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["rota_status"]
          updated_at: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          updated_at?: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          updated_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_weeks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_weeks_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          code: string
          created_at: string
          crosses_midnight: boolean
          department_id: string | null
          end_time: string
          expected_hours: number
          grace_after_min: number
          grace_before_min: number
          id: string
          is_active: boolean
          is_holiday: boolean
          is_night: boolean
          is_weekend: boolean
          meal_break_minutes: number
          min_ot_minutes: number
          name: string
          ot_round_minutes: number
          paid_break: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          crosses_midnight?: boolean
          department_id?: string | null
          end_time: string
          expected_hours?: number
          grace_after_min?: number
          grace_before_min?: number
          id?: string
          is_active?: boolean
          is_holiday?: boolean
          is_night?: boolean
          is_weekend?: boolean
          meal_break_minutes?: number
          min_ot_minutes?: number
          name: string
          ot_round_minutes?: number
          paid_break?: boolean
          start_time: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          crosses_midnight?: boolean
          department_id?: string | null
          end_time?: string
          expected_hours?: number
          grace_after_min?: number
          grace_before_min?: number
          id?: string
          is_active?: boolean
          is_holiday?: boolean
          is_night?: boolean
          is_weekend?: boolean
          meal_break_minutes?: number
          min_ot_minutes?: number
          name?: string
          ot_round_minutes?: number
          paid_break?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_rates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          rate_type: Database["public"]["Enums"]["statutory_rate_type"]
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate_type: Database["public"]["Enums"]["statutory_rate_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate_type?: Database["public"]["Enums"]["statutory_rate_type"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_payroll: { Args: { _period_id: string }; Returns: Json }
      clock_punch: { Args: { _type?: Database["public"]["Enums"]["punch_type"] }; Returns: Json }
      compute_attendance_range: {
        Args: { _from: string; _to: string; _employee_id?: string | null }
        Returns: Json
      }
      import_attendance_punches: {
        Args: { _punches: Json; _file_name: string; _imported_by?: string }
        Returns: Json
      }
      calculate_used_leave_days: {
        Args: { _employee_id: string; _year?: number }
        Returns: number
      }
      derive_attendance: { Args: { _period_id: string }; Returns: Json }
      get_head_departments: { Args: { _user_id: string }; Returns: string[] }
      get_or_create_leave_entitlement: {
        Args: { _employee_id: string; _year?: number }
        Returns: {
          annual_days: number
          created_at: string
          employee_id: string
          id: string
          updated_at: string
          used_days: number
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_department_head: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      resolve_employee_by_identifier: { Args: { _id: string }; Returns: string }
      log_audit: {
        Args: {
          _action: string
          _new_data?: Json
          _old_data?: Json
          _record_id?: string
          _table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "STAFF" | "HEAD" | "ADMIN" | "SUPER_ADMIN" | "FINANCE_ADMIN"
      attendance_approval_status: "PENDING" | "APPROVED" | "REJECTED"
      attendance_day_status: "PRESENT" | "LATE" | "PARTIAL" | "ABSENT" | "ON_LEAVE" | "OFF" | "HOLIDAY"
      attendance_exception_type: "LATE" | "ABSENT" | "EARLY_LEAVE" | "MISSING_OUT" | "MISSING_IN" | "OT_PENDING" | "UNMATCHED_STAFF" | "DUPLICATE_PUNCH"
      import_batch_status: "PENDING" | "COMPLETED" | "FAILED"
      punch_source: "BIOMETRIC" | "MANUAL" | "WEB"
      punch_type: "IN" | "OUT"
      employment_type: "PERMANENT" | "CONTRACT" | "LOCUM" | "INTERN"
      gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
      holiday_scope: "NATIONAL" | "HOSPITAL" | "COUNTY" | "CUSTOM"
      hr_status: "ACTIVE" | "SUSPENDED" | "ON_LEAVE" | "TERMINATED"
      leave_status: "pending" | "approved" | "rejected" | "returned"
      leave_type:
        | "annual"
        | "sick"
        | "emergency"
        | "maternity"
        | "paternity"
        | "unpaid"
        | "other"
        | "compassionate"
        | "study"
      payroll_line_kind: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIB"
      payroll_period_status:
        | "DRAFT"
        | "ATTENDANCE_LOCKED"
        | "CALCULATED"
        | "HR_REVIEWED"
        | "FINANCE_APPROVED"
        | "LOCKED"
      rota_status: "draft" | "published"
      shift_code: "D" | "N" | "OFF" | "PH"
      statutory_rate_type:
        | "PAYE_BAND"
        | "NSSF_TIER1"
        | "NSSF_TIER2"
        | "SHIF"
        | "HOUSING_LEVY"
        | "PERSONAL_RELIEF"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["STAFF", "HEAD", "ADMIN", "SUPER_ADMIN", "FINANCE_ADMIN"],
      employment_type: ["PERMANENT", "CONTRACT", "LOCUM", "INTERN"],
      holiday_scope: ["NATIONAL", "HOSPITAL", "COUNTY", "CUSTOM"],
      hr_status: ["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"],
      leave_status: ["pending", "approved", "rejected", "returned"],
      leave_type: [
        "annual",
        "sick",
        "emergency",
        "maternity",
        "paternity",
        "unpaid",
        "other",
      ],
      payroll_line_kind: ["EARNING", "DEDUCTION", "EMPLOYER_CONTRIB"],
      payroll_period_status: [
        "DRAFT",
        "ATTENDANCE_LOCKED",
        "CALCULATED",
        "HR_REVIEWED",
        "FINANCE_APPROVED",
        "LOCKED",
      ],
      rota_status: ["draft", "published"],
      shift_code: ["D", "N", "OFF", "PH"],
      statutory_rate_type: [
        "PAYE_BAND",
        "NSSF_TIER1",
        "NSSF_TIER2",
        "SHIF",
        "HOUSING_LEVY",
        "PERSONAL_RELIEF",
      ],
    },
  },
} as const
