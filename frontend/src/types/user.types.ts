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
}

export type UserRole = 'coordinador' | 'instructor' | 'aprendiz';

export interface CreateUserDto {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: UserRole;
  fichaId?: number;
}
