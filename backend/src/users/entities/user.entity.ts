import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Ficha } from '../../fichas/entities/ficha.entity';

export enum UserRole {
  COORDINADOR = 'coordinador',
  INSTRUCTOR = 'instructor',
  LIDER = 'lider_tecnico',
  APRENDIZ = 'aprendiz',
}

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ unique: true })
  correo: string;

  @Column({ select: false })
  contrasena: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.APRENDIZ,
  })
  rol: UserRole;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @ManyToOne('Ficha', 'usuarios', { nullable: true })
  ficha: Ficha;

  @Column({ nullable: true })
  reset_password_token: string;

  @Column({ type: 'timestamp', nullable: true })
  reset_password_expires: Date;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  creado_en: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.asignado_a)
  tickets_asignados: Ticket[];

  @OneToMany(() => Ticket, (ticket) => ticket.creado_por)
  tickets_creados: Ticket[];
}
