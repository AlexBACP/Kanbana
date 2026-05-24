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
import { ProjectPage } from './pages/ProjectPage';
import { TrimestreDetailPage }   from './pages/TrimestreDetailPage';
import { TrimestreKanbanPage }   from './pages/TrimestreKanbanPage';
import { BacklogPage } from './pages/BacklogPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ChatBubble }  from './components/ChatBubble';
// ── CAMBIO: importamos las páginas de recuperación de contraseña ──────────
import { ForgotPasswordPage }    from './pages/ForgotPasswordPage';
import { ResetPasswordPage }     from './pages/ResetPasswordPage';
import { ConfirmarCuentaPage }   from './pages/ConfirmarCuentaPage';

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
      <AuthInit />
      <ThemeApplier />
      <BrowserRouter>
        <Routes>
          {/* ── Landing pública ───────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Auth ─────────────────────────────────────────── */}
          <Route element={<AuthLayout />}>
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/register"         element={<RegisterPage />} />
            {/* ── CAMBIO: rutas de recuperación — antes no estaban registradas */}
            <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
            <Route path="/reset-password"    element={<ResetPasswordPage />} />
            <Route path="/confirmar-cuenta"  element={<ConfirmarCuentaPage />} />
          </Route>

          {/*
            ── Dashboard de gestión ──────────────────────────────
            Accesible para coordinador, instructor, y aprendices
            con es_lider_tecnico=true.
            ProtectedRoute verifica el campo es_lider_tecnico
            además del rol para los aprendices-líderes.
          */}
          <Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor']} allowLiderTecnico />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* ── Dashboard aprendiz regular ────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['aprendiz']} denyLiderTecnico />}>
            <Route path="/kanban" element={<AprendizDashboard />} />
          </Route>

          {/*
            ── Rutas de gestión (coordinador, instructor, líder técnico) ────
            ── MODIFICADO — punto #4 auditoría ─────────────────────────────
            Antes: /projects/:id/backlog estaba en el bloque común sin
            allowedRoles. Cualquier aprendiz podía entrar escribiendo la URL.
            El backlog es herramienta de gestión: solo coordinadores,
            instructores y aprendices-líderes deben acceder.
          */}
          <Route element={<ProtectedRoute allowedRoles={["coordinador", "instructor"]} allowLiderTecnico />}>
            <Route path="/projects/:id/backlog" element={<BacklogPage />} />
          </Route>

          {/* ── Rutas comunes a todos los roles autenticados ─────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects/:id"                                      element={<ProjectPage />} />
            <Route path="/projects/:id/trimestre/:trimestreId"              element={<TrimestreDetailPage />} />
            <Route path="/projects/:id/trimestre/:trimestreId/kanban"      element={<TrimestreKanbanPage />} />
            <Route path="/projects/:id/kanban"                             element={<KanbanPage />} />
            <Route path="/tickets/:id"          element={<TicketDetailPage />} />
            <Route path="/calendar"             element={<CalendarPage />} />
            <Route path="/profile"              element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {/* ── KanbanaAI — Asistente flotante global ────────────────── */}
        <ChatBubble />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;