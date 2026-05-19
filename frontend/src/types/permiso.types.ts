export type TipoPermiso = 'editar_trimestre' | 'crear_modulo';

export interface PermisoVerificacion {
  tiene:     boolean;
  expira_en: string | null;
}