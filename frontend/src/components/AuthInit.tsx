/**
 * AuthInit — FIX DEFINITIVO DEL BUCLE
 *
 * Corre UNA sola vez al montar la app, verifica el token,
 * y siempre termina bajando isLoading a false.
 *
 * isLoading arranca en true en el store (ver auth.store.ts).
 * ProtectedRoute espera hasta que baje a false.
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

export const AuthInit = () => {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const { setUser, clearUser, setLoading } = useAuthStore.getState();
    const token = localStorage.getItem('access_token');

    if (!token) {
      setLoading(false);
      return;
    }

    authService
      .me()
      .then((user) => {
        setUser(user);
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        clearUser();
      });
  }, []);

  return null;
};
