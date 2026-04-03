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

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Sprint } from '../../projects/entities/sprint.entity';

export enum TicketPriority {
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
}

export enum TicketStatus {
  TODO = 'to_do',
  IN_PROGRESS = 'in_progress',
  TESTING = 'testing',
  DONE = 'done',
}

export enum TicketType {
  TASK = 'task',
  BUG = 'bug',
  STORY = 'story',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 PROYECTO
  @Column()
  proyecto_id: number;

  @ManyToOne(() => Project, (project) => project.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  // 🔗 SPRINT
  @Column({ nullable: true })
  sprint_id: number;

  @ManyToOne(() => Sprint, (sprint) => sprint.tickets, { 
    nullable: true, 
    onDelete: 'SET NULL' 
  })
  @JoinColumn({ name: 'sprint_id' })
  sprint: Sprint;

  // 🧠 INFO PRINCIPAL
  @Column()
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIA,
  })
  prioridad: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.TODO,
  })
  estado: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketType,
    default: TicketType.TASK,
  })
  tipo: TicketType;

  // 🔥 CLAVE PARA KANBAN (drag & drop)
  @Column({ default: 0 })
  orden: number;

  // 📊 MÉTRICAS
  @Column({ default: 0 })
  story_points: number;

  // 🚫 BLOQUEO
  @Column({ default: false })
  esta_bloqueado: boolean;

  @Column({ type: 'text', nullable: true })
  motivo_bloqueo: string;

  // 🌳 SUBTAREAS
  @Column({ nullable: true })
  parent_id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.subtareas, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  ticket_padre: Ticket;

  @OneToMany(() => Ticket, (ticket) => ticket.ticket_padre)
  subtareas: Ticket[];

  // 👤 USUARIOS
  @Column({ nullable: true })
  asignado_a_id: number;

  @ManyToOne(() => User, (user) => user.tickets_asignados, { nullable: true })
  @JoinColumn({ name: 'asignado_a_id' })
  asignado_a: User;

  @Column()
  creado_por_id: number;

  @ManyToOne(() => User, (user) => user.tickets_creados)
  @JoinColumn({ name: 'creado_por_id' })
  creado_por: User;

  // 📅 FECHAS
  @Column({ type: 'date', nullable: true })
  fecha_limite: Date;

  @CreateDateColumn()
  creado_en: Date;

  @UpdateDateColumn()
  actualizado_en: Date;

  // 💬 COMENTARIOS
  @OneToMany(() => Comment, (comment) => comment.ticket)
  comentarios: Comment[];
}