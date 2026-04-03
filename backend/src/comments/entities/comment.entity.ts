import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Ticket } from '../../tickets/entities/ticket.entity';
import type { User } from '../../users/entities/user.entity';

@Entity('comentarios')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticket_id: number;

  @ManyToOne('Ticket', 'comentarios')
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column()
  usuario_id: number;

  @ManyToOne('User')
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'text' })
  contenido: string;

  @Column({ default: false })
  es_retroalimentacion: boolean;

  @CreateDateColumn()
  creado_en: Date;
}
