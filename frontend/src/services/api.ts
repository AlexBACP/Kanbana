import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

// En producción el frontend es servido por nginx que proxia /api → backend.
// En desarrollo Vite proxia /api → localhost:3000 (ver vite.config.ts).
// Usar ruta relativa evita hardcodear el host/puerto del VPS.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// ─── Interceptor de peticiones ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor de respuestas ───────────────────────────────────────────
// ── MODIFICADO ────────────────────────────────────────────────────────────
// Antes: un 401 limpiaba la sesión inmediatamente, expulsando al usuario
// aunque tuviera un refresh_token válido en localStorage.
//
// Ahora: al recibir un 401 se intenta renovar el access_token usando el
// refresh_token. Si el refresco funciona, la petición original se reintenta
// de forma transparente — el usuario no nota nada. Solo si el refresco
// también falla (ambos tokens expirados) se limpia la sesión y ProtectedRoute
// redirige al login.
//
// Se usa una flag '_retry' en la config de la petición para evitar bucles
// infinitos (si la petición de refresco misma devuelve 401, no se reintenta).
// ─────────────────────────────────────────────────────────────────────────

let isRefreshing = false;
// Cola de peticiones que llegaron mientras se estaba refrescando el token.
// Se resuelven o rechazan todas juntas cuando el refresco termina.
let pendingQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

const processPendingQueue = (error: any, token: string | null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Solo intentar el refresco en 401, y solo una vez por petición
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Si no hay refresh_token, no tiene sentido intentar — limpiar y salir
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      const token = localStorage.getItem('access_token');
      if (token) useAuthStore.getState().clearUser();
      return Promise.reject(error);
    }

    // Si ya hay un refresco en curso, encolar esta petición
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    // Marcar que estamos refrescando y que esta petición ya fue reintentada
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Llamar directamente con fetch para evitar que el propio interceptor
      // capture el error de este refresco y cause un bucle
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) throw new Error('Refresh fallido');

      const data = await res.json();
      const newAccessToken: string = data.access_token;

      // Guardar el nuevo token y actualizar el store
      localStorage.setItem('access_token', newAccessToken);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      useAuthStore.getState().setToken(newAccessToken);

      // Resolver las peticiones en cola con el nuevo token
      processPendingQueue(null, newAccessToken);

      // Reintentar la petición original con el nuevo token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);

    } catch (refreshError) {
      // El refresh falló — ambos tokens expirados, limpiar sesión
      processPendingQueue(refreshError, null);
      useAuthStore.getState().clearUser();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;