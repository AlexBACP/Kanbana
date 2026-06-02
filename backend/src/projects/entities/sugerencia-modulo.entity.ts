import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Project }   from './project.entity';
import { Trimestre } from './trimestre.entity';

export enum SugerenciaFuente {
  IA       = 'ia',
  CATALOGO = 'catalogo',
}

export enum SugerenciaEstado {
  SUGERIDA   = 'sugerida',
  CREADA     = 'creada',
  DESCARTADA = 'descartada',
}

/**
 * SugerenciaModulo — propuesta inteligente de un módulo (sprint) para un
 * trimestre concreto de un proyecto, generada por IA (Gemini) o por el
 * catálogo SDLC estático.
 *
 * Flujo: sugerida → (un clic) → creada (queda sprint_id), o → descartada.
 * Persistir permite no re-sugerir lo mismo y recordar descartes.
 */
@Entity('sugerencias_modulo')
@Index(['proyecto_id', 'trimestre_id'])
export class SugerenciaModulo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  proyecto_id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  @Column({ nullable: true })
  trimestre_id: number;

  @ManyToOne(() => Trimestre, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trimestre_id' })
  trimestre: Trimestre;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  /** por qué la IA sugiere esto para ESTE proyecto */
  @Column({ type: 'text', nullable: true })
  justificacion: string;

  @Column({ default: 4 })
  semanas: number;

  @Column({ nullable: true })
  categoria: string;

  @Column({ type: 'enum', enum: SugerenciaFuente, default: SugerenciaFuente.CATALOGO })
  fuente: SugerenciaFuente;

  @Column({ type: 'enum', enum: SugerenciaEstado, default: SugerenciaEstado.SUGERIDA })
  estado: SugerenciaEstado;

  /** sprint creado a partir de esta sugerencia (cuando estado = creada) */
  @Column({ nullable: true })
  sprint_id: number;

  @CreateDateColumn()
  creado_en: Date;
}
