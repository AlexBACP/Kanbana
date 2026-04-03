import api from './api';

const ENDPOINT = '/users';

export const userService = {
  getAll: async () => {
    const res = await api.get(ENDPOINT);
    return res.data;
  },

  getById: async (id: number) => {
    const res = await api.get(`${ENDPOINT}/${id}`);
    return res.data;
  },

  create: async (data: any) => {
    const res = await api.post(ENDPOINT, data);
    return res.data;
  },

  update: async (id: number, data: any) => {
    const res = await api.patch(`${ENDPOINT}/${id}`, data);
    return res.data;
  },

  delete: async (id: number) => {
    await api.delete(`${ENDPOINT}/${id}`);
  },

  updateRole: async (id: number, rol: string) => {
    const res = await api.patch(`${ENDPOINT}/${id}`, { rol });
    return res.data;
  },

  toggleStatus: async (id: number) => {
    const res = await api.patch(`${ENDPOINT}/${id}/toggle`);
    return res.data;
  },

  getLeaderStats: async (leaderId: number) => {
    const res = await api.get(`${ENDPOINT}/leaders/${leaderId}/stats`);
    return res.data;
  },

  getLeaderTeam: async (leaderId: number) => {
    const res = await api.get(`${ENDPOINT}/leaders/${leaderId}/team`);
    return res.data;
  },
};
