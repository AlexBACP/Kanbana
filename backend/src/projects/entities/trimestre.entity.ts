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