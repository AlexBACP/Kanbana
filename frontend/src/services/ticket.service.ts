import api from './api';
import { Ticket, CreateTicketDto, TicketStatus } from '../types/ticket.types';

export const ticketService = {
  getAll: async (projectId?: number, sprintId?: number, backlog?: boolean): Promise<Ticket[]> => {
    const params: any = {};
    if (projectId) params.proyecto_id = projectId;
    if (sprintId) params.sprint_id = sprintId;
    if (backlog) params.backlog = true;
    
    const { data } = await api.get('/tickets', { params });
    return data;
  },

  getById: async (id: number): Promise<Ticket> => {
    const { data } = await api.get(`/tickets/${id}`);
    return data;
  },

  create: async (dto: CreateTicketDto): Promise<Ticket> => {
    const { data } = await api.post('/tickets', dto);
    return data;
  },

  update: async (id: number, dto: Partial<CreateTicketDto>): Promise<Ticket> => {
    const { data } = await api.patch(`/tickets/${id}`, dto);
    return data;
  },

  updateStatus: async (id: number, dto: { estado: TicketStatus }): Promise<Ticket> => {
    const { data } = await api.patch(`/tickets/${id}/status`, dto);
    return data;
  },

  moveTask: async (id: number, sprintId: number | null): Promise<Ticket> => {
    const { data } = await api.patch(`/tickets/${id}/move`, { sprint_id: sprintId });
    return data;
  },

  setFlag: async (id: number, isBlocked: boolean, reason?: string): Promise<Ticket> => {
    const { data } = await api.patch(`/tickets/${id}/flag`, { isBlocked, reason });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tickets/${id}`);
  },
};