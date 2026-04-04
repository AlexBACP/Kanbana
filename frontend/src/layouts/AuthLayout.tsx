/**
 * AuthLayout — envuelve /login y /register
 *
 * FIX DEL BUCLE:
 * La versión anterior redirigía a /dashboard mientras isLoading=true.
 * Eso creaba este ciclo:
 *   AuthLayout → Navigate a /dashboard
 *   ProtectedRoute → isLoading=true → spinner
 *   Spinner infinito porque nadie bajaba isLoading
 *
 * Ahora: mientras isLoading=true, no hacemos NADA.
 * Solo redirigimos cuando tenemos certeza de que el usuario SÍ está autenticado.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export const AuthLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // CLAVE: mientras AuthInit trabaja, no redirigir
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="w-6 h-6 border-2 border-dark-border border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Solo redirigir cuando tenemos certeza de sesión activa
  if (isAuthenticated && user) {
    const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
    return <Navigate to={dest} replace />;
  }

  // Mostrar el formulario de login o registro
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-slate-800/20 rounded-full blur-[80px]" />
      </div>
      <Outlet />
    </div>
  );
};