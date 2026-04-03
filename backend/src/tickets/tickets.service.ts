import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
  ) {}

  async create(createTicketDto: any): Promise<Ticket> {
    const ticket = this.ticketsRepository.create(createTicketDto);
    return this.ticketsRepository.save(ticket as any);
  }

  async findAll(proyecto_id?: number, sprint_id?: number, backlog?: boolean): Promise<Ticket[]> {
    const where: any = {};
    if (proyecto_id) where.proyecto_id = proyecto_id;
    if (sprint_id) where.sprint_id = sprint_id;
    if (backlog) where.sprint_id = null;

    return this.ticketsRepository.find({ 
      where,
      relations: ['asignado_a', 'creado_por', 'subtareas']
    });
  }

  async findOne(id: number): Promise<Ticket> {
    return this.ticketsRepository.findOne({ 
      where: { id },
      relations: [
        'proyecto', 
        'asignado_a', 
        'creado_por', 
        'comentarios', 
        'comentarios.usuario',
        'subtareas',
        'ticket_padre'
      ]
    });
  }

  async updateStatus(id: number, statusDto: any): Promise<Ticket> {
    await this.ticketsRepository.update(id, { 
      estado: statusDto.estado,
      actualizado_en: new Date()
    });
    return this.findOne(id);
  }

  async update(id: number, updateTicketDto: any): Promise<Ticket> {
    await this.ticketsRepository.update(id, updateTicketDto);
    return this.findOne(id);
  }

  async moveTask(ticketId: number, sprintId: number | null): Promise<Ticket> {
    const updateData: any = { sprint_id: sprintId };
    await this.ticketsRepository.update(ticketId, updateData);
    return this.findOne(ticketId);
  }

  async setFlag(ticketId: number, flagDto: { isBlocked: boolean, reason?: string }): Promise<Ticket> {
    await this.ticketsRepository.update(ticketId, { 
      esta_bloqueado: flagDto.isBlocked,
      motivo_bloqueo: flagDto.reason 
    });
    return this.findOne(ticketId);
  }

  async remove(id: number): Promise<void> {
    await this.ticketsRepository.delete(id);
  }
}
