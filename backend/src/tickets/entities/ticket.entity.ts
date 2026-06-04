// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//
//  1. Campo requiere_adjunto (boolean, default false):
//     Cuando es true, el ticket NO puede pasar a estado 'done' si no tiene
//     al menos un adjunto subido. El backend lo verifica en updateStatus().
//     Se setea automáticamente en true cuando el ticket pertenece a un sprint
//     de un trimestre de tipo 'documental'. El instructor también puede
//     activarlo manualmente en cualquier ticket.
//
//  2. Relación OneToMany hacia TicketAttachment (adjuntos[]):
//     Permite cargar todos los archivos del ticket con una sola query.
//     Se incluye en findOne() y en la validación de closeSprint().
// ─────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { Project }  from '../../projects/entities/project.entity';
import { User }     from '../../users/entities/user.entity';
import { Comment }  from '../../comments/entities/comment.entity';
import { Sprint }   from '../../projects/entities/sprint.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import { TicketAttachment } from './ticket-attachment.entity';

export enum TicketPriority {
  ALTA  = 'alta',
  MEDIA = 'media',
  BAJA  = 'baja',
}

export enum TicketStatus {
  TODO        = 'to_do',
  IN_PROGRESS = 'in_progress',
  TESTING     = 'testing',
  DONE        = 'done',
}

export enum TicketType {
  TASK  = 'task',
  BUG   = 'bug',
  STORY = 'story',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Proyecto ──────────────────────────────────────────────────────────────
  @Column()
  proyecto_id: number;

  @ManyToOne(() => Project, (project) => project.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  // ── Sprint ────────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  sprint_id: number;

  @ManyToOne(() => Sprint, (sprint) => sprint.tickets, {
    nullable:  true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sprint_id' })
  sprint: Sprint;

  // ── Trimestre ───────────────────────────────────────────────────────────────
  // A qué trimestre pertenece la tarea. Permite que las tareas SIN módulo
  // (cola de trabajo) sigan acotadas a un trimestre concreto, en vez de aparecer
  // en todos. Cuando la tarea tiene módulo, se sincroniza con el trimestre de ese
  // módulo.
  @Column({ nullable: true })
  trimestre_id: number;

  // ── Info principal ────────────────────────────────────────────────────────
  @Column()
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIA })
  prioridad: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.TODO })
  estado: TicketStatus;

  @Column({ type: 'enum', enum: TicketType, default: TicketType.TASK })
  tipo: TicketType;

  // ── Número de tarea dentro del módulo ────────────────────────────────────
  // Se asigna automáticamente al crear/mover la tarea a un sprint.
  // Permite mostrar #1, #2, #3... por módulo (orden visual).
  @Column({ nullable: true })
  ticket_number: number | null;

  // ── Código de referencia globalmente único ──────────────────────────────
  // Se genera al crear la tarea: número aleatorio de 5 dígitos (10000-99999).
  // Único en TODO el sistema. Se usa para GitHub (KAN-XXXXX), búsquedas,
  // copiar/pegar y como identificador estable que el usuario puede memorizar.
  @Column({ type: 'int', nullable: true, unique: true })
  codigo_referencia: number | null;

  // ── Kanban ────────────────────────────────────────────────────────────────
  @Column({ default: 0 })
  orden: number;

  // ── Métricas ──────────────────────────────────────────────────────────────
  @Column({ default: 0 })
  story_points: number;

  // ── Bloqueo ───────────────────────────────────────────────────────────────
  @Column({ default: false })
  esta_bloqueado: boolean;

  @Column({ type: 'text', nullable: true })
  motivo_bloqueo: string;

  // ── NUEVO: requiere adjunto para completarse ──────────────────────────────
  // Cuando true: el ticket no puede pasar a 'done' si adjuntos.length === 0.
  // Se activa automáticamente para tickets de sprints en trimestre documental.
  // El instructor también puede activarlo manualmente desde el detalle del ticket.
  @Column({ default: false })
  requiere_adjunto: boolean;

  // ── Subtareas ─────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  parent_id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.subtareas, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  ticket_padre: Ticket;

  @OneToMany(() => Ticket, (ticket) => ticket.ticket_padre)
  subtareas: Ticket[];

  // ── Usuarios ──────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  asignado_a_id: number;

  @ManyToOne(() => User, (user) => user.tickets_asignados, { nullable: true })
  @JoinColumn({ name: 'asignado_a_id' })
  asignado_a: User;

  @Column()
  creado_por_id: number;

  @ManyToOne(() => User, (user) => user.tickets_creados)
  @JoinColumn({ name: 'creado_por_id' })
  creado_por: User | null;

  // ── Fechas ────────────────────────────────────────────────────────────────
  @Column({ type: 'date', nullable: true })
  fecha_limite: Date;

  // Hora límite opcional — formato "HH:MM", ej "14:30"
  // Permite que el instructor fije hora de entrega en clase (misma fecha)
  @Column({ type: 'varchar', length: 5, nullable: true })
  hora_limite: string | null;

  @CreateDateColumn()
  creado_en: Date;

  @UpdateDateColumn()
  actualizado_en: Date;

  // ── Comentarios ───────────────────────────────────────────────────────────
  @OneToMany(() => Comment, (comment) => comment.ticket)
  comentarios: Comment[];

  // ── NUEVO: adjuntos del ticket ────────────────────────────────────────────
  // Se cargan en findOne() y se verifican en updateStatus() y closeSprint().
  @OneToMany(() => TicketAttachment, (att) => att.ticket)
  adjuntos: TicketAttachment[];

  // ── NUEVO: flujo de revisión por aprendiz ─────────────────────────────────
  // true  → el aprendiz marcó el trabajo como listo; el líder debe revisar.
  // false → estado normal (sin completar o ya aprobado/rechazado por el líder).
  // Este campo permanece en 'in_progress' — la tarjeta se vuelve verde en el
  // tablero para que el líder sepa que debe evaluar antes de mover a 'testing'.
  @Column({ default: false })
  completado_por_aprendiz: boolean;
}