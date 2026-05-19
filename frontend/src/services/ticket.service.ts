// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//  Se agregan al final los métodos para gestión de adjuntos:
//   - uploadAttachment()  → POST multipart/form-data
//   - getAttachments()    → GET lista de adjuntos
//   - deleteAttachment()  → DELETE adjunto por ID
//  Todos los métodos existentes se mantienen sin cambios.
// ─────────────────────────────────────────────────────────────────────────────

import api from './api';
import { Ticket, CreateTicketDto, TicketStatus } from '../types/ticket.types';
import { TicketAttachment } from '../types/trimestre.types';

export const ticketService = {
  // ── Existentes sin cambios ────────────────────────────────────────────────

  getAll: async (
    projectId?: number,
    sprintId?:  number,
    backlog?:   boolean,
  ): Promise<Ticket[]> => {
    const params: any = {};
    if (projectId) params.proyecto_id = projectId;
    if (sprintId)  params.sprint_id   = sprintId;
    if (backlog)   params.backlog     = true;
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

  // ══ NUEVOS: gestión de adjuntos ═══════════════════════════════════════════

  // Sube un archivo al ticket usando multipart/form-data.
  // El backend (Multer) guarda el archivo en /uploads/attachments/<uuid>.<ext>
  // y devuelve el registro TicketAttachment con la URL pública.
  // onProgress: callback opcional para mostrar barra de progreso (0-100).
  uploadAttachment: async (
    ticketId:   number,
    file:       File,
    onProgress?: (percent: number) => void,
  ): Promise<TicketAttachment> => {
    const formData = new FormData();
    // El backend espera el campo "file" (definido en FileInterceptor('file', ...))
    formData.append('file', file);

    const { data } = await api.post(
      `/tickets/${ticketId}/attachments`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      },
    );
    return data;
  },

  // Lista todos los adjuntos de un ticket, ordenados del más reciente al más antiguo.
  getAttachments: async (ticketId: number): Promise<TicketAttachment[]> => {
    const { data } = await api.get(`/tickets/${ticketId}/attachments`);
    return data;
  },

  // Borra un adjunto: elimina el archivo del disco y el registro de la BD.
  deleteAttachment: async (ticketId: number, attachmentId: number): Promise<void> => {
    await api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
  },
};