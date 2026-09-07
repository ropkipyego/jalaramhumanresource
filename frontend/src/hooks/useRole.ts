import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/database';

export function useRole() {
  const { role, headDepartments } = useAuth();

  const hasRole = (requiredRole: AppRole): boolean => {
    if (!role) return false;
    
    const roleHierarchy: Record<AppRole, number> = {
      STAFF: 1,
      HEAD: 2,
      FINANCE_ADMIN: 3,
      ADMIN: 3,
      SUPER_ADMIN: 4,
    };

    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  const hasAnyRole = (roles: AppRole[]): boolean => {
    return roles.some((r) => hasRole(r));
  };

  const isExactRole = (exactRole: AppRole): boolean => {
    return role === exactRole;
  };

  const canEditDepartment = (departmentId: string): boolean => {
    if (hasRole('ADMIN')) return true;
    if (isExactRole('HEAD') && headDepartments.includes(departmentId)) return true;
    return false;
  };

  const canViewDepartment = (departmentId: string): boolean => {
    // For now, all authenticated users can view departments they belong to
    // This could be extended with more specific logic
    return true;
  };

  const isAdmin = role === 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  /** Password reset, login email, go-live credentials — not FINANCE_ADMIN / HEAD / STAFF */
  const canManageStaffLogins = isAdmin || isSuperAdmin;

  return {
    role,
    hasRole,
    hasAnyRole,
    isExactRole,
    canEditDepartment,
    canViewDepartment,
    isStaff: role === 'STAFF',
    isHead: role === 'HEAD',
    isAdmin,
    isSuperAdmin,
    isFinanceAdmin: role === 'FINANCE_ADMIN',
    canManageStaffLogins,
    canViewPayroll: role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN',
    headDepartments,
  };
}