/**
 * AuthInit — FIX DEFINITIVO DEL BUCLE
 *
 * El bucle ocurría porque:
 * 1. AuthLayout redirigía a /dashboard mientras isLoading=true
 * 2. ProtectedRoute mostraba spinner porque isLoading=true
 * 3. Nadie bajaba isLoading a false porque el código que lo hacía
 *    estaba dentro de componentes bloqueados por el spinner
 *
 * Solución: AuthInit vive FUERA del BrowserRouter.
 * Corre UNA sola vez al montar la app, verifica el token,
 * y siempre termina bajando isLoading a false.
 *
 * useAuthStore.getState() — NO crea suscripción reactiva,
 * solo lee el estado puntualmente. Esto evita re-renders.
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

export const AuthInit = () => {
  const ran = useRef(false);

  useEffect(() => {
    // StrictMode ejecuta efectos dos veces en desarrollo — el ref lo previene
    if (ran.current) return;
    ran.current = true;

    const { setUser, clearUser, setLoading } = useAuthStore.getState();
    const token = localStorage.getItem('access_token');

    if (!token) {
      // Sin token: nada que verificar, liberar el spinner inmediatamente
      setLoading(false);
      return;
    }

    // Con token: verificar con el backend
    authService
      .me()
      .then((user) => {
        // setUser internamente llama setLoading(false) — ver auth.store.ts
        setUser(user);
      })
      .catch(() => {
        // Token inválido o expirado: limpiar todo
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // clearUser internamente llama setLoading(false) — ver auth.store.ts
        clearUser();
      });
    // NO hay .finally() porque setUser y clearUser ya bajan isLoading.
    // Un .finally() extra causaría una doble llamada que puede generar race conditions.
  }, []);

  return null;
};