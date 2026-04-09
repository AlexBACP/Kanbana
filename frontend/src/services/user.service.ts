import api from './api';

const BASE = 'http://localhost:3000';

export const userService = {
  getAll: (rol?: string) =>
    api.get(`/users${rol ? `?rol=${rol}` : ''}`).then(r => r.data),

  getMyContext: () => api.get('/users/me/context').then(r => r.data),

  getByFicha: (fichaId: number) =>
    api.get(`/users/by-ficha/${fichaId}`).then(r => r.data),

  getByProyecto: (proyectoId: number) =>
    api.get(`/users/by-proyecto/${proyectoId}`).then(r => r.data),

  getById: (id: number) => api.get(`/users/${id}`).then(r => r.data),

  // Perfil completo enriquecido (fichas, proyectos, tickets según rol)
  getProfile: (id: number) => api.get(`/users/${id}/profile`).then(r => r.data),

  create: (dto: any) => api.post('/users', dto).then(r => r.data),

  update: (id: number, dto: any) => api.patch(`/users/${id}`, dto).then(r => r.data),

  updateRole: (id: number, rol: string) =>
    api.patch(`/users/${id}/role`, { rol }).then(r => r.data),

  toggleStatus: (id: number) => api.patch(`/users/${id}/toggle`).then(r => r.data),

  delete: (id: number) => api.delete(`/users/${id}`).then(r => r.data),

  getLeaderStats: (id: number) => api.get(`/users/leaders/${id}/stats`).then(r => r.data),

  getLeaderTeam: (id: number) => api.get(`/users/leaders/${id}/team`).then(r => r.data),

  // Cambiar contraseña propia (necesita contraseña actual)
  changeOwnPassword: (id: number, actual: string, nueva: string) =>
    api.patch(`/users/${id}/password/own`, { actual, nueva }).then(r => r.data),

  // Cambiar contraseña ajena (coordinador / instructor sobre sus aprendices)
  changePasswordAsAdmin: (targetId: number, nueva: string) =>
    api.patch(`/users/${targetId}/password/admin`, { nueva }).then(r => r.data),

  // Upload de avatar real — multipart/form-data
  uploadAvatar: async (id: number, file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post(`/users/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Helper para construir la URL pública del avatar
  getAvatarUrl: (avatar_url: string | null | undefined): string | null => {
    if (!avatar_url) return null;
    if (avatar_url.startsWith('http') || avatar_url.startsWith('data:')) return avatar_url;
    return `${BASE}${avatar_url}`;
  },
};
