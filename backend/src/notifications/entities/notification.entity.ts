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

  // ── NUEVO: soporte para notificaciones con acciones (permisos temporales) ──
  // action_type identifica el tipo de acción ('permiso_solicitud', etc.)
  // action_data guarda el JSON con los datos necesarios (permiso_id, tipo, etc.)
  // El frontend lee estos campos para mostrar botones de Aceptar/Rechazar.
  @Column({ nullable: true })
  action_type: string | null;

  @Column({ type: 'text', nullable: true })
  action_data: string | null;

  @CreateDateColumn()
  creado_en: Date;
}