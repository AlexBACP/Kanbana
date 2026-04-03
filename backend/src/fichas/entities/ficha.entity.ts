import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
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

  @OneToMany('Project', 'ficha')
  proyectos: Project[];

  @OneToMany('User', 'ficha')
  usuarios: User[];
}
