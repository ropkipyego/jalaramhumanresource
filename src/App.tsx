import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import MyRota from "@/pages/MyRota";
import MyLeave from "@/pages/MyLeave";
import DepartmentRota from "@/pages/DepartmentRota";
import StaffDirectory from "@/pages/StaffDirectory";
import LeaveAdmin from "@/pages/LeaveAdmin";
import InviteStaff from "@/pages/InviteStaff";
import BulkStaffUpload from "@/pages/BulkStaffUpload";
import RotaUpload from "@/pages/RotaUpload";
import Departments from "@/pages/Departments";
import Payroll from "@/pages/Payroll";
import PayrollPeriod from "@/pages/PayrollPeriod";
import StatutorySettings from "@/pages/StatutorySettings";
import StaffCompliance from "@/pages/StaffCompliance";
import MyProfile from "@/pages/MyProfile";
import AttendanceDashboard from "@/pages/AttendanceDashboard";
import ShiftTemplates from "@/pages/ShiftTemplates";
import HolidayCalendar from "@/pages/HolidayCalendar";
import AttendanceSettings from "@/pages/AttendanceSettings";
import AttendanceImport from "@/pages/AttendanceImport";
import AttendanceRecords from "@/pages/AttendanceRecords";
import AttendanceExceptions from "@/pages/AttendanceExceptions";
import MyAttendance from "@/pages/MyAttendance";
import OrganizationSetup from "@/pages/OrganizationSetup";
import Positions from "@/pages/Positions";
import JobGrades from "@/pages/JobGrades";
import DepartmentRules from "@/pages/DepartmentRules";
import AuditLogs from "@/pages/AuditLogs";
import EmployeeDetail from "@/pages/EmployeeDetail";
import MyPayslips from "@/pages/MyPayslips";
import LeaveCalendar from "@/pages/LeaveCalendar";
import LeaveEncashment from "@/pages/LeaveEncashment";
import LoansAdvances from "@/pages/LoansAdvances";
import ShiftSwaps from "@/pages/ShiftSwaps";
import OnCallSchedule from "@/pages/OnCallSchedule";
import ComplianceDashboard from "@/pages/ComplianceDashboard";
import EmployeeDocuments from "@/pages/EmployeeDocuments";
import Recruitment from "@/pages/Recruitment";
import Performance from "@/pages/Performance";
import TrainingCpd from "@/pages/TrainingCpd";
import Assets from "@/pages/Assets";
import Announcements from "@/pages/Announcements";
import ReportsHub from "@/pages/ReportsHub";
import Disciplinary from "@/pages/Disciplinary";
import GoLiveCredentials from "@/pages/GoLiveCredentials";
import ChangePassword from "@/pages/ChangePassword";
import EmailSecuritySetup from "@/pages/EmailSecuritySetup";
import MfaSetup from "@/pages/MfaSetup";
import MfaVerify from "@/pages/MfaVerify";
import OvertimeApprovals from "@/pages/OvertimeApprovals";
import GoLiveChecklist from "@/pages/GoLiveChecklist";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/mfa-setup" element={<MfaSetup />} />
            <Route path="/mfa-verify" element={<MfaVerify />} />
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
              <Route path="on-call" element={<OnCallSchedule />} />
              <Route path="staff" element={<StaffDirectory />} />
              <Route path="staff/compliance" element={<StaffCompliance />} />
              <Route path="staff/:id" element={<EmployeeDetail />} />
              <Route path="compliance" element={<ComplianceDashboard />} />
              <Route path="leave-admin" element={<LeaveAdmin />} />
              <Route path="leave-calendar" element={<LeaveCalendar />} />
              <Route path="leave-encashment" element={<LeaveEncashment />} />
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
              <Route path="loans" element={<LoansAdvances />} />
              <Route path="attendance" element={<AttendanceDashboard />} />
              <Route path="attendance/shift-templates" element={<ShiftTemplates />} />
              <Route path="attendance/holidays" element={<HolidayCalendar />} />
              <Route path="attendance/settings" element={<AttendanceSettings />} />
              <Route path="attendance/import" element={<AttendanceImport />} />
              <Route path="attendance/records" element={<AttendanceRecords />} />
              <Route path="attendance/exceptions" element={<AttendanceExceptions />} />
              <Route path="attendance/overtime" element={<OvertimeApprovals />} />
              <Route path="attendance/my" element={<MyAttendance />} />
              <Route path="recruitment" element={<Recruitment />} />
              <Route path="performance" element={<Performance />} />
              <Route path="training" element={<TrainingCpd />} />
              <Route path="assets" element={<Assets />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="reports" element={<ReportsHub />} />
              <Route path="disciplinary" element={<Disciplinary />} />
              <Route path="go-live-credentials" element={<GoLiveCredentials />} />
              <Route path="go-live" element={<GoLiveChecklist />} />
              <Route path="email-security" element={<EmailSecuritySetup />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
