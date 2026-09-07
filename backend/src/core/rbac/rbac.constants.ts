/** HR role slugs aligned with public.app_role enum */
export type HrRole =
  | 'STAFF'
  | 'HEAD'
  | 'ADMIN'
  | 'FINANCE_ADMIN'
  | 'SUPER_ADMIN';

export const ROLE_PERMISSIONS: Record<HrRole, string[]> = {
  STAFF: ['profile:read', 'profile:write', 'rota:read', 'leave:read', 'leave:write', 'payslip:read'],
  HEAD: [
    'profile:read', 'profile:write', 'rota:read', 'rota:manage', 'leave:read', 'leave:write',
    'leave:approve', 'attendance:read', 'attendance:manage',
  ],
  ADMIN: [
    'profile:read', 'profile:write', 'rota:read', 'rota:manage', 'leave:read', 'leave:write',
    'leave:approve', 'attendance:read', 'attendance:manage', 'staff:read', 'staff:manage',
    'payroll:read', 'payroll:manage', 'users:manage', 'audit:read',
  ],
  FINANCE_ADMIN: [
    'profile:read', 'payroll:read', 'payroll:approve', 'reports:read', 'audit:read',
  ],
  SUPER_ADMIN: ['*'],
};

export function permissionsForRoles(roles: string[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role as HrRole];
    if (!perms) continue;
    if (perms.includes('*')) return ['*'];
    perms.forEach((p) => set.add(p));
  }
  return [...set];
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(required);
}
