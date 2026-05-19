import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import type { Project }   from '../../projects/entities/project.entity';
import type { User }      from '../../users/entities/user.entity';
import type { Trimestre } from '../../projects/entities/trimestre.entity';

@Entity('fichas')
export class Ficha {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo: string;

  @Column()
  programa: string;

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