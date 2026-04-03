export type TicketStatus = 'to_do' | 'in_progress' | 'testing' | 'done';
export type TicketPriority = 'alta' | 'media' | 'baja';

export interface Ticket {
  id: number;
  proyecto_id: number;
  sprint_id?: number;
  titulo: string;
  descripcion: string;
  prioridad: TicketPriority;
  estado: TicketStatus;
  story_points: number;
  esta_bloqueado: boolean;
  motivo_bloqueo?: string;
  parent_id?: number;
  asignado_a?: number;
  asignado_a_rel?: {
    id: number;
    nombre: string;
    correo: string;
  };
  creado_por: number;
  creado_por_rel?: {
    id: number;
    nombre: string;
  };
  asignado_a_id?: number;
  creado_por_id?: number;
  fecha_limite?: string;
  creado_en: string;
  actualizado_en: string;
  subtareas?: Ticket[];
  proyecto?: {
    id: number;
    nombre: string;
  };
}

export interface CreateTicketDto {
  proyecto_id: number;
  sprint_id?: number;
  titulo: string;
  descripcion: string;
  prioridad?: TicketPriority;
  estado?: TicketStatus;
  story_points?: number;
  asignado_a?: number;
  fecha_limite?: string;
  parent_id?: number;
}

export interface UpdateTicketStatusDto {
  estado: TicketStatus;
}

export interface CreateSprintDto {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}