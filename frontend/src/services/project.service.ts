import api from './api';
import { Project, CreateProjectDto, Sprint, CreateSprintDto } from '../types/project.types';

export const projectService = {
  getAll: async (): Promise<Project[]> => {
    const { data } = await api.get('/projects');
    return data;
  },

  getById: async (id: number): Promise<Project> => {
    const { data } = await api.get(`/projects/${id}`);
    return data;
  },

  create: async (dto: CreateProjectDto): Promise<Project> => {
    const { data } = await api.post('/projects', dto);
    return data;
  },

  update: async (id: number, dto: Partial<CreateProjectDto>): Promise<Project> => {
    const { data } = await api.patch(`/projects/${id}`, dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  // --- NUEVO: Gestión de Estados del Proyecto ---
  // Permite al Administrador activar, pausar o finalizar una celda de desarrollo
  updateStatus: async (id: number, estado: 'activo' | 'pausado' | 'finalizado'): Promise<Project> => {
    const { data } = await api.patch(`/projects/${id}/status`, { estado });
    return data;
  },

  // --- NUEVO: Asignación Masiva / Cambio de Líder ---
  // Útil si un Líder Técnico se retira y necesitas mover el proyecto a otro
  reassignLeader: async (projectId: number, leaderId: number): Promise<Project> => {
    const { data } = await api.patch(`/projects/${projectId}/reassign`, { leaderId });
    return data;
  },

  // Sprints
  getSprints: async (projectId: number): Promise<Sprint[]> => {
    const { data } = await api.get(`/projects/${projectId}/sprints`);
    return data;
  },

  getActiveSprint: async (projectId: number): Promise<Sprint | null> => {
    const { data } = await api.get(`/projects/${projectId}/sprints/active`);
    return data;
  },

  createSprint: async (projectId: number, dto: CreateSprintDto): Promise<Sprint> => {
    const { data } = await api.post(`/projects/${projectId}/sprints`, dto);
    return data;
  },

  startSprint: async (sprintId: number): Promise<Sprint> => {
    const { data } = await api.patch(`/projects/sprints/${sprintId}/start`);
    return data;
  },

  closeSprint: async (sprintId: number): Promise<Sprint> => {
    const { data } = await api.patch(`/projects/sprints/${sprintId}/close`);
    return data;
  },

  getVelocity: async (projectId: number): Promise<any[]> => {
    const { data } = await api.get(`/projects/${projectId}/stats/velocity`);
    return data;
  },

  getBurnup: async (projectId: number): Promise<any[]> => {
    const { data } = await api.get(`/projects/${projectId}/stats/burnup`);
    return data;
  },

  // --- NUEVO: Estadísticas de Salud del Proyecto ---
  // Para mostrar en el panel de Proyectos si el proyecto va a tiempo o retrasado
  getProjectHealth: async (projectId: number): Promise<{ progress: number; healthScore: number }> => {
    const { data } = await api.get(`/projects/${projectId}/health`);
    return data;
  }
};