import api from './api';

export interface InstructorRef {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export type TipoFormacion = 'tecnologo' | 'tecnico';

export type JornadaFicha = 'mañana' | 'tarde' | 'noche';

export interface Ficha {
  id: number;
  codigo: string;
  programa: string;
  tipo_formacion: TipoFormacion;
  jornada: JornadaFicha;
  fecha_inicio: string;
  fecha_fin: string;
  creado_en: string;
  instructor_id: number | null;
  instructor: InstructorRef | null;
}

export interface ModuloPlantilla {
  nombre: string;
  descripcion: string;
  semanas: number;
  requiere_adjunto?: boolean;
}

export interface TrimestrePlantilla {
  nombre: string;
  descripcion: string;
  tipo: 'documental' | 'desarrollo';
  modulos: ModuloPlantilla[];
}

export interface SugerenciaModulo {
  categoria:   string;
  nombre:      string;
  descripcion: string;
}

export interface FichaMember {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  avatar_url?: string;
  activo: boolean;
}

export interface CreateFichaDto {
  codigo: string;
  programa: string;
  tipo_formacion: TipoFormacion;
  /** Opcional: si se omite, el backend usa la fecha actual. */
  fecha_inicio?: string;
  /** Opcional: si se omite, el backend la calcula automáticamente según tipo. */
  fecha_fin?: string;
  instructor_id?: number | null;
  /**
   * Módulos SDLC deseleccionados por el instructor, como claves
   * "<trimestreIndex>:<moduloIndex>". Vacío/omitido = todos incluidos.
   */
  modulos_excluidos?: string[];
}

export const fichaService = {
  getAll: async (): Promise<Ficha[]> => {
    const { data } = await api.get('/fichas');
    return data;
  },

  getById: async (id: number): Promise<Ficha> => {
    const { data } = await api.get(`/fichas/${id}`);
    return data;
  },

  create: async (dto: CreateFichaDto): Promise<Ficha> => {
    const { data } = await api.post('/fichas', dto);
    return data;
  },

  /**
   * Valida formato + existencia de MX del dominio de una lista de correos.
   * Lo usa el preview de importación para detectar correos cuyo dominio
   * no puede recibir emails (typos, dominios inexistentes) antes de importar.
   */
  validarCorreos: async (correos: string[]): Promise<{
    correo: string; formatoValido: boolean; dominioValido: boolean;
  }[]> => {
    const { data } = await api.post('/fichas/validar-correos', { correos });
    return data;
  },

  update: async (id: number, dto: Partial<CreateFichaDto>): Promise<Ficha> => {
    const { data } = await api.patch(`/fichas/${id}`, dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/fichas/${id}`);
  },

  // ── Gestión de aprendices vinculados a la ficha ──────────────────────

  /** Aprendices/líderes vinculados a esta ficha */
  getMembers: async (fichaId: number): Promise<FichaMember[]> => {
    const { data } = await api.get(`/fichas/${fichaId}/members`);
    return data;
  },

  /** Aprendices sin ficha asignada (disponibles para vincular) */
  getAvailableUsers: async (): Promise<FichaMember[]> => {
    const { data } = await api.get('/fichas/available-users');
    return data;
  },

  /** Añadir uno o varios aprendices a la ficha en una sola operación */
  addMembers: async (fichaId: number, userIds: number[]): Promise<{ added: number[]; errors: { id: number; reason: string }[] }> => {
    const { data } = await api.post(`/fichas/${fichaId}/members`, { userIds });
    return data;
  },

  /** Desvincular múltiples aprendices de la ficha en masa */
  removeMembers: async (fichaId: number, userIds: number[]): Promise<{ removed: number[]; errors: { id: number; reason: string }[] }> => {
    const { data } = await api.delete(`/fichas/${fichaId}/members`, { data: { userIds } });
    return data;
  },

  /** Desvincular aprendiz de la ficha */
  removeMember: async (fichaId: number, userId: number): Promise<void> => {
    await api.delete(`/fichas/${fichaId}/members/${userId}`);
  },

  /** Promover aprendiz a líder técnico */
  promoteToLider: async (fichaId: number, userId: number): Promise<FichaMember> => {
    const { data } = await api.patch(`/fichas/${fichaId}/members/${userId}/promote`);
    return data;
  },

  /** Degradar líder técnico a aprendiz */
  demoteToAprendiz: async (fichaId: number, userId: number): Promise<FichaMember> => {
    const { data } = await api.patch(`/fichas/${fichaId}/members/${userId}/demote`);
    return data;
  },

  /** Descargar plantilla Excel para importación de aprendices */
  downloadTemplate: async (): Promise<void> => {
    const response = await api.get('/fichas/download/template', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_aprendices.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Importar aprendices desde un archivo Excel */
  importFromExcel: async (
    fichaId: number,
    file: File,
  ): Promise<{ created: number; linked: number; errors: { fila: number; correo: string; reason: string }[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`/fichas/${fichaId}/members/import-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },


  invitarAprendiz: (fichaId: number, dto: { nombre: string; correo: string; documento: string }) =>
    api.post(`/fichas/${fichaId}/aprendices/invitar`, dto).then(r => r.data),

  reenviarInvitacion: (fichaId: number, userId: number) =>
    api.post(`/fichas/${fichaId}/aprendices/${userId}/reenviar`).then(r => r.data),

  /** Obtener trimestres de una ficha */
  getTrimestres: (fichaId: number) =>
    api.get(`/fichas/${fichaId}/trimestres`).then(r => r.data),

  /** Generar/reconfigurar trimestres de una ficha */
  generateTrimestres: (fichaId: number, dto: { num: number; trimestres?: any[] }) =>
    api.post(`/fichas/${fichaId}/trimestres/generate`, dto).then(r => r.data),

  /** Editar nombre/fechas de un trimestre */
  updateTrimestre: (trimestreId: number, dto: any) =>
    api.patch(`/fichas/trimestres/${trimestreId}`, dto).then(r => r.data),

  // ── Plantilla SDLC + sugerencias de módulos ────────────────────────────────

  /** Plantilla de trimestres + módulos que se generarán al crear la ficha */
  getPlantilla: (tipo: TipoFormacion): Promise<TrimestrePlantilla[]> =>
    api.get(`/fichas/plantilla?tipo=${tipo}`).then(r => r.data),

  /** Sugerencias de módulos adicionales relevantes para un trimestre dado */
  getSugerenciasModulos: (trimestre: number, categoria?: string): Promise<SugerenciaModulo[]> => {
    const q = new URLSearchParams({ trimestre: String(trimestre) });
    if (categoria) q.set('categoria', categoria);
    return api.get(`/fichas/sugerencias-modulos?${q.toString()}`).then(r => r.data);
  },

  // ── Flujo legacy (se mantienen para compatibilidad con notifs antiguas) ────

  /** [Legacy] Instructor ya no requiere pedir permiso — crea fichas directamente */
  solicitarCrear: () =>
    api.post('/fichas/solicitar-crear').then(r => r.data),

  /** [Legacy] Aprobación coordinador (ya no necesario) */
  responderSolicitud: (instructorId: number, aprobada: boolean, motivo?: string) =>
    api.post('/fichas/responder-solicitud', { instructorId, aprobada, motivo }).then(r => r.data),

  /** [Legacy] Estado de permiso (ahora siempre devuelve puede_crear: true) */
  getPermisoCrear: (): Promise<{ puede_crear: boolean; solicitud_pendiente: boolean }> =>
    api.get('/fichas/permiso-crear').then(r => r.data),
};