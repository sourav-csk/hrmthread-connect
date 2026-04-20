import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import ComingSoon from "@/pages/ComingSoon";
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
              <Route path="/attendance" element={<ComingSoon title="Attendance" description="Selfie + GPS check-in coming next" />} />
              <Route path="/leaves" element={<ComingSoon title="Leaves" description="Apply for leave with approval flow" />} />
              <Route path="/payslip" element={<ComingSoon title="Payslip" description="View and download monthly payslips" />} />
              <Route path="/documents" element={<ComingSoon title="Documents & News" description="Company documents and announcements" />} />
              <Route path="/reimbursements" element={<ComingSoon title="Reimbursements" description="Submit and track expense claims" />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><ComingSoon title="Admin Console" description="Manage employees, approvals, and settings" /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
