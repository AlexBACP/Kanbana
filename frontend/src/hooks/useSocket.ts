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

    socket = io('http://localhost:3000', {
      auth: { token: localStorage.getItem('access_token') },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.emit('join', userId);

    socket.on('notification', handleNotification);

    socket.on('connect', () => {
      socket?.emit('join', userId);
    });

    return () => {
      socket?.off('notification', handleNotification);
      socket?.disconnect();
      socket = null;
    };
  }, [userId, handleNotification]);
};