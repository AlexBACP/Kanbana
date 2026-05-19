import api from './api';

// ── Tipos que coinciden exactamente con lo que retorna el backend ─────────
export interface TicketPorUsuario {
  id: number;
  nombre: string;
  total: number;
  completados: number;
  en_progreso: number;
  pendientes: number;
  porcentaje: number;
}

export interface DashboardStats {
  tickets_abiertos: number;
  tickets_en_progreso: number;
  tickets_completados: number;
  tickets_bloqueados: number;
  proyectos_activos: number;
  proyectos_total: number;
  avance_porcentual: number;
  tickets_por_usuario: TicketPorUsuario[];
  tickets_por_prioridad: { prioridad: string; total: number }[];
  proyectos_recientes: {
    id: number;
    nombre: string;
    estado: string;
    avance: number;
    total_tickets: number;
  }[];
}

export const dashboardService = {
  // ── CAMBIO: una sola llamada a /dashboard/stats en lugar de múltiples
  // queries a /tickets y /projects por separado
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
};