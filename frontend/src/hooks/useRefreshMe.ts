/**
 * useRefreshMe
 *
 * Hook que verifica al montar si el perfil del usuario cambió en el servidor
 * (ej: un coordinador le cambió el sub-rol es_lider_tecnico mientras estaba logueado).
 *
 * Si detecta un cambio en `rol` o `es_lider_tecnico`, actualiza el auth store.
 * El componente padre (router) se re-renderizará con el dashboard correcto
 * sin necesidad de hacer logout/login.
 */
import { useEffect } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

export function useRefreshMe() {
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    authService.me()
      .then((fresh: any) => {
        if (!fresh || !user) return;
        const changed =
          fresh.es_lider_tecnico !== user.es_lider_tecnico ||
          fresh.rol              !== user.rol              ||
          fresh.activo           !== user.activo;

        if (changed) {
          setUser({ ...user, ...fresh });
        }
      })
      .catch(() => {
        // No hacer nada si falla — el usuario simplemente sigue con el store actual
      });
  }, []); // Solo al montar — no loops
}
