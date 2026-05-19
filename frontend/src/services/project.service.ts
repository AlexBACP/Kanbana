// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//  Se agregan al final los métodos para gestión de trimestres:
//   - getTrimestres()
//   - createTrimestre()
//   - createSprintEnTrimestre()
//   - closeTrimestre()
//  Todos los métodos existentes se mantienen sin cambios.
// ─────────────────────────────────────────────────────────────────────────────

import api from './api';
import { CreateTrimestreDto } from '../types/trimestre.types';

export const projectService = {
  // ── Existentes sin cambios ────────────────────────────────────────────────

  getAll: (params?: { fichaId?: number; instructorId?: number; liderId?: number }) => {
    const q = new URLSearchParams();
    if (params?.fichaId)      q.set('fichaId',      String(params.fichaId));
    if (params?.instructorId) q.set('instructorId', String(params.instructorId));
    if (params?.liderId)      q.set('liderId',      String(params.liderId));
    return api.get(`/projects${q.toString() ? `?${q}` : ''}`).then(r => r.data);
  },

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

  solicitarSprint: (id: number, body: { nombre: string; justificacion?: string }) =>
    api.post(`/projects/${id}/solicitar-sprint`, body).then(r => r.data),

  getActiveSprint: (id: number) =>
    api.get(`/projects/${id}/sprints/active`).then(r => r.data),

  createSprint: (id: number, dto: any) =>
    api.post(`/projects/${id}/sprints`, dto).then(r => r.data),

  startSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/start`).then(r => r.data),

  closeSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/close`).then(r => r.data),

  getVelocity: (id: number) => api.get(`/projects/${id}/velocity`).then(r => r.data),

  getBurnup: (id: number) => api.get(`/projects/${id}/burnup`).then(r => r.data),

  // ══ NUEVOS: gestión de trimestres ═════════════════════════════════════════

  // Devuelve los trimestres del proyecto ordenados (T1 → T2 → T3),
  // cada uno con sus sprints y los tickets de cada sprint.
  // Se usa en TrimestresView para renderizar la vista agrupada.
  getTrimestres: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/trimestres`).then(r => r.data),

  // Crea un trimestre adicional manualmente (casos especiales).
  createTrimestre: (proyectoId: number, dto: CreateTrimestreDto) =>
    api.post(`/projects/${proyectoId}/trimestres`, dto).then(r => r.data),

  // Crea un sprint directamente dentro de un trimestre específico.
  // Más semántico que createSprint() con trimestre_id en el body.
  createSprintEnTrimestre: (proyectoId: number, trimestreId: number, dto: any) =>
    api.post(`/projects/${proyectoId}/trimestres/${trimestreId}/sprints`, dto).then(r => r.data),

  // Cierra un trimestre. Solo funciona si todos sus sprints están finalizados.
  closeTrimestre: (trimestreId: number) =>
    api.patch(`/projects/trimestres/${trimestreId}/close`).then(r => r.data),
  // Genera trimestres para proyectos existentes o reconfigura los actuales
  generateTrimestres: (proyectoId: number, dto: { num: number; trimestres?: any[] }) =>
    api.post(`/projects/${proyectoId}/trimestres/generate`, dto).then(r => r.data),

  // Genera trimestres para múltiples proyectos a la vez
  bulkGenerateTrimestres: (dto: { projectIds: number[]; num: number; trimestres?: any[] }) =>
    api.post(`/projects/trimestres/bulk-generate`, dto).then(r => r.data),

  // Edita un trimestre existente (nombre, fechas, tipo)
  updateTrimestre: (trimestreId: number, dto: any) =>
    api.patch(`/projects/trimestres/${trimestreId}`, dto).then(r => r.data),

  // Vincula o desvincula un sprint de un trimestre
  assignSprintToTrimestre: (sprintId: number, trimestreId: number | null) =>
    api.patch(`/projects/sprints/${sprintId}/assign-trimestre`, { trimestreId }).then(r => r.data),

  // Sprints sin trimestre asignado de un proyecto
  getSprintsSinTrimestre: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/trimestres/sprints-sin-trimestre`).then(r => r.data),

};