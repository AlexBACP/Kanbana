/**
 * permisos.service.ts — Frontend
 * Métodos para solicitar y verificar permisos temporales.
 */
import api from './api';
import { TipoPermiso } from '../types/permiso.types';

export const permisosService = {

  /** El líder solicita un permiso al instructor */
  solicitar: (body: {
    proyectoId:    number;
    instructorId:  number;
    tipo:          TipoPermiso;
    justificacion?: string;
  }) => api.post('/permisos/solicitar', body).then(r => r.data),

  /** Verifica si el usuario autenticado tiene un permiso vigente */
  verificar: (proyectoId: number, tipo: TipoPermiso) =>
    api.get('/permisos/verificar', { params: { proyectoId, tipo } }).then(r => r.data) as
      Promise<{ tiene: boolean; expira_en: string | null }>,

  /** El instructor acepta una solicitud */
  aceptar: (permisoId: number, dias: number) =>
    api.post(`/permisos/${permisoId}/aceptar`, { dias }).then(r => r.data),

  /** El instructor rechaza una solicitud */
  rechazar: (permisoId: number, motivo?: string) =>
    api.post(`/permisos/${permisoId}/rechazar`, { motivo }).then(r => r.data),
};