import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  // ✅ CAMBIO: Se agregan ManyToOne y JoinColumn para la relación con el instructor
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Project } from '../../projects/entities/project.entity';
import type { User } from '../../users/entities/user.entity';

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

  // ✅ CAMBIO: Columna FK que almacena el id del instructor responsable de esta ficha.
  // nullable: true para no romper fichas ya existentes en BD (TypeORM con synchronize las migrará automáticamente).
  @Column({ nullable: true })
  instructor_id: number;

  // ✅ CAMBIO: Relación ManyToOne con User.
  // Muchas fichas pueden tener el mismo instructor, pero cada ficha tiene un único instructor.
  // eager: false → se carga explícitamente en el servicio con { relations: ['instructor'] }.
  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'instructor_id' })
  instructor: User;

  @OneToMany('Project', 'ficha')
  proyectos: Project[];

  @OneToMany('User', 'ficha')
  usuarios: User[];
}