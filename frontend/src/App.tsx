import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute }          from './components/ProtectedRoute';
import { ThemeApplier }            from './components/ThemeApplier';
import { AuthInit }                from './components/AuthInit';
import { AuthLayout }              from './layouts/AuthLayout';
import { AdminDashboard }          from './layouts/AdminDashboard';
import { AprendizDashboard }       from './layouts/AprendizDashboard';
import { LandingPage }             from './pages/LandingPage';
import { TicketDetailPage }        from './pages/TicketDetailPage';
import { CalendarPage }            from './pages/CalendarPage';
import { ProfilePage }             from './pages/ProfilePage';
import { KanbanPage }              from './pages/KanbanPage';
import { ProjectPage }             from './pages/ProjectPage';
import { TrimestreDetailPage }     from './pages/TrimestreDetailPage';
import { TrimestreKanbanPage }     from './pages/TrimestreKanbanPage';
import { BacklogPage }             from './pages/BacklogPage';
import { NotFoundPage }            from './pages/NotFoundPage';
import { ForgotPasswordPage }      from './pages/ForgotPasswordPage';
import { ResetPasswordPage }       from './pages/ResetPasswordPage';
import { ConfirmarCuentaPage }     from './pages/ConfirmarCuentaPage';
import { AuthCallbackPage }        from './pages/AuthCallbackPage';
import { SolicitarVinculacionPage } from './pages/SolicitarVinculacionPage';
import { ChatBubble }              from './components/ChatBubble';
import { SearchModal, useSearchModal }  from './components/SearchModal';
import { NotificationToast }           from './components/NotificationToast';
import { WelcomeTour }                 from './components/WelcomeTour';
import { useSocket }                   from './hooks/useSocket';
import { useAuthStore }                from './store/auth.store';

// ── Componentes globales (deben vivir dentro de BrowserRouter) ────────────────

// Búsqueda global Cmd+K — overlay de búsqueda en todas las páginas.
const GlobalSearch = () => {
  const { isOpen, close } = useSearchModal();
  return <SearchModal open={isOpen} onClose={close} />;
};

// Socket global — mantiene la conexión WebSocket activa durante toda la sesión.
// Se activa automáticamente cuando el usuario está autenticado.
const GlobalSocket = () => {
  const { user } = useAuthStore();
  useSocket(user?.id);
  return null;
};

// ── QueryClient ────────────────────────────────────────────────────────────────
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
        {/* ── Socket global: conectado siempre que haya sesión activa ── */}
        <GlobalSocket />

        <Routes>
          {/* ── Landing pública ───────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Auth ─────────────────────────────────────────────
              Login y registro ya NO son páginas: viven en el panel
              lateral (LoginAside) que se abre desde la Landing. */}
          <Route element={<AuthLayout />}>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/confirmar-cuenta" element={<ConfirmarCuentaPage />} />
          </Route>

          {/* Callback del login con Google (pantalla propia, sin AuthLayout) */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* ── Solicitud de vinculación a una ficha (solo aprendices sin ficha) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/solicitar-vinculacion" element={<SolicitarVinculacionPage />} />
          </Route>

          {/* ── Dashboard de gestión (coordinador, instructor, líder técnico) */}
          <Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor']} allowLiderTecnico />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* ── Dashboard aprendiz regular ────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['aprendiz']} denyLiderTecnico />}>
            <Route path="/kanban" element={<AprendizDashboard />} />
          </Route>

          {/* ── Backlog (solo gestores) ───────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor']} allowLiderTecnico />}>
            <Route path="/projects/:id/backlog" element={<BacklogPage />} />
          </Route>

          {/* ── Rutas comunes a todos los roles autenticados ─── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects/:id"                                 element={<ProjectPage />} />
            <Route path="/projects/:id/trimestre/:trimestreId"         element={<TrimestreDetailPage />} />
            <Route path="/projects/:id/trimestre/:trimestreId/kanban"  element={<TrimestreKanbanPage />} />
            <Route path="/projects/:id/kanban"                         element={<KanbanPage />} />
            <Route path="/tickets/:id"  element={<TicketDetailPage />} />
            <Route path="/calendar"     element={<CalendarPage />} />
            <Route path="/profile"      element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {/* ── KanbanaAI — Asistente flotante global ─────────── */}
        <ChatBubble />
        {/* ── Búsqueda global Cmd+K ─────────────────────────── */}
        <GlobalSearch />
        {/* ── Toasts de notificaciones en tiempo real ────────── */}
        <NotificationToast />
        {/* ── Tour interactivo de bienvenida (primer login) ───── */}
        <WelcomeTour />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
