/**
 * useBoardSocket — Real-time del tablero Kanban.
 *
 * Se suscribe a la room `board:{proyectoId}` y reacciona a:
 *   • ticket:updated   → invalida la query del tablero (re-fetch instantáneo)
 *   • presence:update  → actualiza la lista de usuarios presentes
 *
 * Se usa en TrimestreKanbanPage y KanbanPage.
 * El socket se crea/reutiliza desde el hook useSocket global (misma instancia).
 */
import { useEffect, useState } from 'react';
import { useQueryClient }       from '@tanstack/react-query';
import { io, Socket }           from 'socket.io-client';

export interface PresenceUser {
  id:         number;
  nombre:     string;
  avatar_url?: string;
}

let boardSocket: Socket | null = null;

function getSocket(): Socket {
  if (!boardSocket || !boardSocket.connected) {
    boardSocket = io(window.location.origin, {
      auth:                { token: localStorage.getItem('access_token') },
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    });
  }
  return boardSocket;
}

interface UseBoardSocketOptions {
  proyectoId:  number | undefined;
  user:        { id: number; nombre: string; avatar_url?: string } | undefined;
  queryKeys:   unknown[][];  // keys a invalidar cuando llegue ticket:updated
}

export function useBoardSocket({ proyectoId, user, queryKeys }: UseBoardSocketOptions) {
  const qc = useQueryClient();
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!proyectoId || !user) return;

    const socket = getSocket();

    const joinBoard = () => {
      socket.emit('join-board', { proyectoId, user });
    };

    // Entrar al room del tablero
    if (socket.connected) {
      joinBoard();
    }
    socket.on('connect', joinBoard);

    // Tarea actualizada en tiempo real → re-fetch del tablero
    const onTicketUpdated = () => {
      queryKeys.forEach(key => qc.invalidateQueries({ queryKey: key }));
    };
    socket.on('ticket:updated', onTicketUpdated);

    // Presencia: quién está viendo el tablero ahora mismo
    const onPresence = (users: PresenceUser[]) => {
      setPresence(users);
    };
    socket.on('presence:update', onPresence);

    return () => {
      socket.emit('leave-board', proyectoId);
      socket.off('connect',        joinBoard);
      socket.off('ticket:updated', onTicketUpdated);
      socket.off('presence:update', onPresence);
    };
  }, [proyectoId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { presence };
}
