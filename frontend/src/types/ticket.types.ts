// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//  1. Se agrega requiere_adjunto: boolean a la interfaz Ticket.
//  2. Se agrega adjuntos?: TicketAttachment[] a la interfaz Ticket.
//  3. Se agrega requiere_adjunto?: boolean a CreateTicketDto.
//  4. Se agrega trimestre_id?: number a CreateSprintDto para enviarlo al backend.
// ─────────────────────────────────────────────────────────────────────────────

// ── NUEVO IMPORT ──────────────────────────────────────────────────────────────
import { TicketAttachment } from './trimestre.types';

export type TicketStatus   = 'to_do' | 'in_progress' | 'testing' | 'done';
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

  // ── NUEVO: condición de completitud ─────────────────────────────────────
  // true → el ticket no puede pasar a 'done' sin al menos un adjunto.
  // Se activa automáticamente en sprints de trimestre documental.
  requiere_adjunto: boolean;

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

  // ── NUEVO: adjuntos del ticket ───────────────────────────────────────────
  // Se cargan en la vista de detalle del ticket (TicketDetailPage).
  adjuntos?: TicketAttachment[];
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
  // ── NUEVO: permite forzar el requisito de adjunto al crear ──────────────
  requiere_adjunto?: boolean;
}

export interface UpdateTicketStatusDto {
  estado: TicketStatus;
}

export interface CreateSprintDto {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  // ── NUEVO: para asociar el sprint a un trimestre ─────────────────────────
  trimestre_id?: number;
}