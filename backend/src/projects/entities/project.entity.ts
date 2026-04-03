import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';

import { Ficha } from '../../fichas/entities/ficha.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Sprint } from './sprint.entity';
import { User } from '../../users/entities/user.entity';

export enum ProjectStatus {
  ACTIVO = 'activo',
  PAUSADO = 'pausado',
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

  // 🔗 FICHA (SIN ID MANUAL)
  @ManyToOne(() => Ficha, (ficha) => ficha.proyectos, {
    onDelete: 'CASCADE',
  })
  ficha: Ficha;

  @Column()
  competencia: string;

  @Column()
  resultado_aprendizaje: string;

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

  // 🔥 RELACIÓN CLAVE (QUIÉNES PARTICIPAN)
  @ManyToMany(() => User)
  @JoinTable({
    name: 'proyecto_usuarios',
  })
  miembros: User[];

  // 🔗 TICKETS
  @OneToMany(() => Ticket, (ticket) => ticket.proyecto)
  tickets: Ticket[];

  // 🔗 SPRINTS
  @OneToMany(() => Sprint, (sprint) => sprint.proyecto)
  sprints: Sprint[];
}