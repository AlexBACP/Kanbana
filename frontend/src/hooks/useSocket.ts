import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from '../store/notification.store';
import { Notification } from '../types/notification.types';

let socket: Socket | null = null;

export const useSocket = (userId: number | undefined) => {
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!userId) return;

    socket = io('http://localhost:3000', {
      auth: { token: localStorage.getItem('access_token') },
    });

    socket.emit('join', userId);

    socket.on('notification', (notification: Notification) => {
      addNotification(notification);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [userId, addNotification]);
};