/**
 * useAuth — solo login y logout.
 * NO tiene useEffect de verificación — eso es responsabilidad de AuthInit.
 *
 * login() detecta si está corriendo dentro de un popup:
 * - En popup: guarda tokens, envía postMessage al padre y cierra la ventana.
 * - Normal:   navega al dashboard según el rol.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

const isPopup = (): boolean => {
  try {
    return !!(window.opener && !window.opener.closed && window.opener !== window);
  } catch {
    return false;
  }
};

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, token, setUser, setToken, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    const { access_token, refresh_token } = response.tokens;

    // Guardar tokens siempre (tanto popup como normal)
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setUser(response.user);

    if (isPopup()) {
      // Modo popup: notificar al padre y cerrar
      window.opener.postMessage(
        { type: 'LOGIN_SUCCESS', rol: response.user.rol },
        window.location.origin
      );
      setTimeout(() => window.close(), 200);
    } else {
      // Modo normal: navegar al dashboard
      const rol = response.user.rol;
      navigate(rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
    }
  };

  const logout = () => {
    authService.logout().catch(() => {});
    clearUser();
    navigate('/', { replace: true });
  };

  return { user, isAuthenticated, isLoading, token, login, logout };
};
