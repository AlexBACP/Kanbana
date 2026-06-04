/**
 * useTicketSocket — Comentarios en vivo para el detalle de una tarea.
 *
 * Se suscribe a la room `ticket:{ticketId}` y reacciona a:
 *   • comment:new → invalida la query de comentarios (aparecen al instante)
 *
 * Se usa en TicketDetailPage.
 */
import { useEffect }      from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket }     from 'socket.io-client';

let ticketSocket: Socket | null = null;

function getSocket(): Socket {
  if (!ticketSocket || !ticketSocket.connected) {
    ticketSocket = io(window.location.origin, {
      auth:                { token: localStorage.getItem('access_token') },
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    });
  }
  return ticketSocket;
}

export function useTicketSocket(ticketId: number | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!ticketId) return;

    const socket = getSocket();

    const joinTicket = () => socket.emit('join-ticket', ticketId);

    if (socket.connected) joinTicket();
    socket.on('connect', joinTicket);

    // Nuevo comentario → invalidar query para mostrarlo al instante
    const onCommentNew = () => {
      qc.invalidateQueries({ queryKey: ['comments', ticketId] });
    };
    socket.on('comment:new', onCommentNew);

    return () => {
      socket.emit('leave-ticket', ticketId);
      socket.off('connect',     joinTicket);
      socket.off('comment:new', onCommentNew);
    };
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps
}
