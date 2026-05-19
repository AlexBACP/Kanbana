import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TipoPermiso {
  EDITAR_TRIMESTRE = 'editar_trimestre',
  CREAR_MODULO     = 'crear_modulo',
}

export enum EstadoPermiso {
  PENDIENTE  = 'pendiente',
  ACEPTADO   = 'aceptado',
  RECHAZADO  = 'rechazado',
}

@Entity('permisos_temporales')
export class PermisoTemporal {
  @PrimaryGeneratedColumn()
  id: number;

  // Líder que solicita el permiso
  @Column()
  lider_id: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lider_id' })
  lider: User;

  // Instructor que otorga o rechaza
  @Column()
  instructor_id: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instructor_id' })
  instructor: User;

  // Proyecto al que aplica el permiso
  @Column()
  proyecto_id: number;

  // Tipo de acción permitida
  @Column({ type: 'enum', enum: TipoPermiso })
  tipo: TipoPermiso;

  // Estado de la solicitud
  @Column({
    type: 'enum',
    enum: EstadoPermiso,
    default: EstadoPermiso.PENDIENTE,
  })
  estado: EstadoPermiso;

  // Solo se llena cuando el instructor acepta
  @Column({ type: 'datetime', nullable: true })
  expira_en: Date | null;

  // Justificación del líder al solicitar
  @Column({ type: 'text', nullable: true })
  justificacion: string | null;

  // ID de la notificación generada (para poder actualizarla al responder)
  @Column({ nullable: true })
  notificacion_id: number | null;

  @CreateDateColumn()
  creado_en: Date;
}