// Custom types for the Hospital Rota Manager
// These complement the auto-generated Supabase types

export type AppRole = 'STAFF' | 'HEAD' | 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_ADMIN';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'LOCUM' | 'INTERN';
export type HrStatus = 'ACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'TERMINATED';
export type PayrollPeriodStatus =
  | 'DRAFT' | 'ATTENDANCE_LOCKED' | 'CALCULATED' | 'HR_REVIEWED' | 'FINANCE_APPROVED' | 'LOCKED';
export type PayrollLineKind = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIB';
export type StatutoryRateType =
  | 'PAYE_BAND' | 'NSSF_TIER1' | 'NSSF_TIER2' | 'SHIF' | 'HOUSING_LEVY' | 'PERSONAL_RELIEF';

export type LeaveType =
  | 'annual' | 'sick' | 'emergency' | 'maternity' | 'paternity'
  | 'unpaid' | 'other' | 'compassionate' | 'study';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'returned';

export type ShiftCode = 'D' | 'N' | 'OFF' | 'PH';

export type RotaStatus = 'draft' | 'published';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  id: boolean;
  name: string;
  logo_url: string | null;
  kra_pin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobGrade {
  id: string;
  name: string;
  code: string;
  level: number;
  min_salary: number | null;
  max_salary: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  title: string;
  code: string;
  department_id: string | null;
  grade_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  grade?: JobGrade;
}

export interface Profile {
  id: string;
  staff_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password?: boolean;
  branch_id?: string | null;
  position_id?: string | null;
  grade_id?: string | null;
  manager_id?: string | null;
  gender?: Gender | null;
  date_of_birth?: string | null;
  passport_no?: string | null;
  probation_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface EmployeeDepartment {
  id: string;
  employee_id: string;
  department_id: string;
  is_primary: boolean;
  is_head: boolean;
  created_at: string;
}

export interface DepartmentRules {
  id: string;
  department_id: string;
  min_staff_day: number;
  min_staff_night: number;
  max_consecutive_nights: number;
  min_rest_hours: number;
  created_at: string;
  updated_at: string;
}

export interface RotaWeek {
  id: string;
  department_id: string;
  week_start_date: string;
  status: RotaStatus;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RotaAssignment {
  id: string;
  rota_week_id: string;
  employee_id: string;
  day_of_week: number;
  shift_code: ShiftCode;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  department_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Extended types with relations
export interface ProfileWithDepartments extends Profile {
  departments?: (EmployeeDepartment & { department: Department })[];
  role?: AppRole;
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  employee?: Profile;
  department?: Department;
  reviewer?: Profile;
}

export interface RotaWeekWithAssignments extends RotaWeek {
  department?: Department;
  assignments?: (RotaAssignment & { employee?: Profile })[];
}