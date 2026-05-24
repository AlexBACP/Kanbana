// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//   1. Se agrega trimestre_id (FK opcional hacia trimestres).
//      Es nullable para que los sprints existentes en BD no rompan.
//   2. Se agrega la relación ManyToOne hacia Trimestre.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Project }    from '../../projects/entities/project.entity';
import type { Ticket }     from '../../tickets/entities/ticket.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import type { Trimestre }  from './trimestre.entity';

@Entity('sprints')
export class Sprint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true, default: null })
  descripcion: string | null;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @Column({ default: false })
  esta_activo: boolean;

  @Column({ default: false })
  esta_finalizado: boolean;

  /**
   * pendiente_revision: true cuando el líder envía el módulo a revisión del instructor.
   * Se pone en false cuando el instructor aprueba (cierra el sprint) o envía correcciones.
   */
  @Column({ default: false })
  pendiente_revision: boolean;

  // ── FK hacia Proyecto (sin cambios) ─────────────────────────────────────
  @Column()
  proyecto_id: number;

  @ManyToOne('Project', 'sprints')
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  // ── NUEVO: FK hacia Trimestre ─────────────────────────────────────────────
  // nullable: true para compatibilidad con sprints ya creados antes de esta migración.
  // Al crear nuevos sprints siempre se enviará trimestre_id desde el frontend.
  @Column({ nullable: true })
  trimestre_id: number;

  @ManyToOne('Trimestre', 'sprints', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trimestre_id' })
  trimestre: Trimestre;

  // ── Tickets del sprint (sin cambios) ────────────────────────────────────
  @OneToMany('Ticket', 'sprint')
  tickets: Ticket[];

  @CreateDateColumn()
  creado_en: Date;
}