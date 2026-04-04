import api from './api';

export const projectService = {
  // Todos los proyectos (coordinador)
  getAll: (params?: { fichaId?: number; instructorId?: number; liderId?: number }) => {
    const q = new URLSearchParams();
    if (params?.fichaId)      q.set('fichaId',      String(params.fichaId));
    if (params?.instructorId) q.set('instructorId', String(params.instructorId));
    if (params?.liderId)      q.set('liderId',      String(params.liderId));
    return api.get(`/projects${q.toString() ? `?${q}` : ''}`).then(r => r.data);
  },

  // Proyectos filtrados por rol del usuario autenticado
  getForMe: () => api.get('/projects/for-me').then(r => r.data),

  getById: (id: number) => api.get(`/projects/${id}`).then(r => r.data),

  create: (dto: any) => api.post('/projects', dto).then(r => r.data),

  update: (id: number, dto: any) => api.patch(`/projects/${id}`, dto).then(r => r.data),

  updateStatus: (id: number, estado: string) =>
    api.patch(`/projects/${id}/status`, { estado }).then(r => r.data),

  assignLider: (id: number, liderId: number) =>
    api.patch(`/projects/${id}/assign-lider`, { liderId }).then(r => r.data),

  delete: (id: number) => api.delete(`/projects/${id}`).then(r => r.data),

  getMembers: (id: number) => api.get(`/projects/${id}/members`).then(r => r.data),

  addMember: (id: number, userId: number) =>
    api.post(`/projects/${id}/members`, { userId }).then(r => r.data),

  removeMember: (id: number, userId: number) =>
    api.delete(`/projects/${id}/members/${userId}`).then(r => r.data),

  getSprints: (id: number) => api.get(`/projects/${id}/sprints`).then(r => r.data),

  getActiveSprint: (id: number) => api.get(`/projects/${id}/sprints/active`).then(r => r.data),

  createSprint: (id: number, dto: any) =>
    api.post(`/projects/${id}/sprints`, dto).then(r => r.data),

  startSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/start`).then(r => r.data),

  closeSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/close`).then(r => r.data),

  getVelocity: (id: number) => api.get(`/projects/${id}/velocity`).then(r => r.data),

  getBurnup:   (id: number) => api.get(`/projects/${id}/burnup`).then(r => r.data),
};