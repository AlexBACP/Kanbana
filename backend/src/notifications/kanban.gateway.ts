/**
 * KanbanGateway — Gateway WebSocket central de Kanbana.
 *
 * Gestiona 3 tipos de rooms:
 *   • user:{userId}          → notificaciones personales (ya existía en useSocket.ts)
 *   • board:{proyectoId}     → actualizaciones en tiempo real del tablero + presencia
 *   • ticket:{ticketId}      → comentarios en vivo de una tarea específica
 *
 * Eventos cliente → servidor:
 *   join              (userId)                     → entrar a room personal
 *   join-board        ({ proyectoId, user })        → entrar al tablero, emite presencia
 *   leave-board       (proyectoId)                  → salir del tablero, emite presencia
 *   join-ticket       (ticketId)                    → suscribirse a comentarios de tarea
 *   leave-ticket      (ticketId)                    → desuscribirse
 *
 * Eventos servidor → cliente:
 *   notification                                    → notificación personal
 *   ticket:updated    ({ ticket })                  → estado/datos de tarea cambiados
 *   comment:new       ({ comment })                 → nuevo comentario en tarea
 *   presence:update   ([{ id, nombre, avatar_url }]) → usuarios en el tablero ahora
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface ClientInfo {
  userId:     number;
  nombre?:    string;
  avatar_url?: string;
  boardId?:   number; // proyecto que está viendo ahora mismo
}

@WebSocketGateway({
  cors: {
    origin:      ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class KanbanGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KanbanGateway.name);

  // socketId → info del cliente conectado
  private readonly clients = new Map<string, ClientInfo>();

  afterInit() {
    this.logger.log('✅ KanbanGateway iniciado — WebSockets activos');
  }

  handleConnection(client: Socket) {
    this.clients.set(client.id, { userId: 0 });
    this.logger.log(`🔌 Cliente conectado: ${client.id} (total: ${this.clients.size})`);
  }

  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (info?.boardId) {
      // Al desconectarse, actualizar presencia del tablero que estaba viendo
      this.broadcastPresence(info.boardId);
    }
    this.clients.delete(client.id);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  /** Aprendiz / usuario se identifica → entra a su room personal */
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: number,
  ) {
    const info = this.clients.get(client.id) ?? { userId: 0 };
    info.userId = Number(userId);
    this.clients.set(client.id, info);
    client.join(`user:${userId}`);
    this.logger.log(`👤 Cliente ${client.id} se unió a user:${userId}`);
  }

  /** Usuario entra al tablero de un proyecto */
  @SubscribeMessage('join-board')
  handleJoinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { proyectoId: number; user: { id: number; nombre: string; avatar_url?: string } },
  ) {
    const { proyectoId, user } = payload;
    const info = this.clients.get(client.id) ?? { userId: 0 };

    // Salir del tablero anterior si aplica
    if (info.boardId && info.boardId !== proyectoId) {
      client.leave(`board:${info.boardId}`);
      const old = info.boardId;
      info.boardId = undefined;
      this.broadcastPresence(old);
    }

    info.userId    = user.id;
    info.nombre    = user.nombre;
    info.avatar_url = user.avatar_url;
    info.boardId   = proyectoId;
    this.clients.set(client.id, info);

    client.join(`board:${proyectoId}`);
    this.broadcastPresence(proyectoId);
  }

  /** Usuario sale del tablero */
  @SubscribeMessage('leave-board')
  handleLeaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() proyectoId: number,
  ) {
    client.leave(`board:${proyectoId}`);
    const info = this.clients.get(client.id);
    if (info) {
      info.boardId = undefined;
      this.clients.set(client.id, info);
    }
    this.broadcastPresence(proyectoId);
  }

  /** Usuario abre el detalle de una tarea → suscribirse a comentarios en vivo */
  @SubscribeMessage('join-ticket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: number,
  ) {
    client.join(`ticket:${ticketId}`);
  }

  /** Usuario cierra el detalle de la tarea */
  @SubscribeMessage('leave-ticket')
  handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: number,
  ) {
    client.leave(`ticket:${ticketId}`);
  }

  // ── Métodos para emitir desde servicios ────────────────────────────────────

  /** Notificación personal a un usuario (reemplaza la emisión manual anterior) */
  notifyUser(userId: number, notification: any) {
    this.logger.log(`📨 Emitiendo 'notification' a user:${userId} → "${notification?.titulo ?? notification?.mensaje ?? ''}"`);
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  /** Tarea actualizada (estado, datos) → todos en el tablero */
  broadcastTicketUpdated(proyectoId: number, ticket: any) {
    this.server.to(`board:${proyectoId}`).emit('ticket:updated', ticket);
  }

  /** Nuevo comentario → todos viendo esa tarea */
  broadcastCommentNew(ticketId: number, comment: any) {
    this.server.to(`ticket:${ticketId}`).emit('comment:new', comment);
  }

  // ── Presencia ──────────────────────────────────────────────────────────────

  /** Emite la lista de usuarios activos en un tablero */
  private broadcastPresence(proyectoId: number) {
    const seen   = new Set<number>();
    const users: { id: number; nombre: string; avatar_url?: string }[] = [];

    this.clients.forEach(info => {
      if (
        info.boardId === proyectoId &&
        info.userId  &&
        !seen.has(info.userId)
      ) {
        seen.add(info.userId);
        users.push({
          id:         info.userId,
          nombre:     info.nombre ?? 'Usuario',
          avatar_url: info.avatar_url,
        });
      }
    });

    this.server.to(`board:${proyectoId}`).emit('presence:update', users);
  }
}
