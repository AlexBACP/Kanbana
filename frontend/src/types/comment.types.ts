export type CommentType = 'comentario' | 'retroalimentacion';

export interface TicketComment {
  id: number;
  ticket_id: number;
  usuario_id: number;
  contenido: string;
  es_retroalimentacion: boolean;
  creado_en: string;
}

export interface CreateCommentDto {
  contenido: string;
  es_retroalimentacion?: boolean;
}