import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

// ── Banner: "¿No eres tú?" — aparece cuando el enlace viene de un correo ──────

const EmailContextBanner = () => {
  const { user, clearUser } = useAuthStore();
  const location             = useLocation();
  const navigate             = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user) return null;

  const handleSwitch = () => {
    authService.logout().catch(() => {});
    clearUser();

    // Eliminar el param from=email antes de usarlo como redirect target
    const params = new URLSearchParams(location.search);
    params.delete('from');
    const cleanSearch = params.toString();
    const cleanPath   = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');

    navigate(`/?redirect=${encodeURIComponent(cleanPath)}`, { replace: true });
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed top-0 left-0 right-0 flex items-center justify-between gap-4 px-5 py-2.5
                 bg-zinc-900/95 backdrop-blur border-b border-zinc-700/60 shadow-lg"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
          <UserRound size={11} className="text-zinc-300" />
        </div>
        <p className="text-xs text-zinc-400 truncate">
          Sesión activa como{' '}
          <strong className="text-zinc-200">{user.nombre}</strong>
          <span className="text-zinc-600 ml-1.5 hidden sm:inline">— abriste un enlace de correo</span>
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded transition-colors"
        >
          Soy yo
        </button>
        <button
          onClick={handleSwitch}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400
                     hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5
                     rounded transition-all"
        >
          <LogOut size={10} />
          Cambiar cuenta
        </button>
      </div>
    </div>
  );
};

// ── ProtectedRoute ─────────────────────────────────────────────────────────────

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
  redirectTo = '/',
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-xs">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preservar la URL actual como destino post-login (sin from=email para evitar loops)
    const params = new URLSearchParams(location.search);
    params.delete('from');
    const cleanSearch = params.toString();
    const cleanPath   = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');

    const loginDest = cleanPath !== '/'
      ? `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(cleanPath)}`
      : redirectTo;

    return <Navigate to={loginDest} replace />;
  }

  // ── Guard de vinculación para aprendices ──────────────────────────────
  // Un aprendiz sin fichaId que NO está en /solicitar-vinculacion debe ir ahí.
  // Esto incluye los estados: 'none' (nunca solicitó), 'pendiente' y 'rechazado'.
  if (user && user.rol === 'aprendiz' && !user.fichaId
      && location.pathname !== '/solicitar-vinculacion') {
    return <Navigate to="/solicitar-vinculacion" replace />;
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

  // Mostrar banner "¿No eres tú?" si el usuario llegó desde un enlace de correo
  const fromEmail = new URLSearchParams(location.search).get('from') === 'email';

  return (
    <>
      {fromEmail && <EmailContextBanner />}
      <Outlet />
    </>
  );
};
