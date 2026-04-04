import api from './api';

export const userService = {
  // Lista completa (coordinador)
  getAll: (rol?: string) =>
    api.get(`/users${rol ? `?rol=${rol}` : ''}`).then(r => r.data),

  // Usuarios visibles para el usuario autenticado (filtrado por rol en backend)
  getMyContext: () => api.get('/users/me/context').then(r => r.data),

  // Usuarios de una ficha específica
  getByFicha: (fichaId: number) =>
    api.get(`/users/by-ficha/${fichaId}`).then(r => r.data),

  // Miembros de un proyecto
  getByProyecto: (proyectoId: number) =>
    api.get(`/users/by-proyecto/${proyectoId}`).then(r => r.data),

  getById: (id: number) => api.get(`/users/${id}`).then(r => r.data),

  create: (dto: any) => api.post('/users', dto).then(r => r.data),

  update: (id: number, dto: any) => api.patch(`/users/${id}`, dto).then(r => r.data),

  updateRole: (id: number, rol: string) =>
    api.patch(`/users/${id}/role`, { rol }).then(r => r.data),

  toggleStatus: (id: number) => api.patch(`/users/${id}/toggle`).then(r => r.data),

  delete: (id: number) => api.delete(`/users/${id}`).then(r => r.data),

  getLeaderStats: (id: number) => api.get(`/users/leaders/${id}/stats`).then(r => r.data),

  getLeaderTeam: (id: number) => api.get(`/users/leaders/${id}/team`).then(r => r.data),
};