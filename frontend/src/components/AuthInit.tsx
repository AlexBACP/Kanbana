import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

/**
 * AuthInit — Se ejecuta una sola vez al montar la app.
 * Responsabilidad: Verificar si el token almacenado sigue siendo válido
 * y recuperar la sesión del usuario.
 */
export const AuthInit = () => {
  // ✅ CAMBIO 1: Acceder a las acciones de forma segura
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = localStorage.getItem('access_token');
    
    // Si no hay token, simplemente dejamos de cargar
    if (!token) {
      setLoading(false);
      return;
    }

    // Iniciamos la carga mientras validamos el token con el backend
    setLoading(true);

    authService
      .me() // ✅ Asumo que .me() es tu endpoint /auth/profile
      .then((user) => {
        // ✅ CAMBIO 2: Si el backend responde, hidratamos el store
        setUser(user);
      })
      .catch(() => {
        // ✅ CAMBIO 3: Limpieza centralizada si el token falló
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        clearUser();
      })
      .finally(() => {
        // Finalizamos el estado de carga global
        setLoading(false);
      });
      
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Este componente no renderiza nada visual, es un guardián lógico
  return null;
};