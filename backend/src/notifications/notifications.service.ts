import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
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
    return this.notificationsRepository.save(notification);
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
}
