import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Attendance from "@/pages/Attendance";
import Leaves from "@/pages/Leaves";
import Payslips from "@/pages/Payslips";
import Documents from "@/pages/Documents";
import Reimbursements from "@/pages/Reimbursements";
import AdminConsole from "@/pages/AdminConsole";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/payslip" element={<Payslips />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/reimbursements" element={<Reimbursements />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminConsole /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
