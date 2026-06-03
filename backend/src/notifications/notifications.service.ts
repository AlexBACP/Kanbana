import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { N8nService } from '../integrations/n8n.service';
import { KanbanGateway } from './kanban.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private readonly n8n: N8nService,
    private readonly gateway: KanbanGateway,
  ) {}

  async findAllForUser(userId: number): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { usuario_id: userId },
      order: { creado_en: 'DESC' },
      take: 50,
    });
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    const notification = this.notificationsRepository.create(data);
    const saved = await this.notificationsRepository.save(notification);

    // ── TIEMPO REAL → push por WebSocket al usuario destinatario ─────────────
    // Esto hace que aparezca el toast emergente al instante en su interfaz,
    // para cualquier rol y cualquier evento que cree una notificación.
    try {
      if (saved.usuario_id) this.gateway.notifyUser(saved.usuario_id, saved);
    } catch { /* el socket no debe romper la creación */ }

    // ── SALIENTE → n8n: espejamos cada notificación como evento ──────────────
    // Fire-and-forget; si n8n no está configurado, no hace nada.
    void this.n8n.emit('notificacion.creada', {
      id: saved.id,
      usuario_id: saved.usuario_id,
      titulo: saved.titulo,
      mensaje: saved.mensaje,
      tipo: saved.tipo,
      action_type: saved.action_type,
      creado_en: saved.creado_en,
    });

    return saved;
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    await this.notificationsRepository.update({ id, usuario_id: userId }, { leida: true });
    return this.notificationsRepository.findOne({ where: { id } });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationsRepository.update({ usuario_id: userId, leida: false }, { leida: true });
  }

  async delete(id: number): Promise<void> {
    await this.notificationsRepository.delete(id);
  }

  async findById(id: number): Promise<Notification | null> {
    return this.notificationsRepository.findOne({ where: { id } });
  }

  /**
   * Elimina TODAS las notificaciones de un `action_type` cuyo `action_data`
   * (JSON) contenga el `key` con el `value` indicado.
   *
   * Caso de uso típico: cuando un coordinador procesa una "solicitud de
   * ficha", todos los otros coordinadores tienen una copia de la misma
   * notificación con los botones aprobar/rechazar. Esos botones deben
   * desaparecer en cuanto cualquiera de ellos resuelva la solicitud.
   */
  async deleteByActionPayloadMatch(
    actionType: string,
    key: string,
    value: number | string,
  ): Promise<number> {
    const notifs = await this.notificationsRepository.find({
      where: { action_type: actionType },
    });
    const ids: number[] = [];
    for (const n of notifs) {
      try {
        const data = JSON.parse(n.action_data || '{}');
        if (data && data[key] === value) ids.push(n.id);
      } catch {
        /* ignorar JSON inválido */
      }
    }
    if (ids.length > 0) {
      await this.notificationsRepository.delete(ids);
    }
    return ids.length;
  }
}
