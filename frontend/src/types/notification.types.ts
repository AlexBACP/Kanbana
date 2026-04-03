export type NotificationType =
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
  mensaje: string;
  leida: boolean;
  referencia_id: number;
  referencia_tipo: string;
  creado_en: string;
}