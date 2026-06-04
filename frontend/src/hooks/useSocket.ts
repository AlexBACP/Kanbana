import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from '../store/notification.store';
import { useAuthStore } from '../store/auth.store';
import type { Notification } from '../types/notification.types';

let socket: Socket | null = null;

export const useSocket = (userId: number | undefined) => {
  const { addNotification } = useNotificationStore();
  const { settings } = useAuthStore();
  const qc = useQueryClient();

  const handleNotification = useCallback((notification: Notification) => {
    // Si el usuario desactivó las notificaciones en ajustes, ignorar
    if (!settings.notificationsEnabled) return;

    addNotification(notification);
    qc.invalidateQueries({ queryKey: ['notifications'] });

    // Notificación del browser (si tiene permiso)
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      notification.mensaje
    ) {
      new Notification('Kanbana', {
        body: notification.mensaje,
        icon: '/favicon.ico',
      });
    }
  }, [addNotification, qc, settings.notificationsEnabled]);

  useEffect(() => {
    if (!userId) return;

    socket = io(window.location.origin, {
      auth:                { token: localStorage.getItem('access_token') },
      transports:          ['websocket'],   // evita polling (falla CORS en prod con nginx)
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    });

    socket.on('connect', () => {
      console.log('[socket] ✅ conectado', socket?.id, '→ join user', userId);
      socket?.emit('join', userId);
    });
    socket.on('connect_error', (err) => {
      console.warn('[socket] ❌ connect_error:', err?.message);
    });
    socket.on('disconnect', (reason) => {
      console.warn('[socket] ⚠ desconectado:', reason);
    });

    socket.on('notification', (n) => {
      console.log('[socket] 📨 notification recibida:', n);
      handleNotification(n);
    });

    return () => {
      socket?.off('notification');
      socket?.disconnect();
      socket = null;
    };
  }, [userId, handleNotification]);
};