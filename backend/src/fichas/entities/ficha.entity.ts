import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import type { Project }   from '../../projects/entities/project.entity';
import type { User }      from '../../users/entities/user.entity';
import type { Trimestre } from '../../projects/entities/trimestre.entity';

/**
 * Tipo de formación del SENA. Define cuántos trimestres lectivos tiene la ficha
 * y qué plantilla SDLC se aplica al generarlos automáticamente.
 *  - tecnologo: 6 trimestres lectivos (≈18 meses) + etapa productiva externa
 *  - tecnico:   3 trimestres lectivos (≈9 meses)  + etapa productiva externa
 */
export enum TipoFormacion {
  TECNOLOGO = 'tecnologo',
  TECNICO   = 'tecnico',
}

/**
 * Jornada de la ficha. Sirve para que los aprendices que se autoregistren
 * indiquen su jornada y se valide contra la de la ficha al solicitar vinculación.
 */
export enum JornadaFicha {
  MANANA = 'mañana',
  TARDE  = 'tarde',
  NOCHE  = 'noche',
}

@Entity('fichas')
export class Ficha {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo: string;

  @Column()
  programa: string;

  // ── NUEVO: tipo de formación SENA ─────────────────────────────────────────
  // Determina la cantidad de trimestres lectivos y los módulos predeterminados
  // que se generan automáticamente al crear la ficha.
  @Column({
    type: 'enum',
    enum: TipoFormacion,
    default: TipoFormacion.TECNOLOGO,
  })
  tipo_formacion: TipoFormacion;

  // ── Jornada — la usan los aprendices auto-registrados ────────────────────
  // Cuando un aprendiz solicita vinculación, debe escoger jornada; si no
  // coincide con esta, la solicitud se rechaza con un mensaje claro.
  @Column({
    type: 'enum',
    enum: JornadaFicha,
    default: JornadaFicha.MANANA,
  })
  jornada: JornadaFicha;

  // ── NUEVO: módulos SDLC EXCLUIDOS de esta ficha ───────────────────────────
  // El instructor puede desmarcar módulos predeterminados al crear la ficha.
  // Guardamos los DESELECCIONADOS como claves "<trimestreIndex>:<moduloIndex>"
  // (índices sobre la plantilla SDLC). null/[] = todos los módulos incluidos.
  // Al crear proyectos en la ficha, solo se generan los módulos NO excluidos.
  @Column({ type: 'simple-json', nullable: true })
  modulos_excluidos: string[] | null;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @CreateDateColumn()
  creado_en: Date;

  @Column({ nullable: true })
  instructor_id: number;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'instructor_id' })
  instructor: User;

  @OneToMany('Project', 'ficha')
  proyectos: Project[];

  @OneToMany('User', 'ficha')
  usuarios: User[];

  // ── NUEVO: trimestres de la ficha ──────────────────────────────────────
  @OneToMany('Trimestre', 'ficha')
  trimestres: Trimestre[];
}