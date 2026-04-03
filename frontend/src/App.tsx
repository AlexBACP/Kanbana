import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeApplier } from './components/ThemeApplier';
import { AuthInit } from './components/AuthInit';
import { AuthLayout } from './layouts/AuthLayout';
import { AdminDashboard } from './layouts/AdminDashboard';
import { AprendizDashboard } from './layouts/AprendizDashboard';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,        // 1 minute cache
      refetchOnWindowFocus: false,  // prevents re-fetches that can re-trigger auth
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* AuthInit is OUTSIDE BrowserRouter — it uses useAuthStore.getState(), not useNavigate */}
      <AuthInit />
      <ThemeApplier />
      <BrowserRouter>
        <Routes>
          {/* 1. EL LANDING ES AHORA LA RUTA RAIZ */}
        <Route path="/" element={<LandingPage />} />
          {/* Public routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Admin roles */}
          <Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor', 'lider_tecnico']} />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* Aprendiz */}
          <Route element={<ProtectedRoute allowedRoles={['aprendiz']} />}>
            <Route path="/kanban" element={<AprendizDashboard />} />
          </Route>

          {/* Shared protected routes */}
          <Route element={<ProtectedRoute />}>
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
