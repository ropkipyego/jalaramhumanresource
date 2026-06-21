import React from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/my-rota': 'My Rota',
  '/my-leave': 'My Leave',
  '/rota': 'Department Rota',
  '/rota-upload': 'Upload Rota',
  '/leave-admin': 'Leave Requests',
  '/staff': 'Staff Directory',
  '/invite': 'Invite Staff',
  '/invite/bulk': 'Bulk Upload Staff',
  '/departments': 'Departments',
  '/users': 'User Management',
  '/rules': 'Department Rules',
  '/profile': 'Profile',
};

export function AppHeader() {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'Hospital Rota Manager';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <NotificationBell />
    </header>
  );
}
