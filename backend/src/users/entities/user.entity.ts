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
import { Ficha, JornadaFicha } from '../../fichas/entities/ficha.entity';

/**
 * Estado de la solicitud de vinculación de un aprendiz a una ficha.
 *  - none:       el aprendiz no ha solicitado vinculación (caso por defecto).
 *  - pendiente:  solicitó vinculación, espera aprobación del instructor.
 *  - aprobado:   el instructor aprobó; el aprendiz quedó vinculado a fichaId.
 *  - rechazado:  el instructor rechazó; el aprendiz puede solicitar otra ficha.
 */
export enum VinculacionEstado {
  NONE       = 'none',
  PENDIENTE  = 'pendiente',
  APROBADO   = 'aprobado',
  RECHAZADO  = 'rechazado',
}

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

  // ── ¿El usuario tiene una contraseña propia y usable? ──────────────────
  // true  → registro normal o invitado (cédula): puede iniciar sesión por correo
  //         y cambiarla con el flujo normal (requiere contraseña actual).
  // false → creado vía Google/GitHub: tiene una contraseña aleatoria inútil.
  //         Verá en su perfil la opción "Crear contraseña" (sin pedir la actual)
  //         para habilitar el login por correo desde la landing.
  @Column({ default: true })
  password_set: boolean;

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

  // ── Login con Google: id de la cuenta de Google (sub del perfil OIDC) ─────
  @Column({ nullable: true })
  google_id: string;

  // ── Login con GitHub: id numérico de la cuenta de GitHub ─────────────────
  @Column({ nullable: true })
  github_login_id: string;

  @Column({ nullable: true })
  banner_url: string;

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

  /**
   * Permiso temporal para crear UNA ficha.
   * Flujo:
   *   1. El instructor pide permiso → notifica al coordinador.
   *   2. El coordinador aprueba → este flag se pone en true.
   *   3. El instructor ve el formulario "Crear ficha" en lugar del botón "Solicitar permiso".
   *   4. Al crear la ficha → el flag se consume (vuelve a false).
   *   5. Para crear otra → debe pedir permiso de nuevo.
   * Si el coordinador rechaza, el flag NO cambia (queda en false).
   */
  @Column({ default: false })
  puede_crear_ficha: boolean;

  // ── Autenticación de dos factores (TOTP / Google Authenticator) ────────────
  /** Secreto TOTP — nunca se devuelve al cliente (select: false) */
  @Column({ nullable: true, select: false })
  totp_secret: string | null;

  /** true cuando el usuario completó la configuración de 2FA */
  @Column({ default: false })
  totp_enabled: boolean;

  // ── Estado de entrega del correo de confirmación ──────────────────────
  // pendiente: aún no se sabe / no se ha enviado
  // entregado: el correo salió sin rebote conocido
  // rebotado:  el correo de confirmación rebotó (buzón inexistente) — detectado
  //            por el BounceCheckerService leyendo los NDR vía IMAP.
  @Column({
    type: 'enum',
    enum: ['pendiente', 'entregado', 'rebotado'],
    default: 'pendiente',
  })
  correo_entrega_estado: 'pendiente' | 'entregado' | 'rebotado';

  // ── Documento / cédula del aprendiz ───────────────────────────────────
  // Se usa para que el instructor identifique a su aprendiz al aprobar
  // solicitudes de vinculación. También se setea por el flujo de invitación
  // tradicional (Excel/individual) cuando el instructor lo registra.
  @Column({ nullable: true })
  documento: string;

  // ── Solicitud de vinculación a una ficha ──────────────────────────────
  // Si vinculacion_estado === 'pendiente', estos campos describen la ficha
  // y jornada que el aprendiz quiere unirse. Al aprobar, ficha_solicitada_id
  // se copia a fichaId y estos campos se limpian.
  @Column({ nullable: true })
  ficha_solicitada_id: number;

  @ManyToOne('Ficha', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ficha_solicitada_id' })
  ficha_solicitada: Ficha;

  @Column({
    type: 'enum',
    enum: ['mañana', 'tarde', 'noche'],
    nullable: true,
  })
  jornada_solicitada: JornadaFicha | null;

  @Column({
    type: 'enum',
    enum: VinculacionEstado,
    default: VinculacionEstado.NONE,
  })
  vinculacion_estado: VinculacionEstado;

  @Column({ type: 'timestamp', nullable: true })
  vinculacion_solicitada_en: Date | null;

  /** Motivo enviado por el instructor cuando rechaza una solicitud. */
  @Column({ type: 'text', nullable: true })
  vinculacion_motivo_rechazo: string | null;

  // ── Rate-limit de cambios de contraseña propia ─────────────────────────
  // Permite contar cuántas veces el usuario cambió SU propia contraseña hoy.
  // Reset automático cuando cambia el día (la lógica vive en el service).
  // Excepción: los cambios hechos por coordinador/instructor sobre OTROS
  // usuarios no incrementan este contador.
  @Column({ type: 'date', nullable: true })
  password_last_change_date: Date | null;

  @Column({ type: 'int', default: 0 })
  password_changes_today: number;

  @CreateDateColumn()
  creado_en: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.asignado_a)
  tickets_asignados: Ticket[];

  @OneToMany(() => Ticket, (ticket) => ticket.creado_por)
  tickets_creados: Ticket[];
}
