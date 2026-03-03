import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/contexts/AppContext";
import AppHeader from "@/components/AppHeader";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ProgramDetail from "@/pages/admin/ProgramDetail";
import JudgePrograms from "@/pages/judge/JudgePrograms";
import EvaluationView from "@/pages/judge/EvaluationView";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedRoutes() {
  const { user } = useApp();

  if (!user) return <Navigate to="/" replace />;

  return (
    <>
      <AppHeader />
      <Routes>
        {user.role === "admin" ? (
          <>
            <Route path="/admin" element={<main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"><AdminDashboard /></main>} />
            <Route path="/admin/program/:id" element={<main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"><ProgramDetail /></main>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </>
        ) : (
          <>
            <Route path="/judge" element={<main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"><JudgePrograms /></main>} />
            <Route path="/judge/program/:programId" element={<EvaluationView />} />
            <Route path="*" element={<Navigate to="/judge" replace />} />
          </>
        )}
      </Routes>
    </>
  );
}

function AppRoutes() {
  const { user } = useApp();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/judge"} replace /> : <Login />} />
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
