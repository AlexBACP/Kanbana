import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  /**
   * Si true, también permite el acceso a aprendices con es_lider_tecnico=true,
   * aunque 'aprendiz' no esté en allowedRoles.
   */
  allowLiderTecnico?: boolean;
  /**
   * Si true, BLOQUEA el acceso a aprendices con es_lider_tecnico=true
   * (para que vayan a /dashboard en lugar de /kanban).
   */
  denyLiderTecnico?: boolean;
  redirectTo?: string;
}

export const ProtectedRoute = ({
  allowedRoles,
  allowLiderTecnico = false,
  denyLiderTecnico  = false,
  redirectTo = '/login',
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-dark-border border-t-primary-500 rounded-full animate-spin" />
          <p className="text-dark-muted text-xs">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (user && allowedRoles) {
    const esLider = user.rol === 'aprendiz' && (user as any).es_lider_tecnico;

    // Ruta que bloquea líderes técnicos → redirigir al dashboard
    if (denyLiderTecnico && esLider) {
      return <Navigate to="/dashboard" replace />;
    }

    // Ruta que permite líderes técnicos aunque no tengan el rol en la lista
    if (allowLiderTecnico && esLider) {
      return <Outlet />;
    }

    // Verificación normal de rol
    if (!allowedRoles.includes(user.rol)) {
      const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
      return <Navigate to={dest} replace />;
    }
  }

  return <Outlet />;
};
