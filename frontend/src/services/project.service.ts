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

  assignLider: (id: number, liderId: number | null) =>
    api.patch(`/projects/${id}/assign-lider`, { liderId }).then(r => r.data),

  delete: (id: number) => api.delete(`/projects/${id}`).then(r => r.data),

  getMembers: (id: number) => api.get(`/projects/${id}/members`).then(r => r.data),

  addMember: (id: number, userId: number) =>
    api.post(`/projects/${id}/members`, { userId }).then(r => r.data),

  removeMember: (id: number, userId: number) =>
    api.delete(`/projects/${id}/members/${userId}`).then(r => r.data),

  getSprints: (id: number) => api.get(`/projects/${id}/sprints`).then(r => r.data),

  solicitarSprint: (id: number, body: { nombre: string; justificacion?: string; fecha_inicio?: string; fecha_fin?: string }) =>
    api.post(`/projects/${id}/solicitar-sprint`, body).then(r => r.data),

  acceptSprintSolicitud: (notifId: number) =>
    api.post(`/projects/sprints/solicitud/${notifId}/accept`).then(r => r.data),

  rejectSprintSolicitud: (notifId: number, motivo?: string) =>
    api.post(`/projects/sprints/solicitud/${notifId}/reject`, { motivo }).then(r => r.data),

  getActiveSprint: (id: number) =>
    api.get(`/projects/${id}/sprints/active`).then(r => r.data),

  createSprint: (id: number, dto: any) =>
    api.post(`/projects/${id}/sprints`, dto).then(r => r.data),

  updateSprint: (sprintId: number, dto: { nombre?: string; fecha_inicio?: string; fecha_fin?: string; descripcion?: string | null }) =>
    api.patch(`/projects/sprints/${sprintId}`, dto).then(r => r.data),

  startSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/start`).then(r => r.data),

  closeSprint: (sprintId: number) =>
    api.patch(`/projects/sprints/${sprintId}/close`).then(r => r.data),

  getVelocity: (id: number) => api.get(`/projects/${id}/velocity`).then(r => r.data),

  getBurnup: (id: number) => api.get(`/projects/${id}/burnup`).then(r => r.data),

  // ══ NUEVOS: gestión de trimestres ═════════════════════════════════════════
  //
  // NOTA: tres métodos previos (createTrimestre, createSprintEnTrimestre,
  // closeTrimestre) fueron eliminados porque apuntaban a endpoints inexistentes
  // en el backend y siempre devolvían 404. La forma correcta de crear un
  // sprint dentro de un trimestre es usar createSprint() con trimestre_id en el body.

  // Devuelve los trimestres del proyecto ordenados (T1 → T2 → T3),
  // cada uno con sus sprints y los tickets de cada sprint.
  // Se usa en TrimestresView para renderizar la vista agrupada.
  getTrimestres: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/trimestres`).then(r => r.data),

  // Genera trimestres para proyectos existentes o reconfigura los actuales
  generateTrimestres: (proyectoId: number, dto: { num: number; trimestres?: any[] }) =>
    api.post(`/projects/${proyectoId}/trimestres/generate`, dto).then(r => r.data),

  // Genera los módulos (sprints) de la plantilla SDLC para un proyecto existente
  // que no tiene módulos. force=true regenera (borra los no finalizados).
  generarModulos: (proyectoId: number, force = false) =>
    api.post(`/projects/${proyectoId}/generar-modulos`, { force }).then(r => r.data),

  // ══ SUGERENCIAS INTELIGENTES DE MÓDULOS (IA + catálogo SDLC) ═══════════════
  // Lista las sugerencias activas agrupadas por trimestre.
  getSugerencias: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/sugerencias`).then(r => r.data),

  // Genera sugerencias (si no hay) analizando el contexto del proyecto.
  generarSugerencias: (proyectoId: number) =>
    api.post(`/projects/${proyectoId}/sugerencias/generar`).then(r => r.data),

  // Fuerza un nuevo análisis (descarta las pendientes y vuelve a sugerir).
  regenerarSugerencias: (proyectoId: number) =>
    api.post(`/projects/${proyectoId}/sugerencias/regenerar`).then(r => r.data),

  // Convierte una sugerencia en un módulo (sprint) editable con un clic.
  crearModuloSugerencia: (sugId: number) =>
    api.post(`/projects/sugerencias/${sugId}/crear-modulo`).then(r => r.data),

  // Descarta una sugerencia.
  descartarSugerencia: (sugId: number) =>
    api.post(`/projects/sugerencias/${sugId}/descartar`).then(r => r.data),

  // Genera trimestres para múltiples proyectos a la vez
  bulkGenerateTrimestres: (dto: { projectIds: number[]; num: number; trimestres?: any[] }) =>
    api.post(`/projects/trimestres/bulk-generate`, dto).then(r => r.data),

  // Edita un trimestre existente (nombre, fechas, tipo)
  updateTrimestre: (trimestreId: number, dto: any) =>
    api.patch(`/projects/trimestres/${trimestreId}`, dto).then(r => r.data),

  // Cierra un trimestre (marca como finalizado)
  closeTrimestre: (trimestreId: number) =>
    api.patch(`/projects/trimestres/${trimestreId}/close`).then(r => r.data),

  // Vincula o desvincula un sprint de un trimestre
  assignSprintToTrimestre: (sprintId: number, trimestreId: number | null) =>
    api.patch(`/projects/sprints/${sprintId}/assign-trimestre`, { trimestreId }).then(r => r.data),

  // Sprints sin trimestre asignado de un proyecto
  getSprintsSinTrimestre: (proyectoId: number) =>
    api.get(`/projects/${proyectoId}/trimestres/sprints-sin-trimestre`).then(r => r.data),

  // ══ FLUJO DE REVISIÓN DE MÓDULOS ══════════════════════════════════════════

  // Líder envía un módulo (sprint) a revisión del instructor.
  // Valida que todas las tareas estén en testing o done.
  solicitarRevision: (sprintId: number) =>
    api.post(`/projects/sprints/${sprintId}/solicitar-revision`).then(r => r.data),

  // Instructor solicita correcciones al líder sobre un módulo.
  solicitarCorrecciones: (sprintId: number, mensaje: string) =>
    api.post(`/projects/sprints/${sprintId}/correcciones`, { mensaje }).then(r => r.data),

  // Instructor: lista de sprints pendientes de revisión en sus proyectos.
  getSprintsPendientesRevision: () =>
    api.get('/projects/sprints/pending-review').then(r => r.data),

};