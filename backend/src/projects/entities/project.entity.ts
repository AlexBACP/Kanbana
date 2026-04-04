import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn,
} from 'typeorm';
import { Ficha } from '../../fichas/entities/ficha.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Sprint } from './sprint.entity';
import { User } from '../../users/entities/user.entity';

export enum ProjectStatus {
  ACTIVO     = 'activo',
  PAUSADO    = 'pausado',
  FINALIZADO = 'finalizado',
}

@Entity('proyectos')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  competencia: string;

  @Column({ type: 'text', nullable: true })
  resultado_aprendizaje: string;

  // ── Instructor supervisor ──────────────────────────────────
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instructorId' })
  instructor: User;

  @Column({ nullable: true })
  instructorId: number;

  // ── Líder técnico asignado (columna propia) ────────────────
  // Un proyecto tiene exactamente un líder técnico.
  // Se guarda como FK directa además de estar en miembros
  // para poder filtrar por líder sin hacer JOIN de ManyToMany.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'liderId' })
  lider: User;

  @Column({ nullable: true })
  liderId: number;

  // ── Ficha de formación ─────────────────────────────────────
  @ManyToOne(() => Ficha, (ficha) => ficha.proyectos, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fichaId' })
  ficha: Ficha;

  @Column({ nullable: true })
  fichaId: number;

  // ── Fechas ─────────────────────────────────────────────────
  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.ACTIVO,
  })
  estado: ProjectStatus;

  @CreateDateColumn()
  creado_en: Date;

  // ── Miembros (aprendices + líderes del proyecto) ───────────
  @ManyToMany(() => User)
  @JoinTable({ name: 'proyecto_usuarios' })
  miembros: User[];

  // ── Relaciones ─────────────────────────────────────────────
  @OneToMany(() => Ticket, (ticket) => ticket.proyecto)
  tickets: Ticket[];

  @OneToMany(() => Sprint, (sprint) => sprint.proyecto)
  sprints: Sprint[];
}