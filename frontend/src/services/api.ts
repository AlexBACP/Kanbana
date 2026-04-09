import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
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
// FIX DEL BUCLE: ya NO hacemos window.location.href='/login' en 401.
// Ese redirect duro reiniciaba la app completa en loop:
//   401 → redirect → AuthInit → token inválido → 401 → redirect → ...
//
// En su lugar, limpiamos el token y dejamos que Zustand + React Router
// manejen la navegación de forma declarativa (ProtectedRoute redirige).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const { useAuthStore } = require('../store/auth.store');
      const { clearUser } = useAuthStore.getState();
      // Solo limpiar si había una sesión activa (evitar loops en /login mismo)
      const token = localStorage.getItem('access_token');
      if (token) {
        clearUser();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
