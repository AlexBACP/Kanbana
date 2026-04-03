import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

/**
 * useAuth — Hook de acciones de autenticación.
 * La validación del token inicial la maneja AuthInit.
 * Este hook provee las acciones de login/logout y el estado reactivo del store.
 */
export const useAuth = () => {
  const navigate = useNavigate();
  
  // Extraemos todo lo necesario del store
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    token, 
    setUser, 
    setToken, 
    clearUser, 
    setLoading 
  } = useAuthStore();

  const login = async (email: string, password: string) => {
    // ✅ CAMBIO 1: Activamos el estado de carga global
    setLoading(true);
    
    try {
      const response = await authService.login({ email, password });
      const { access_token, refresh_token } = response.tokens;

      // ✅ CAMBIO 2: Sincronización de tokens
      // Guardamos en localStorage para persistencia manual (útil para interceptores Axios)
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      // Actualizamos el store global
      setToken(access_token);
      setUser(response.user);

      // ✅ CAMBIO 3: Navegación con 'replace'
      // Usamos replace: true para que el usuario no pueda volver al login con el botón "atrás"
      const destination = response.user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
      navigate(destination, { replace: true });
      
      return response.user;
    } catch (error) {
      // Dejamos que el componente (LoginPage) maneje el error visualmente
      throw error; 
    } finally {
      // ✅ CAMBIO 4: Siempre desactivamos el loading, sea éxito o error
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Intentamos avisar al backend, pero procedemos con la limpieza local pase lo que pase
      await authService.logout().catch(() => {});
    } finally {
      // ✅ CAMBIO 5: Limpieza total y redirección segura
      clearUser();
      navigate('/login', { replace: true });
    }
  };

  return { 
    user, 
    isAuthenticated, 
    isLoading, 
    token, 
    login, 
    logout 
  };
};