import { useEffect, useRef } from 'react';
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

  // Refs estables — evitan recrear el socket cuando cambian settings/funciones
  const addNotificationRef = useRef(addNotification);
  const settingsRef        = useRef(settings);
  const qcRef              = useRef(qc);
  addNotificationRef.current = addNotification;
  settingsRef.current        = settings;
  qcRef.current              = qc;

  useEffect(() => {
    if (!userId) return;

    console.log('[socket] 🔧 montando socket para user:', userId);

    socket = io(window.location.origin, {
      auth:                 { token: localStorage.getItem('access_token') },
      transports:           ['websocket'],
      reconnectionAttempts: 10,
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

    socket.on('notification', (n: Notification) => {
      console.log('[socket] 📨 notification recibida:', n);

      // Lee siempre las refs (valores actualizados sin recrear el efecto)
      if (!settingsRef.current.notificationsEnabled) {
        console.log('[socket] 🔕 notificaciones desactivadas, se guarda solo en BD');
        return;
      }

      addNotificationRef.current(n);
      qcRef.current.invalidateQueries({ queryKey: ['notifications'] });

      // Notificación nativa del SO (si tiene permiso)
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        n.mensaje
      ) {
        try {
          new Notification('Kanbana', { body: n.mensaje, icon: '/favicon.ico' });
        } catch { /* algunos navegadores limitan */ }
      }
    });

    return () => {
      console.log('[socket] 🔌 desconectando socket');
      socket?.off('notification');
      socket?.disconnect();
      socket = null;
    };
  }, [userId]); // ← solo userId, refs evitan recrear conexión
};