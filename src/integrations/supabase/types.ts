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
      announcements: {
        Row: {
          body: string
          category: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string | null
          published_at: string | null
          published_by: string | null
          target_departments: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          published_at?: string | null
          published_by?: string | null
          target_departments?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          published_at?: string | null
          published_by?: string | null
          target_departments?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      applicants: {
        Row: {
          applied_at: string | null
          cover_letter: string | null
          created_at: string
          cv_url: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          rating: number | null
          status: string
          updated_at: string
          vacancy_id: string | null
        }
        Insert: {
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
          vacancy_id?: string | null
        }
        Update: {
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
          vacancy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicants_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_by: string | null
          assigned_date: string
          condition_in: string | null
          condition_out: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          returned_date: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          assigned_by?: string | null
          assigned_date?: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          returned_date?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          assigned_by?: string | null
          assigned_date?: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          returned_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: string | null
          code: string | null
          condition: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          condition?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          condition?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_daily: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          early_minutes: number | null
          employee_id: string
          expected_shift_code: string | null
          first_in: string | null
          id: string
          last_out: string | null
          late_minutes: number | null
          notes: string | null
          ot_minutes: number | null
          shift_template_id: string | null
          source: string | null
          status: string
          updated_at: string
          work_date: string
          worked_minutes: number | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          early_minutes?: number | null
          employee_id: string
          expected_shift_code?: string | null
          first_in?: string | null
          id?: string
          last_out?: string | null
          late_minutes?: number | null
          notes?: string | null
          ot_minutes?: number | null
          shift_template_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          work_date: string
          worked_minutes?: number | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          early_minutes?: number | null
          employee_id?: string
          expected_shift_code?: string | null
          first_in?: string | null
          id?: string
          last_out?: string | null
          late_minutes?: number | null
          notes?: string | null
          ot_minutes?: number | null
          shift_template_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          work_date?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_daily_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_daily_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exceptions: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          exception_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          exception_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          exception_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_hq: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_hq?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_hq?: boolean
          name?: string
          phone?: string | null
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
      disciplinary_records: {
        Row: {
          action_taken: string | null
          attachment_url: string | null
          category: string
          created_at: string
          description: string
          employee_id: string
          hearing_date: string | null
          id: string
          incident_date: string
          issued_by: string | null
          resolution: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          attachment_url?: string | null
          category: string
          created_at?: string
          description: string
          employee_id: string
          hearing_date?: string | null
          id?: string
          incident_date: string
          issued_by?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          attachment_url?: string | null
          category?: string
          created_at?: string
          description?: string
          employee_id?: string
          hearing_date?: string | null
          id?: string
          incident_date?: string
          issued_by?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      employee_documents: {
        Row: {
          created_at: string
          doc_type: string
          employee_id: string
          expiry_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          notes: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          employee_id: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          interest_rate: number | null
          loan_type: string
          monthly_deduction: number
          outstanding_balance: number
          principal_amount: number
          purpose: string | null
          requested_at: string | null
          start_date: string
          status: string
          term_months: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          loan_type?: string
          monthly_deduction: number
          outstanding_balance: number
          principal_amount: number
          purpose?: string | null
          requested_at?: string | null
          start_date: string
          status?: string
          term_months?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          loan_type?: string
          monthly_deduction?: number
          outstanding_balance?: number
          principal_amount?: number
          purpose?: string | null
          requested_at?: string | null
          start_date?: string
          status?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          is_completed: boolean
          item_name: string | null
          notes: string | null
          status: string
          template_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          is_completed?: boolean
          item_name?: string | null
          notes?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          is_completed?: boolean
          item_name?: string | null
          notes?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_training: {
        Row: {
          certificate_url: string | null
          completion_date: string | null
          course_id: string | null
          created_at: string
          employee_id: string
          enrolled_date: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          certificate_url?: string | null
          completion_date?: string | null
          course_id?: string | null
          created_at?: string
          employee_id: string
          enrolled_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_url?: string | null
          completion_date?: string | null
          course_id?: string | null
          created_at?: string
          employee_id?: string
          enrolled_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_training_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_training_employee_id_fkey"
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
      leave_encashment_requests: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_requested: number
          employee_id: string
          id: string
          paid_in_period: string | null
          reason: string | null
          requested_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested: number
          employee_id: string
          id?: string
          paid_in_period?: string | null
          reason?: string | null
          requested_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested?: number
          employee_id?: string
          id?: string
          paid_in_period?: string | null
          reason?: string | null
          requested_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_encashment_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_encashment_requests_paid_in_period_fkey"
            columns: ["paid_in_period"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
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
      loan_repayments: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
          recorded_by: string | null
          source: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          loan_id: string
          notes?: string | null
          payment_date: string
          recorded_by?: string | null
          source?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
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
      on_call_slots: {
        Row: {
          created_at: string
          department_id: string | null
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_call_slots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_slots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_templates: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          items: Json
          name: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          fiscal_year_start_month: number | null
          id: string
          kra_pin: string | null
          legal_name: string | null
          logo_url: string | null
          name: string | null
          nssf_number: string | null
          organization_name: string
          payroll_cutoff_day: number | null
          phone: string | null
          shif_number: string | null
          timezone: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start_month?: number | null
          id?: string
          kra_pin?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string | null
          nssf_number?: string | null
          organization_name?: string
          payroll_cutoff_day?: number | null
          phone?: string | null
          shif_number?: string | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start_month?: number | null
          id?: string
          kra_pin?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string | null
          nssf_number?: string | null
          organization_name?: string
          payroll_cutoff_day?: number | null
          phone?: string | null
          shif_number?: string | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
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
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          areas_for_improvement: string | null
          created_at: string
          employee_comments: string | null
          employee_id: string
          goals: string | null
          id: string
          overall_rating: number | null
          review_period_end: string
          review_period_start: string
          reviewer_comments: string | null
          reviewer_id: string | null
          status: string
          strengths: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          employee_comments?: string | null
          employee_id: string
          goals?: string | null
          id?: string
          overall_rating?: number | null
          review_period_end: string
          review_period_start: string
          reviewer_comments?: string | null
          reviewer_id?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          employee_comments?: string | null
          employee_id?: string
          goals?: string | null
          id?: string
          overall_rating?: number | null
          review_period_end?: string
          review_period_start?: string
          reviewer_comments?: string | null
          reviewer_id?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "job_grades"
            referencedColumns: ["id"]
          },
        ]
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
          gender: string | null
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
          biometric_enroll_id?: string | null
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
          gender?: string | null
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
          biometric_enroll_id?: string | null
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
          gender?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "job_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
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
      shift_swap_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department_id: string | null
          id: string
          original_date: string
          original_shift: string | null
          reason: string | null
          requester_id: string
          status: string
          swap_date: string
          swap_shift: string | null
          target_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          original_date: string
          original_shift?: string | null
          reason?: string | null
          requester_id: string
          status?: string
          swap_date: string
          swap_shift?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          original_date?: string
          original_shift?: string | null
          reason?: string | null
          requester_id?: string
          status?: string
          swap_date?: string
          swap_shift?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
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
      training_courses: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
          provider: string | null
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
          provider?: string | null
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
          provider?: string | null
          updated_at?: string
          validity_months?: number | null
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
      vacancies: {
        Row: {
          closing_date: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          employment_type: string | null
          headcount: number | null
          id: string
          location: string | null
          position_id: string | null
          posted_date: string | null
          requirements: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          headcount?: number | null
          id?: string
          location?: string | null
          position_id?: string | null
          posted_date?: string | null
          requirements?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          headcount?: number | null
          id?: string
          location?: string | null
          position_id?: string | null
          posted_date?: string | null
          requirements?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_payroll: { Args: { _period_id: string }; Returns: Json }
      calculate_used_leave_days: {
        Args: { _employee_id: string; _year?: number }
        Returns: number
      }
      clock_punch: { Args: { _type: string }; Returns: Json }
      compute_attendance_range: {
        Args: { _from: string; _to: string }
        Returns: Json
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
      import_attendance_punches: { Args: { _punches: Json }; Returns: Json }
      is_department_head: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
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
      employment_type: "PERMANENT" | "CONTRACT" | "LOCUM" | "INTERN"
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
