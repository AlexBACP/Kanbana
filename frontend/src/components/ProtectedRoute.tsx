// ProtectedRoute.tsx
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
  // ✅ CAMBIO 1: VOLVEMOS a extraer isLoading. Es vital para evitar el rebote.
  const { isAuthenticated, user, isLoading } = useAuthStore();

  // ✅ CAMBIO 2: Si el sistema está cargando o inicializando, NO HACE NADA.
  // Esto detiene el "Navigate" prematuro que causa el bucle.
  if (isLoading) {
    return null; // O un spinner pequeño si prefieres
  }

  // Ahora que sabemos que YA CARGÓ, evaluamos si tiene permiso
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.rol)) {
    const roleRedirect =
      user.rol === 'coordinador' || user.rol === 'instructor' || user.rol === 'lider_tecnico'
        ? '/dashboard'
        : '/kanban';
    
    return <Navigate to={roleRedirect} replace />;
  }

  return <Outlet />;
};