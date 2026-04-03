import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('notificaciones')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuario_id: number;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ nullable: true })
  titulo: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  tipo: NotificationType;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn()
  creado_en: Date;
}
