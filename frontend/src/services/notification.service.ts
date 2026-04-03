import api from './api';

export const notificationService = {
  getAll: async () => {
    const { data } = await api.get('/notifications');
    return data;
  },

  markAsRead: async (id: number) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/notifications/${id}`);
  },
};
