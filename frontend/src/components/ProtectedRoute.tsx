import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export const ProtectedRoute = ({
  allowedRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // Mientras AuthInit verifica el token: spinner neutral
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

  // Rol no permitido: redirigir al dashboard correcto
  if (allowedRoles && user && !allowedRoles.includes(user.rol)) {
    const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
};