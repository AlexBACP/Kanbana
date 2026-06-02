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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Solo redirigir cuando tenemos certeza de sesión activa
  if (isAuthenticated && user) {
    const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
    return <Navigate to={dest} replace />;
  }

  // Páginas de auth restantes (forgot/reset/confirmar-cuenta).
  // Login y registro ya NO son páginas: viven en el panel lateral (LoginAside).
  // Cada página tiene su propio fondo, así que solo envolvemos el Outlet.
  return <Outlet />;
};