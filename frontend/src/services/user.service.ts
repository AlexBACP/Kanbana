import api from './api';

const BASE = 'http://localhost:3000';

export const userService = {
  getAll: (rol?: string) =>
    api.get(`/users${rol ? `?rol=${rol}` : ''}`).then(r => r.data),

  getMyContext: () => api.get('/users/me/context').then(r => r.data),

  /** Dashboard context — info enriquecida de ficha, instructor, proyecto, sprint */
  getMyDashboardContext: () => api.get('/users/me/dashboard-context').then(r => r.data),

  getByFicha: (fichaId: number) =>
    api.get(`/users/by-ficha/${fichaId}`).then(r => r.data),

  getByProyecto: (proyectoId: number) =>
    api.get(`/users/by-proyecto/${proyectoId}`).then(r => r.data),

  getById: (id: number) => api.get(`/users/${id}`).then(r => r.data),

  // Perfil completo enriquecido (fichas, proyectos, tickets según rol)
  getProfile: (id: number) => api.get(`/users/${id}/profile`).then(r => r.data),

  create: (dto: any) => api.post('/users', dto).then(r => r.data),

  update: (id: number, dto: any) => api.patch(`/users/${id}`, dto).then(r => r.data),

  updateRole: (id: number, rol: string) =>
    api.patch(`/users/${id}/role`, { rol }).then(r => r.data),

  toggleStatus: (id: number) => api.patch(`/users/${id}/toggle`).then(r => r.data),

  // Confirma manualmente la cuenta de un usuario (solo coordinador)
  // Útil cuando el usuario no tiene acceso al correo donde llegó la invitación
  confirmAccountManual: (id: number) =>
    api.patch(`/users/${id}/confirm-account`).then(r => r.data),

  // Confirmación masiva — coordinador o instructor confirman varios a la vez
  confirmBulk: (userIds: number[]): Promise<{ confirmed: number[]; errors: { id: number; reason: string }[] }> =>
    api.post('/users/bulk-confirm', { userIds }).then(r => r.data),

  // Activa/desactiva el sub-rol de Líder Técnico (solo para aprendices, no cambia el rol base)
  toggleLiderTecnico: (id: number) =>
    api.patch(`/users/${id}/toggle-lider`).then(r => r.data),

  delete: (id: number) => api.delete(`/users/${id}`).then(r => r.data),

  getLeaderStats: (id: number) => api.get(`/users/leaders/${id}/stats`).then(r => r.data),

  getLeaderTeam: (id: number) => api.get(`/users/leaders/${id}/team`).then(r => r.data),

  // Cambiar contraseña propia (necesita contraseña actual)
  changeOwnPassword: (id: number, actual: string, nueva: string) =>
    api.patch(`/users/${id}/password/own`, { actual, nueva }).then(r => r.data),

  // Crear contraseña por primera vez (usuarios Google/GitHub, sin contraseña actual)
  setInitialPassword: (nueva: string) =>
    api.post('/users/me/set-password', { nueva }).then(r => r.data),

  // Cambiar contraseña ajena (coordinador / instructor sobre sus aprendices)
  changePasswordAsAdmin: (targetId: number, nueva: string) =>
    api.patch(`/users/${targetId}/password/admin`, { nueva }).then(r => r.data),

  // Upload de avatar real — multipart/form-data
  uploadAvatar: async (id: number, file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post(`/users/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Upload de banner real — multipart/form-data
  uploadBanner: async (id: number, file: File): Promise<{ banner_url: string }> => {
    const formData = new FormData();
    formData.append('banner', file);
    const { data } = await api.post(`/users/${id}/banner`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Helper para construir la URL pública (avatars, banners, cualquier /uploads/)
  getAvatarUrl: (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BASE}${url}`;
  },

  // ── VINCULACIÓN DE APRENDICES AUTO-REGISTRADOS A UNA FICHA ──────────────
  /** Aprendiz solicita unirse a una ficha indicando código + jornada + documento */
  solicitarVinculacion: (dto: { codigoFicha: string; jornada: 'mañana' | 'tarde' | 'noche'; documento: string }) =>
    api.post('/users/me/solicitar-vinculacion', dto).then(r => r.data),

  /** Instructor lista las solicitudes pendientes de su ficha */
  getSolicitudesPendientes: (fichaId: number) =>
    api.get(`/users/solicitudes-pendientes/ficha/${fichaId}`).then(r => r.data),

  /** Instructor aprueba la solicitud */
  aprobarVinculacion: (userId: number) =>
    api.patch(`/users/${userId}/aprobar-vinculacion`).then(r => r.data),

  /** Instructor rechaza la solicitud (motivo opcional) */
  rechazarVinculacion: (userId: number, motivo?: string) =>
    api.patch(`/users/${userId}/rechazar-vinculacion`, { motivo }).then(r => r.data),

  /** Fuerza una revisión de rebotes de correo (lee la bandeja IMAP) */
  revisarRebotes: (): Promise<{ revisados: number; rebotados: number; correos: string[] }> =>
    api.post('/bounces/revisar').then(r => r.data),
};
