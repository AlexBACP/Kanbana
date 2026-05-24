import api from './api';
import { TicketComment, CreateCommentDto } from '../types/comment.types';

export const commentService = {
  getByTicket: async (ticketId: number): Promise<TicketComment[]> => {
    const { data } = await api.get(`/tickets/${ticketId}/comments`);
    return data;
  },

  create: async (ticketId: number, dto: CreateCommentDto): Promise<TicketComment> => {
    const { data } = await api.post(`/tickets/${ticketId}/comments`, dto);
    return data;
  },

  deleteComment: async (ticketId: number, commentId: number): Promise<void> => {
    await api.delete(`/tickets/${ticketId}/comments/${commentId}`);
  },
};
