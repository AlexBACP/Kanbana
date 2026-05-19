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
  // El LoginPage y RegisterPage tienen su propio fondo completo,
  // así que AuthLayout solo wrappea el Outlet sin estilos extra.
  return <Outlet />;
};