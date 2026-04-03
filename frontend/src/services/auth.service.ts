import api from './api';

export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
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
};