import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import { useNotificationStore } from '../store/notification.store';

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const { setNotifications, markAsRead, markAllAsRead } = useNotificationStore();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
  });

  useEffect(() => {
    if (notifications.length) setNotifications(notifications);
  }, [notifications, setNotifications]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markAsRead(id),
    onSuccess: (_, id) => {
      markAsRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllMutation.mutate,
  };
};