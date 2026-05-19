// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambio respecto a la versión original:
//   1. Se agrega la relación OneToMany hacia Trimestre.
//      El proyecto ahora expone sus trimestres al hacer findOne con relations.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn,
} from 'typeorm';
import { Ficha }   from '../../fichas/entities/ficha.entity';
import { Ticket }  from '../../tickets/entities/ticket.entity';
import { Sprint }  from './sprint.entity';
import { User }    from '../../users/entities/user.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import { Trimestre } from './trimestre.entity';

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

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instructorId' })
  instructor: User;

  @Column({ nullable: true })
  instructorId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'liderId' })
  lider: User;

  @Column({ nullable: true })
  liderId: number;

  @ManyToOne(() => Ficha, (ficha) => ficha.proyectos, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fichaId' })
  ficha: Ficha;

  @Column({ nullable: true })
  fichaId: number;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @Column({
    type:    'enum',
    enum:    ProjectStatus,
    default: ProjectStatus.ACTIVO,
  })
  estado: ProjectStatus;

  // ── NUEVO: cuántos trimestres tiene este proyecto (1, 2 o 3) ─────────────
  // Por defecto 3. El instructor lo elige al crear el proyecto.
  // Este número determina cuántos Trimestre se crean automáticamente.
  @Column({ default: 3 })
  num_trimestres: number;

  @CreateDateColumn()
  creado_en: Date;

  @ManyToMany(() => User)
  @JoinTable({
    name:              'proyecto_usuarios',
    joinColumn:        { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id',    referencedColumnName: 'id' },
  })
  miembros: User[];

  @OneToMany(() => Ticket, (ticket) => ticket.proyecto)
  tickets: Ticket[];

  @OneToMany(() => Sprint, (sprint) => sprint.proyecto)
  sprints: Sprint[];

  // ── NUEVO: trimestres del proyecto ────────────────────────────────────────
  // Al hacer findOne con relations: ['trimestres'], se cargan ordenados por numero.
  // Trimestres ahora pertenecen a la Ficha, no al Proyecto
  // @OneToMany(() => Trimestre, (trimestre) => trimestre.ficha)
  trimestres: Trimestre[];
}