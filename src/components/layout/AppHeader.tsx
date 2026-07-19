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
  '/my-profile': 'My Profile',
  '/my-payslips': 'My Payslips',
  '/my-documents': 'My Documents',
  '/rota': 'Department Rota',
  '/rota-upload': 'Upload Rota',
  '/shift-swaps': 'Shift Swaps',
  '/on-call': 'On-Call Schedule',
  '/leave-admin': 'Leave Requests',
  '/leave-calendar': 'Leave Calendar',
  '/leave-encashment': 'Leave Encashment',
  '/staff': 'Staff Directory',
  '/staff/compliance': 'Staff Compliance',
  '/compliance': 'Compliance Dashboard',
  '/invite': 'Invite Staff',
  '/invite/bulk': 'Bulk Upload Staff',
  '/departments': 'Departments',
  '/organization': 'Organization Setup',
  '/positions': 'Positions',
  '/grades': 'Job Grades',
  '/rules': 'Department Rules',
  '/audit-logs': 'Audit Logs',
  '/payroll': 'Payroll',
  '/payroll/settings': 'Statutory Settings',
  '/loans': 'Loans & Advances',
  '/attendance': 'Time & Attendance',
  '/attendance/import': 'Biometric Import',
  '/attendance/records': 'Daily Records',
  '/attendance/exceptions': 'Exceptions',
  '/attendance/overtime': 'OT Approvals',
  '/attendance/my': 'My Attendance',
  '/attendance/shift-templates': 'Shift Templates',
  '/attendance/holidays': 'Holiday Calendar',
  '/attendance/settings': 'Attendance Settings',
  '/recruitment': 'Recruitment',
  '/performance': 'Performance',
  '/training': 'Training & CPD',
  '/assets': 'Asset Management',
  '/announcements': 'Announcements',
  '/reports': 'Reports',
  '/disciplinary': 'Disciplinary Records',
  '/go-live-credentials': 'Go-Live Credentials',
  '/go-live': 'Go-Live Checklist',
  '/email-security': 'Email & Security',
};

export function AppHeader() {
  const location = useLocation();
  const pageTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/staff/') ? 'Employee Record' :
     location.pathname.startsWith('/payroll/') ? 'Payroll Period' :
     'Jalaram HR');

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
