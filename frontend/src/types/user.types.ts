export interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: 'coordinador' | 'instructor' | 'lider_tecnico' | 'aprendiz';
  activo: boolean;
  creado_en: string;
}

export type UserRole = 'coordinador' | 'instructor' | 'lider_tecnico' | 'aprendiz';

export interface CreateUserDto {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: UserRole;
}