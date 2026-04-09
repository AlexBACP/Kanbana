import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeApplier } from './components/ThemeApplier';
import { AuthInit } from './components/AuthInit';
import { AuthLayout } from './layouts/AuthLayout';
import { AdminDashboard } from './layouts/AdminDashboard';
import { AprendizDashboard } from './layouts/AprendizDashboard';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProfilePage } from './pages/ProfilePage';
import { KanbanPage } from './pages/KanbanPage';
import { BacklogPage } from './pages/BacklogPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        AuthInit FUERA del BrowserRouter — no usa useNavigate.
        Verifica token contra el backend y actualiza el store.
        ProtectedRoute espera hasta que isLoading=false antes de redirigir.
      */}
      <AuthInit />
      <ThemeApplier />
      <BrowserRouter>
        <Routes>
          {/* ── Landing pública ───────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Auth (login / registro) ───────────────────────── */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* ── Coordinador · Instructor · Líder técnico ─────── */}
          <Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor', 'lider_tecnico']} />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* ── Aprendiz ─────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['aprendiz']} />}>
            <Route path="/kanban" element={<AprendizDashboard />} />
          </Route>

          {/* ── Tablero Kanban de un proyecto específico ─────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects/:id/kanban" element={<KanbanPage />} />
            <Route path="/projects/:id/backlog" element={<BacklogPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
