export interface User {
  id: number;
  nombre: string;
  correo: string;
  /**
   * Roles del sistema:
   *   coordinador → acceso total
   *   instructor  → gestiona sus fichas/proyectos
   *   aprendiz    → trabaja en un proyecto
   *
   * El rol 'lider_tecnico' fue eliminado. El liderazgo técnico
   * se maneja con el campo es_lider_tecnico sobre aprendices.
   */
  rol: 'coordinador' | 'instructor' | 'aprendiz';
  /**
   * Sub-rol de Líder Técnico — solo válido cuando rol='aprendiz'.
   * Cuando es true el aprendiz accede al dashboard de gestión y puede
   * administrar su proyecto, equipo y sprints.
   */
  es_lider_tecnico: boolean;
  activo: boolean;
  creado_en: string;
  avatar_url?: string;
  telefono?: string;
  bio?: string;
  banner_url?: string;
  documento?: string;
  /** false → usuario de Google/GitHub que aún no ha creado su contraseña propia */
  password_set?: boolean;
  fichaId?: number | null;
  // ── Vinculación de aprendices auto-registrados a una ficha ──────────
  ficha_solicitada_id?: number | null;
  jornada_solicitada?: 'mañana' | 'tarde' | 'noche' | null;
  vinculacion_estado?: 'none' | 'pendiente' | 'aprobado' | 'rechazado';
  vinculacion_solicitada_en?: string | null;
  vinculacion_motivo_rechazo?: string | null;
  /** Onboarding: si el usuario ya completó el tour de bienvenida */
  tour_completado?: boolean;
}

export type UserRole = 'coordinador' | 'instructor' | 'aprendiz';

export interface CreateUserDto {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: UserRole;
  fichaId?: number;
}
