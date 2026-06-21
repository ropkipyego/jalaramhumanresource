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
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="my-rota" element={<MyRota />} />
              <Route path="my-leave" element={<MyLeave />} />
              <Route path="rota" element={<DepartmentRota />} />
              <Route path="rota-upload" element={<RotaUpload />} />
              <Route path="staff" element={<StaffDirectory />} />
              <Route path="leave-admin" element={<LeaveAdmin />} />
              <Route path="invite" element={<InviteStaff />} />
              <Route path="departments" element={<Departments />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
