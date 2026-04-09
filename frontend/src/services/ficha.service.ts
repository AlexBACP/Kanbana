import api from './api';

export interface InstructorRef {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export interface Ficha {
  id: number;
  codigo: string;
  programa: string;
  fecha_inicio: string;
  fecha_fin: string;
  creado_en: string;
  instructor_id: number | null;
  instructor: InstructorRef | null;
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
  fecha_inicio: string;
  fecha_fin: string;
  instructor_id?: number | null;
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
};
