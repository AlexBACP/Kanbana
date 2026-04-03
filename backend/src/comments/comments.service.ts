import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
  ) {}

  async create(ticketId: number, createCommentDto: any): Promise<Comment> {
    const comment = this.commentsRepository.create({
      ...createCommentDto,
      ticket_id: ticketId,
    });
    return this.commentsRepository.save(comment as any);
  }

  async findByTicket(ticketId: number): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { ticket_id: ticketId },
      relations: ['usuario'],
      order: { creado_en: 'DESC' },
    });
  }

  async remove(id: number): Promise<void> {
    await this.commentsRepository.delete(id);
  }
}
