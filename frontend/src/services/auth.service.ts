import api from './api';

export const authService = {
  login: async (credentials: { email: string; password: string; totpCode?: string }) => {
    const { data } = await api.post('/auth/login', credentials);
    return data as
      | { requires2fa: true }
      | { user: any; tokens: { access_token: string; refresh_token: string } };
  },

  /** Registro público — crea una cuenta de aprendiz (activa de inmediato) */
  register: async (dto: { nombre: string; correo: string; contrasena: string }) => {
    const { data } = await api.post('/auth/register', dto);
    return data as { id: number; nombre: string; correo: string };
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  refreshToken: async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    const { data } = await api.post('/auth/refresh', { refresh_token });
    return data;
  },

  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  // ── 2FA ──────────────────────────────────────────────────────────────────

  /** Genera el secreto y devuelve el QR code como data URL */
  setup2fa: async (): Promise<{ secret: string; qrCodeDataUrl: string }> => {
    const { data } = await api.post('/auth/2fa/setup');
    return data;
  },

  /** Activa el 2FA con el primer código escaneado */
  enable2fa: async (code: string): Promise<{ success: true }> => {
    const { data } = await api.post('/auth/2fa/enable', { code });
    return data;
  },

  /** Desactiva el 2FA con un código válido */
  disable2fa: async (code: string): Promise<{ success: true }> => {
    const { data } = await api.post('/auth/2fa/disable', { code });
    return data;
  },

  /** Estado actual del 2FA */
  get2faStatus: async (): Promise<{ enabled: boolean }> => {
    const { data } = await api.get('/auth/2fa/status');
    return data;
  },
};