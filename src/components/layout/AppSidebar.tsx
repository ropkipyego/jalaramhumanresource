import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Calendar, CalendarDays, ClipboardList, Users, Settings, Shield, LogOut,
  Home, UserPlus, FileSpreadsheet, Building2, Calculator,
  Landmark, ShieldCheck, User, UserCircle, Clock, CalendarCheck, SlidersHorizontal,
  Briefcase, Layers, AlertTriangle, FileText, Megaphone, BarChart3,
  KeyRound, FolderOpen, Timer, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

const selfServiceNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'My Profile', url: '/my-profile', icon: User },
  { title: 'My Documents', url: '/my-documents', icon: FolderOpen },
  { title: 'Announcements', url: '/announcements', icon: Megaphone },
];

const rotaNav: NavItem[] = [
  { title: 'My Rota', url: '/my-rota', icon: Calendar },
  { title: 'Department Rota', url: '/rota', icon: ClipboardList, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Upload Rota', url: '/rota-upload', icon: FileSpreadsheet, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Department Rules', url: '/rules', icon: Settings, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
];

const attendanceNav: NavItem[] = [
  { title: 'My Attendance', url: '/attendance/my', icon: Clock },
  { title: 'Attendance Hub', url: '/attendance', icon: Clock, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'Biometric Import', url: '/attendance/import', icon: FileSpreadsheet, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Daily Records', url: '/attendance/records', icon: ClipboardList, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Exceptions', url: '/attendance/exceptions', icon: AlertTriangle, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'OT Approvals', url: '/attendance/overtime', icon: Timer, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Shift Templates', url: '/attendance/shift-templates', icon: SlidersHorizontal, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Holidays', url: '/attendance/holidays', icon: CalendarCheck, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
];

const hrNav: NavItem[] = [
  { title: 'Staff Directory', url: '/staff', icon: Users, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'User Accounts', url: '/staff/accounts', icon: KeyRound, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Invite Staff', url: '/invite', icon: UserPlus, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Bulk Upload Staff', url: '/invite/bulk', icon: FileSpreadsheet, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Staff Compliance', url: '/staff/compliance', icon: ShieldCheck, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'My Leave', url: '/my-leave', icon: CalendarDays },
  { title: 'Leave Admin', url: '/leave-admin', icon: CalendarDays, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Leave Calendar', url: '/leave-calendar', icon: CalendarCheck, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Departments', url: '/departments', icon: Building2, roles: ['SUPER_ADMIN'] },
  { title: 'Positions', url: '/positions', icon: Briefcase, roles: ['SUPER_ADMIN'] },
  { title: 'Job Grades', url: '/grades', icon: Layers, roles: ['SUPER_ADMIN'] },
];

const payrollNav: NavItem[] = [
  { title: 'My Payslips', url: '/my-payslips', icon: FileText },
  { title: 'Payroll Periods', url: '/payroll', icon: Calculator, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  { title: 'Statutory Rates', url: '/payroll/settings', icon: Landmark, roles: ['SUPER_ADMIN'] },
  { title: 'Reports & Exports', url: '/reports', icon: BarChart3, roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
];

const systemNav: NavItem[] = [
  { title: 'Organization', url: '/organization', icon: Building2, roles: ['SUPER_ADMIN'] },
  { title: 'Go-Live Credentials', url: '/go-live-credentials', icon: KeyRound, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { title: 'Audit Logs', url: '/audit-logs', icon: Shield, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

const NAV_GROUPS: NavGroup[] = [
  { id: 'self', label: 'Self Service', icon: User, items: selfServiceNav, defaultOpen: true },
  { id: 'hr', label: 'Human Resources', icon: Users, items: hrNav },
  { id: 'rota', label: 'Rota & Scheduling', icon: Calendar, items: rotaNav },
  { id: 'attendance', label: 'Time & Attendance', icon: Clock, items: attendanceNav },
  { id: 'payroll', label: 'Payroll & Finance', icon: Calculator, items: payrollNav },
  { id: 'system', label: 'System', icon: Settings, items: systemNav },
];

function pathInGroup(pathname: string, items: NavItem[]) {
  return items.some((i) =>
    pathname === i.url ||
    (i.url !== '/' && i.url !== '/attendance' && pathname.startsWith(i.url + '/')) ||
    (i.url === '/attendance' && pathname === '/attendance')
  );
}

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const { role } = useRole();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('organization_settings')
        .select('logo_url')
        .limit(1)
        .maybeSingle();
      if (data?.logo_url) setLogoUrl(data.logo_url);
    })();
  }, []);

  const filterByRole = (items: NavItem[]) =>
    items.filter((i) => !i.roles || (!!role && i.roles.includes(role)));

  const initialOpen = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      const visible = filterByRole(g.items);
      open[g.id] = g.defaultOpen || pathInGroup(location.pathname, visible);
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from current route
  }, []);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  const renderNavItem = (item: NavItem) => {
    const isActive =
      location.pathname === item.url ||
      (item.url !== '/' && item.url !== '/attendance' && location.pathname.startsWith(item.url + '/')) ||
      (item.url === '/attendance' && location.pathname === '/attendance');
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive}>
          <NavLink to={item.url} className="flex items-center gap-3">
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-sidebar-border">
            <BrandLogo src={logoUrl} className="h-9 w-9" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">Jalaram Hospital</span>
            <span className="text-xs text-muted-foreground">HR · Rota · Payroll</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const visible = filterByRole(group.items);
          if (visible.length === 0) return null;
          const isOpen = openGroups[group.id] ?? false;
          const GroupIcon = group.icon;
          return (
            <Collapsible
              key={group.id}
              open={isOpen}
              onOpenChange={(next) => setOpenGroups((prev) => ({ ...prev, [group.id]: next }))}
              className="group/collapsible"
            >
              <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild className="p-0">
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <GroupIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1 truncate normal-case text-xs font-semibold tracking-normal">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        isOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>{visible.map(renderNavItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
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
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
