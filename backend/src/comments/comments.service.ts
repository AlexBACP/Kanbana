import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ticketId: number, createCommentDto: any): Promise<Comment> {
    const comment = this.commentsRepository.create({
      ...createCommentDto,
      ticket_id: ticketId,
    });
    const saved = await this.commentsRepository.save(comment as any);

    // Cargar el comentario con el ticket para obtener participantes
    const full = await this.commentsRepository.findOne({
      where: { id: (saved as any).id },
      relations: ['ticket', 'ticket.asignado_a', 'ticket.creado_por', 'usuario'],
    });

    if (full?.ticket) {
      const ticket = full.ticket as any;
      const autorId = createCommentDto.usuario_id;
      const notifyIds = new Set<number>();

      // Notificar al asignado y al creador, excepto al propio autor del comentario
      if (ticket.asignado_a?.id && ticket.asignado_a.id !== autorId) {
        notifyIds.add(ticket.asignado_a.id);
      }
      if (ticket.creado_por?.id && ticket.creado_por.id !== autorId) {
        notifyIds.add(ticket.creado_por.id);
      }

      const autorNombre = full.usuario?.nombre ?? 'Alguien';
      for (const uid of notifyIds) {
        await this.notificationsService.create({
          usuario_id: uid,
          titulo:     `Nuevo comentario en "${ticket.titulo}"`,
          mensaje:    `${autorNombre} comentó: "${(createCommentDto.contenido ?? '').slice(0, 100)}"`,
          tipo:       'info' as any,
        });
      }
    }

    return saved;
  }

  async findByTicket(ticketId: number): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { ticket_id: ticketId },
      relations: ['usuario'],
      order: { creado_en: 'ASC' },
    });
  }

  // Solo el autor del comentario, el líder o un admin pueden eliminarlo
  async remove(id: number, reqUser: any): Promise<void> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) return;

    const isAdmin = reqUser.rol === 'coordinador' || reqUser.rol === 'instructor';
    const isLider = reqUser.rol === 'aprendiz' && reqUser.es_lider_tecnico;
    const isAutor = comment.usuario_id === reqUser.id;

    if (!isAdmin && !isLider && !isAutor) {
      throw new ForbiddenException('No puedes eliminar este comentario.');
    }
    await this.commentsRepository.delete(id);
  }
}
