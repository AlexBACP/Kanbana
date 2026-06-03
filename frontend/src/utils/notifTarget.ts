/**
 * notifTarget — deduce la ruta destino para una notificación.
 *
 * Política estricta de SEGURIDAD: solo navega si la notificación trae el id
 * estructurado en `action_data` (JSON) o en los campos `referencia_*` legacy.
 *
 * NO se infiere del texto. Una heurística por regex en el mensaje (ej. "KAN-42")
 * podía agarrar cualquier número del título y llevar a tareas ajenas a las que
 * el usuario no debería tener acceso. Si no hay id confiable → devuelve null y
 * la notificación NO es link.
 */
import type { Notification } from '../types/notification.types';

export function notifTarget(n: Notification): string | null {
  // 1) Datos estructurados (action_data en JSON)
  if (n.action_data) {
    try {
      const data = JSON.parse(n.action_data);
      if (data?.ticket_id)    return `/tickets/${data.ticket_id}`;
      if (data?.proyecto_id && data?.trimestre_id) {
        return `/projects/${data.proyecto_id}/trimestre/${data.trimestre_id}/kanban`;
      }
      if (data?.proyecto_id)  return `/projects/${data.proyecto_id}/kanban`;
    } catch { /* JSON inválido — ignorar */ }
  }

  // 2) Campos legacy estructurados
  if (n.referencia_tipo === 'ticket' && n.referencia_id) {
    return `/tickets/${n.referencia_id}`;
  }
  if (n.referencia_tipo === 'proyecto' && n.referencia_id) {
    return `/projects/${n.referencia_id}/kanban`;
  }

  // Sin id confiable → no navegamos a ningún lado. Privacidad primero.
  return null;
}
