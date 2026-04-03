import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { Project } from '../../projects/entities/project.entity';
import type { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('sprints')
export class Sprint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin: Date;

  @Column({ default: false })
  esta_activo: boolean;

  @Column({ default: false })
  esta_finalizado: boolean;

  @Column()
  proyecto_id: number;

  @ManyToOne('Project', 'sprints')
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  @OneToMany('Ticket', 'sprint')
  tickets: Ticket[];

  @CreateDateColumn()
  creado_en: Date;
}
