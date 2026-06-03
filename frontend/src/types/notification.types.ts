// Tipos base que emite el backend (info/success/warning/error) + tipos legacy
// específicos que algunos componentes aún reconocen para estilos.
export type NotificationType =
  | 'info' | 'success' | 'warning' | 'error'
  | 'ticket_asignado'
  | 'ticket_en_revision'
  | 'ticket_aprobado'
  | 'ticket_devuelto'
  | 'evidencia_aprobada'
  | 'evidencia_rechazada'
  | 'fecha_limite_proxima';

export interface Notification {
  id: number;
  usuario_id: number;
  tipo: NotificationType;
  titulo?: string;
  mensaje: string;
  leida: boolean;
  // Campos de acciones (permisos, etc.) que envía el backend
  action_type?: string | null;
  action_data?: string | null;
  // Campos legacy opcionales (deep-link a una entidad)
  referencia_id?: number;
  referencia_tipo?: string;
  creado_en: string;
}