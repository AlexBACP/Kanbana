import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Ficha } from '../../fichas/entities/ficha.entity';

/**
 * ROLES DEL SISTEMA
 * -----------------
 * coordinador  → acceso total
 * instructor   → gestiona sus fichas y proyectos
 * aprendiz     → trabaja en un proyecto; si es_lider_tecnico=true puede gestionar su equipo
 *
 * NOTA: El rol 'lider_tecnico' fue eliminado como rol base.
 * El liderazgo técnico se maneja exclusivamente con el campo es_lider_tecnico
 * sobre usuarios con rol 'aprendiz'. Esto evita la duplicidad de dos mecanismos
 * para el mismo concepto y simplifica el routing y la lógica de permisos.
 */
export enum UserRole {
  COORDINADOR = 'coordinador',
  INSTRUCTOR  = 'instructor',
  APRENDIZ    = 'aprendiz',
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

  /**
   * Sub-rol de Líder Técnico.
   * Cuando es true, el aprendiz puede:
   *   - Acceder al dashboard de gestión (ruta /dashboard)
   *   - Gestionar sprints, tickets y equipo de su proyecto
   *   - Ver su proyecto y su equipo igual que antes hacía el rol lider_tecnico
   * El rol base sigue siendo 'aprendiz' — no cambia en BD.
   */
  @Column({ default: false })
  es_lider_tecnico: boolean;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @ManyToOne('Ficha', 'usuarios', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fichaId' })
  ficha: Ficha;

  @Column({ nullable: true })
  fichaId: number;

// ── Confirmación de cuenta por correo ──────────────────────────────────
  @Column({ nullable: true })
  token_activacion: string;

  @Column({ default: false })
  cuenta_confirmada: boolean;

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
