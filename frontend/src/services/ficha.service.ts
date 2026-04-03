import api from './api';

export interface Ficha {
  id: number;
  codigo: string;
  programa: string;
  fecha_inicio: string;
  fecha_fin: string;
  creado_en: string;
}

export interface CreateFichaDto {
  codigo: string;
  programa: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export const fichaService = {
  getAll: async (): Promise<Ficha[]> => {
    const { data } = await api.get('/fichas');
    return data;
  },

  create: async (dto: CreateFichaDto): Promise<Ficha> => {
    const { data } = await api.post('/fichas', dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/fichas/${id}`);
  },
};
