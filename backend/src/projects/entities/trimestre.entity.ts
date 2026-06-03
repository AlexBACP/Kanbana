import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import type { Sprint } from './sprint.entity';
import type { Ficha }  from '../../fichas/entities/ficha.entity';

export enum TipoTrimestre {
  DOCUMENTAL = 'documental',
  DESARROLLO = 'desarrollo',
}

/**
 * Estado operativo del trimestre.
 *   - planificado  → futuro, sin operación.
 *   - activo       → donde se trabaja actualmente (uno por ficha a la vez).
 *   - completado   → cerrado normalmente desde Kanbana (se trabajó aquí).
 *   - historico    → declarado por instructor/coordinador para una ficha que
 *                    ya estaba en curso al adoptar Kanbana. NO tiene operación
 *                    detallada (sin módulos ni tareas), solo nombre/fechas y
 *                    una evidencia de cierre opcional.
 */
export enum EstadoTrimestre {
  PLANIFICADO = 'planificado',
  ACTIVO      = 'activo',
  COMPLETADO  = 'completado',
  HISTORICO   = 'historico',
}

/**
 * Trimestre — ahora pertenece a la FICHA, no al proyecto.
 *
 * ── MODIFICADO ────────────────────────────────────────────────────────────
 * Antes: proyecto_id — cada proyecto tenía sus propios trimestres.
 * Ahora: ficha_id — todos los proyectos de la ficha comparten trimestres.
 * Esto refleja la realidad del SENA: los trimestres son etapas lectivas
 * de la ficha de formación, no del proyecto individual.
 * ────────────────────────────────────────────────────────────────────────
 */
@Entity('trimestres')
export class Trimestre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  numero: number;

  @Column({ nullable: true })
  nombre: string;

  // ── Descripción semántica del trimestre (etapa del SDLC que cubre) ────────
  // Se rellena automáticamente desde la plantilla SDLC al crear la ficha.
  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({
    type: 'enum',
    enum: TipoTrimestre,
    default: TipoTrimestre.DESARROLLO,
  })
  tipo: TipoTrimestre;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @Column({ default: false })
  esta_finalizado: boolean;

  // ── Estado operativo del trimestre ────────────────────────────────────
  @Column({
    type: 'enum',
    enum: EstadoTrimestre,
    default: EstadoTrimestre.PLANIFICADO,
  })
  estado: EstadoTrimestre;

  // ── Evidencia de cierre (solo para trimestres históricos) ─────────────
  // URL pública del archivo subido (acta, planilla, PDF...).
  // null = sin evidencia. La UI muestra un badge "Sin evidencia" para que
  // el coordinador la añada después si quiere.
  @Column({ type: 'text', nullable: true })
  evidencia_cierre_url: string | null;

  @Column({ nullable: true })
  evidencia_cierre_nombre: string | null;

  // ── MODIFICADO: ficha_id en lugar de proyecto_id ──────────────────────
  @Column()
  ficha_id: number;

  @ManyToOne('Ficha', 'trimestres', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ficha_id' })
  ficha: Ficha;

  @OneToMany('Sprint', 'trimestre')
  sprints: Sprint[];

  @CreateDateColumn()
  creado_en: Date;
}