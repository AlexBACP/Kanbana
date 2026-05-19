/**
 * useAuth — solo login y logout.
 *
 * NO tiene useEffect de verificación de token — eso es responsabilidad
 * exclusiva de AuthInit (que corre una vez al arrancar la app).
 *
 * ── MODIFICADO ────────────────────────────────────────────────────────────
 * Cambio respecto a la versión anterior:
 *   Antes: login() detectaba si la página estaba corriendo dentro de un
 *   popup (función isPopup). Si era popup, en lugar de navegar enviaba un
 *   postMessage a la ventana padre y se cerraba con window.close().
 *
 *   Como la app dejó de usar el patrón de ventana emergente para el login
 *   (ver LandingPage), esa rama ya no tiene sentido.
 *
 *   Ahora: login() siempre hace lo mismo — guarda los tokens, hidrata el
 *   store y navega al dashboard del rol en la misma pestaña.
 *
 *   Se ELIMINARON: la función isPopup() y la rama postMessage/window.close().
 *   logout() queda exactamente igual.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, token, setUser, setToken, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    const { access_token, refresh_token } = response.tokens;

    // Guardar tokens en localStorage
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    // Hidratar el store de autenticación
    setToken(access_token);
    setUser(response.user);

    // ── MODIFICADO: navegación única, sin rama de popup ──────────────────
    // Antes aquí se comprobaba isPopup() y, de ser popup, se hacía
    // postMessage + window.close(). Ahora siempre se navega normal.
    const rol = response.user.rol;
    navigate(rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
  };

  const logout = () => {
    authService.logout().catch(() => {});
    clearUser();
    navigate('/', { replace: true });
  };

  return { user, isAuthenticated, isLoading, token, login, logout };
};