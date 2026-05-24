import api from './api';

export const recursoService = {
  getAll: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/recursos`).then(r => r.data),

  create: (proyectoId: number, dto: {
    nombre: string;
    url: string;
    descripcion?: string;
    tipo?: string;
    orden?: number;
    trimestre_id?: number;
  }) =>
    api.post(`/projects/${proyectoId}/recursos`, dto).then(r => r.data),

  update: (proyectoId: number, id: number, dto: Partial<{
    nombre: string;
    url: string;
    descripcion: string;
    tipo: string;
    orden: number;
  }>) =>
    api.patch(`/projects/${proyectoId}/recursos/${id}`, dto).then(r => r.data),

  remove: (proyectoId: number, id: number) =>
    api.delete(`/projects/${proyectoId}/recursos/${id}`).then(r => r.data),

  /** Guarda un token privado de GitHub para este recurso (enviado encriptado al backend) */
  saveToken: (proyectoId: number, id: number, token: string) =>
    api.patch(`/projects/${proyectoId}/recursos/${id}/token`, { token }).then(r => r.data),

  /** Proxy hacia GitHub API — devuelve commits, PRs y datos del repo en vivo */
  getGitHubData: (proyectoId: number, id: number) =>
    api.get(`/projects/${proyectoId}/recursos/${id}/github`).then(r => r.data),
};
