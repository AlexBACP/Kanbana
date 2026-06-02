import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { KanbanGateway }        from '../notifications/kanban.gateway';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KanbanGateway,
  ) {}

  async create(ticketId: number, createCommentDto: any): Promise<Comment> {
    // ── Auto-transición a "En desarrollo" ────────────────────────────────────
    // Si el ticket estaba en "Por hacer" y quien comenta es el aprendiz asignado,
    // pasarlo automáticamente a "En desarrollo". Esto elimina la fricción de que el
    // aprendiz tenga que cambiar el estado manualmente al empezar a trabajar.
    try {
      const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId } });
      if (
        ticket &&
        ticket.estado === TicketStatus.TODO &&
        ticket.asignado_a_id &&
        Number(ticket.asignado_a_id) === Number(createCommentDto.usuario_id)
      ) {
        await this.ticketsRepository.update(ticketId, { estado: TicketStatus.IN_PROGRESS });
        this.logger.log(`Ticket #${ticketId} movido a IN_PROGRESS por comentario del usuario ${createCommentDto.usuario_id}`);
      }
    } catch (err: any) {
      this.logger.warn(`Auto-transición fallida para ticket #${ticketId}: ${err?.message}`);
    }

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

    // ── Real-time: emitir comentario en vivo a todos viendo esta tarea ───────
    this.gateway.broadcastCommentNew(ticketId, full ?? saved);

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
