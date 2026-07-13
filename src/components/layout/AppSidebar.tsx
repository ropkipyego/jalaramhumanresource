import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  Calendar, CalendarDays, ClipboardList, Users, Settings, Shield, LogOut,
  Home, UserCircle, UserPlus, FileSpreadsheet, Building2, Calculator,
  Landmark, ShieldCheck, User, Clock, CalendarCheck, SlidersHorizontal,
  Briefcase, Layers, AlertTriangle, FileText, RefreshCw, Phone,
  Banknote, Megaphone, BarChart3, GraduationCap, Package, UserSearch,
  Target, Gavel, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const meNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'My Profile', url: '/my-profile', icon: User },
  { title: 'My Rota', url: '/my-rota', icon: Calendar },
  { title: 'My Leave', url: '/my-leave', icon: CalendarDays },
  { title: 'My Attendance', url: '/attendance/my', icon: Clock },
  { title: 'My Payslips', url: '/my-payslips', icon: FileText },
  { title: 'My Documents', url: '/my-documents', icon: FolderOpen },
  { title: 'Announcements', url: '/announcements', icon: Megaphone },
];

const rotasNav: NavItem[] = [
  { title: 'Department Rota', url: '/rota', icon: ClipboardList, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Upload Rota (Excel)', url: '/rota-upload', icon: FileSpreadsheet, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Shift Swaps', url: '/shift-swaps', icon: RefreshCw },
  { title: 'On-Call Schedule', url: '/on-call', icon: Phone, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
];

const peopleNav: NavItem[] = [
  { title: 'Staff Directory', url: '/staff', icon: Users, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Compliance Dashboard', url: '/compliance', icon: ShieldCheck, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'Staff Compliance', url: '/staff/compliance', icon: ShieldCheck, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'Recruitment', url: '/recruitment', icon: UserSearch, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Performance', url: '/performance', icon: Target },
  { title: 'Training & CPD', url: '/training', icon: GraduationCap },
  { title: 'Disciplinary', url: '/disciplinary', icon: Gavel, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Assets', url: '/assets', icon: Package },
  { title: 'Invite Staff', url: '/invite', icon: UserPlus, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Bulk Upload Staff', url: '/invite/bulk', icon: FileSpreadsheet, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Departments', url: '/departments', icon: Building2, roles: ['SUPER_ADMIN'] },
  { title: 'Leave Admin', url: '/leave-admin', icon: CalendarDays, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Leave Calendar', url: '/leave-calendar', icon: CalendarCheck, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Leave Encashment', url: '/leave-encashment', icon: Banknote },
];

const attendanceNav: NavItem[] = [
  { title: 'Dashboard', url: '/attendance', icon: Clock },
  { title: 'Biometric Import', url: '/attendance/import', icon: FileSpreadsheet, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Daily Records', url: '/attendance/records', icon: ClipboardList, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Exceptions', url: '/attendance/exceptions', icon: AlertTriangle, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Shift Templates', url: '/attendance/shift-templates', icon: SlidersHorizontal, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Holiday Calendar', url: '/attendance/holidays', icon: CalendarCheck, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Attendance Settings', url: '/attendance/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
];

const financeNav: NavItem[] = [
  { title: 'Payroll', url: '/payroll', icon: Calculator, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'Loans & Advances', url: '/loans', icon: Banknote },
  { title: 'Statutory Settings', url: '/payroll/settings', icon: Landmark, roles: ['SUPER_ADMIN'] },
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
];

const systemNav: NavItem[] = [
  { title: 'Organization Setup', url: '/organization', icon: Building2, roles: ['SUPER_ADMIN'] },
  { title: 'Positions', url: '/positions', icon: Briefcase, roles: ['SUPER_ADMIN'] },
  { title: 'Job Grades', url: '/grades', icon: Layers, roles: ['SUPER_ADMIN'] },
  { title: 'Department Rules', url: '/rules', icon: Settings, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Audit Logs', url: '/audit-logs', icon: Shield, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const { role, hasRole } = useRole();
  const location = useLocation();

  const filterByRole = (items: NavItem[]) =>
    items.filter((i) => !i.roles || i.roles.some((r) => hasRole(r as any)));

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.url || (item.url !== '/' && location.pathname.startsWith(item.url + '/'));
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive}>
          <NavLink to={item.url} className="flex items-center gap-3">
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = filterByRole(items);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>{visible.map(renderNavItem)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Jalaram HR</span>
            <span className="text-xs text-muted-foreground">Enterprise HRPMS</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup('Me', meNav)}
        {renderGroup('Rotas', rotasNav)}
        {renderGroup('People', peopleNav)}
        {renderGroup('Time & Attendance', attendanceNav)}
        {renderGroup('Finance', financeNav)}
        {renderGroup('System', systemNav)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
            <UserCircle className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{profile?.full_name || 'User'}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {role?.toLowerCase().replace('_', ' ') || 'Staff'}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
