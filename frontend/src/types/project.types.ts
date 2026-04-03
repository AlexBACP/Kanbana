import { Ticket } from './ticket.types';

export type ProjectStatus = 'activo' | 'pausado' | 'finalizado';

export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  ficha_id: number;
  ficha?: {
    id: number;
    codigo: string;
    programa: string;
  };
  competencia: string;
  resultado_aprendizaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: ProjectStatus;
  creado_en: string;
  sprints?: Sprint[];
}

export interface Sprint {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  esta_activo: boolean;
  esta_finalizado: boolean;
  proyecto_id: number;
  creado_en: string;
  tickets?: Ticket[];
}

export interface CreateProjectDto {
  nombre: string;
  descripcion: string;
  ficha_id: number;
  competencia: string;
  resultado_aprendizaje: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface CreateSprintDto {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}