import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Loader2 } from "lucide-react";

import Auth from "@/pages/Auth";
import ChangePassword from "@/pages/ChangePassword";
import NotFound from "./pages/NotFound";

const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const MyRota = lazy(() => import("@/pages/MyRota"));
const MyLeave = lazy(() => import("@/pages/MyLeave"));
const DepartmentRota = lazy(() => import("@/pages/DepartmentRota"));
const StaffDirectory = lazy(() => import("@/pages/StaffDirectory"));
const LeaveAdmin = lazy(() => import("@/pages/LeaveAdmin"));
const InviteStaff = lazy(() => import("@/pages/InviteStaff"));
const BulkStaffUpload = lazy(() => import("@/pages/BulkStaffUpload"));
const RotaUpload = lazy(() => import("@/pages/RotaUpload"));
const Departments = lazy(() => import("@/pages/Departments"));
const Payroll = lazy(() => import("@/pages/Payroll"));
const PayrollPeriod = lazy(() => import("@/pages/PayrollPeriod"));
const StatutorySettings = lazy(() => import("@/pages/StatutorySettings"));
const StaffCompliance = lazy(() => import("@/pages/StaffCompliance"));
const UserAccounts = lazy(() => import("@/pages/UserAccounts"));
const MyProfile = lazy(() => import("@/pages/MyProfile"));
const AttendanceDashboard = lazy(() => import("@/pages/AttendanceDashboard"));
const ShiftTemplates = lazy(() => import("@/pages/ShiftTemplates"));
const HolidayCalendar = lazy(() => import("@/pages/HolidayCalendar"));
const AttendanceImport = lazy(() => import("@/pages/AttendanceImport"));
const AttendanceRecords = lazy(() => import("@/pages/AttendanceRecords"));
const AttendanceExceptions = lazy(() => import("@/pages/AttendanceExceptions"));
const MyAttendance = lazy(() => import("@/pages/MyAttendance"));
const OrganizationSetup = lazy(() => import("@/pages/OrganizationSetup"));
const Positions = lazy(() => import("@/pages/Positions"));
const JobGrades = lazy(() => import("@/pages/JobGrades"));
const DepartmentRules = lazy(() => import("@/pages/DepartmentRules"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const EmployeeDetail = lazy(() => import("@/pages/EmployeeDetail"));
const MyPayslips = lazy(() => import("@/pages/MyPayslips"));
const LeaveCalendar = lazy(() => import("@/pages/LeaveCalendar"));
const EmployeeDocuments = lazy(() => import("@/pages/EmployeeDocuments"));
const Announcements = lazy(() => import("@/pages/Announcements"));
const ReportsHub = lazy(() => import("@/pages/ReportsHub"));
const OvertimeApprovals = lazy(() => import("@/pages/OvertimeApprovals"));
const ShiftSwaps = lazy(() => import("@/pages/ShiftSwaps"));
const GoLiveChecklist = lazy(() => import("@/pages/GoLiveChecklist"));
const EmailSecuritySetup = lazy(() => import("@/pages/EmailSecuritySetup"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="my-rota" element={<MyRota />} />
                  <Route path="my-leave" element={<MyLeave />} />
                  <Route path="my-profile" element={<MyProfile />} />
                  <Route path="my-payslips" element={<MyPayslips />} />
                  <Route path="my-documents" element={<EmployeeDocuments />} />
                  <Route path="rota" element={<DepartmentRota />} />
                  <Route path="rota-upload" element={<RotaUpload />} />
                  <Route path="shift-swaps" element={<ShiftSwaps />} />
                  <Route path="staff" element={<StaffDirectory />} />
                  <Route path="staff/compliance" element={<StaffCompliance />} />
                  <Route path="staff/accounts" element={<UserAccounts />} />
                  <Route path="staff/:id" element={<EmployeeDetail />} />
                  <Route path="leave-admin" element={<LeaveAdmin />} />
                  <Route path="leave-calendar" element={<LeaveCalendar />} />
                  <Route path="invite" element={<InviteStaff />} />
                  <Route path="invite/bulk" element={<BulkStaffUpload />} />
                  <Route path="departments" element={<Departments />} />
                  <Route path="organization" element={<OrganizationSetup />} />
                  <Route path="positions" element={<Positions />} />
                  <Route path="grades" element={<JobGrades />} />
                  <Route path="rules" element={<DepartmentRules />} />
                  <Route path="audit-logs" element={<AuditLogs />} />
                  <Route path="payroll" element={<Payroll />} />
                  <Route path="payroll/settings" element={<StatutorySettings />} />
                  <Route path="payroll/:periodId" element={<PayrollPeriod />} />
                  <Route path="attendance" element={<AttendanceDashboard />} />
                  <Route path="attendance/shift-templates" element={<ShiftTemplates />} />
                  <Route path="attendance/holidays" element={<HolidayCalendar />} />
                  <Route path="attendance/import" element={<AttendanceImport />} />
                  <Route path="attendance/records" element={<AttendanceRecords />} />
                  <Route path="attendance/exceptions" element={<AttendanceExceptions />} />
                  <Route path="attendance/overtime" element={<OvertimeApprovals />} />
                  <Route path="attendance/my" element={<MyAttendance />} />
                  <Route path="announcements" element={<Announcements />} />
                  <Route path="reports" element={<ReportsHub />} />
                  <Route path="go-live" element={<GoLiveChecklist />} />
                  <Route path="email-security" element={<EmailSecuritySetup />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
