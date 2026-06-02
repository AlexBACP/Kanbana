/**
 * AuthCallbackPage — destino del redirect tras el login con Google o GitHub (OAuth).
 *
 * El backend redirige aquí con ?access_token=...&refresh_token=... (los tokens
 * vuelven por la URL porque una redirección de navegador no puede traer JSON).
 * Aquí guardamos la sesión (igual que useAuth.login), cargamos el perfil y
 * mandamos al dashboard según el rol.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;       // evita doble ejecución en StrictMode
    ran.current = true;

    const params  = new URLSearchParams(window.location.search);
    const access  = params.get('access_token');
    const refresh = params.get('refresh_token');

    if (!access || !refresh) {
      navigate('/?error=' + encodeURIComponent('No se recibió la sesión. Intenta de nuevo.'), { replace: true });
      return;
    }

    // Guardar tokens (mismo patrón que useAuth.login)
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    useAuthStore.getState().setToken(access);

    // Quitar los tokens de la URL (no dejarlos en el historial)
    window.history.replaceState({}, '', '/auth/callback');

    authService.me()
      .then((user: any) => {
        useAuthStore.getState().setUser(user);
        const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
        navigate(dest, { replace: true });
      })
      .catch(() => {
        useAuthStore.getState().clearUser();
        navigate('/?error=' + encodeURIComponent('No se pudo cargar tu perfil'), { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <span className="w-9 h-9 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm font-medium">Iniciando sesión…</p>
      </div>
    </div>
  );
};
