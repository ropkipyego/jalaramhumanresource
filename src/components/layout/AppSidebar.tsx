import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  Users,
  Settings,
  Shield,
  LogOut,
  Home,
  UserCircle,
  UserPlus,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'My Rota', url: '/my-rota', icon: Calendar },
  { title: 'My Leave', url: '/my-leave', icon: CalendarDays },
];

const departmentNavItems: NavItem[] = [
  { title: 'Department Rota', url: '/rota', icon: ClipboardList, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Upload Rota (Excel)', url: '/rota-upload', icon: FileSpreadsheet, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Leave Admin', url: '/leave-admin', icon: CalendarDays, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Staff Directory', url: '/staff', icon: Users, roles: ['HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { title: 'Invite Staff', url: '/invite', icon: UserPlus, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

const adminNavItems: NavItem[] = [
  { title: 'Departments', url: '/departments', icon: Building2, roles: ['SUPER_ADMIN'] },
  { title: 'User Management', url: '/users', icon: Shield, roles: ['SUPER_ADMIN'] },
  { title: 'Department Rules', url: '/rules', icon: Settings, roles: ['SUPER_ADMIN'] },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const { role, hasRole } = useRole();
  const location = useLocation();

  const filterByRole = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      return item.roles.some((r) => hasRole(r as any));
    });
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.url;
    
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

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Hospital Rota</span>
            <span className="text-xs text-muted-foreground">& Leave Manager</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filterByRole(departmentNavItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Department</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(departmentNavItems).map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filterByRole(adminNavItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(adminNavItems).map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
            <UserCircle className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">
              {profile?.full_name || 'User'}
            </span>
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
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}