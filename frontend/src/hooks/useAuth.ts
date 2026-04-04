/**
 * useAuth — login y logout.
 * NO tiene useEffect de verificación — eso es responsabilidad de AuthInit.
 *
 * login() detecta si está corriendo dentro de un popup:
 * - En popup: no llama navigate (el popup no tiene que navegar, se cierra).
 * - Normal: navega al dashboard según el rol.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

const isPopup = () => {
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
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setUser(response.user);

    // Si estamos en un popup, la LoginPage maneja el postMessage y window.close()
    // No navegar desde aquí para no causar errores de contexto
    if (!isPopup()) {
      const rol = response.user.rol;
      navigate(rol === 'aprendiz' ? '/kanban' : '/dashboard');
    }
  };

  const logout = () => {
    authService.logout().catch(() => {});
    clearUser();
    navigate('/');
  };

  return { user, isAuthenticated, isLoading, token, login, logout };
};