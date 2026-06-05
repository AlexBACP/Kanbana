/**
 * NotificationsPanel — Rediseñado
 *
 * Mejoras:
 * - Animaciones de entrada/salida con framer-motion
 * - Agrupado por tiempo: Hoy / Esta semana / Anteriores
 * - Formulario inline para responder solicitudes de permiso (sin window.prompt)
 * - Botón de borrar por notificación
 * - Tiempo relativo: "hace 5 min", "ayer", etc.
 * - Iconos específicos por tipo y action_type
 * - Auto-refresco cada 30s con indicador visual
 * - Punto de pulso animado para no leídas
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, CheckCircle2, X, Check,
  Info, AlertTriangle, Trash2, Shield,
  Clock, Zap, RefreshCw, GraduationCap, ChevronDown, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notification.service';
import { notifTarget } from '../../utils/notifTarget';
import { permisosService }     from '../../services/permisos.service';
import { fichaService }        from '../../services/ficha.service';
import { projectService }      from '../../services/project.service';
import { useAuthStore }        from '../../store/auth.store';

// ── Helpers de tiempo ─────────────────────────────────────────────────────────

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins  < 1)   return 'Ahora mismo';
  if (mins  < 60)  return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h     < 24)  return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1)     return 'Ayer';
  if (d     < 7)   return `Hace ${d} días`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

type TGroup = 'hoy' | 'semana' | 'anterior';
const GROUP_LABEL: Record<TGroup, string> = {
  hoy:      'Hoy',
  semana:   'Esta semana',
  anterior: 'Anteriores',
};
function getGroup(dateStr: string | Date | null | undefined): TGroup {
  if (!dateStr) return 'anterior';
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  return h < 24 ? 'hoy' : h < 168 ? 'semana' : 'anterior';
}

// ── Configuración de iconos/colores ──────────────────────────────────────────

const TYPE_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; leftBorder: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/12', leftBorder: 'border-l-emerald-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/12',  leftBorder: 'border-l-amber-500'  },
  error:   { icon: Zap,           color: 'text-rose-400',   bg: 'bg-rose-500/12',   leftBorder: 'border-l-rose-500'   },
  info:    { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/12',   leftBorder: 'border-l-blue-500'   },
};
const ACTION_ICON: Record<string, React.ElementType> = {
  permiso_solicitud:     Shield,
  approve_ficha_request: GraduationCap,
  solicitar_modulo:      Layers,
};

function getNotifCfg(n: any) {
  const base = TYPE_CFG[n.tipo] ?? TYPE_CFG.info;
  const icon = (n.action_type && ACTION_ICON[n.action_type]) ? ACTION_ICON[n.action_type] : base.icon;
  return { ...base, icon };
}

// ── Smart clustering ──────────────────────────────────────────────────────────
// Agrupa notificaciones consecutivas con el mismo tipo y título similar en un
// solo "cluster" colapsable, evitando listas largas de eventos repetidos.
// Las notificaciones con action_type (permisos, fichas) siempre se muestran sueltas.

type NotifItem = any;
type ClusteredItem =
  | { kind: 'single'; notif: NotifItem; key: string }
  | { kind: 'cluster'; notifs: NotifItem[]; key: string };

function clusterGroup(items: NotifItem[]): ClusteredItem[] {
  const result: ClusteredItem[] = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    // Notificaciones con acción interactiva — siempre sueltas
    if (cur.action_type) {
      result.push({ kind: 'single', notif: cur, key: String(cur.id) });
      i++;
      continue;
    }
    // Clave de agrupación: tipo + primeros 40 chars del título
    const key = `${cur.tipo ?? ''}|${(cur.titulo ?? '').slice(0, 40)}`;
    let j = i + 1;
    while (j < items.length && !items[j].action_type) {
      const nk = `${items[j].tipo ?? ''}|${(items[j].titulo ?? '').slice(0, 40)}`;
      if (nk === key) j++;
      else break;
    }
    const run = items.slice(i, j);
    if (run.length >= 2) {
      result.push({ kind: 'cluster', notifs: run, key: `cluster-${cur.id}` });
    } else {
      result.push({ kind: 'single', notif: cur, key: String(cur.id) });
    }
    i = j;
  }
  return result;
}

// ── Componente principal ──────────────────────────────────────────────────────

export const NotificationsPanel = () => {
  const qc       = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Abrir destino al hacer clic en una notificación: marca como leída + navega
  const openNotif = (n: any) => {
    if (!n.leida) markReadMut.mutate(n.id);
    const target = notifTarget(n);
    if (target) navigate(target);
  };

  // Clusters expandidos (key = "cluster-<firstId>")
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const toggleCluster = (key: string) =>
    setExpandedClusters(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Estado para el formulario inline de permisos
  const [actionState, setActionState] = useState<{
    notifId:   number;
    permisoId: number;
    mode:      'accept' | 'reject';
  } | null>(null);
  const [diasInput,    setDiasInput]    = useState('7');
  const [motivoInput,  setMotivoInput]  = useState('');

  // Estado para respuesta a solicitud de ficha
  const [fichaAction, setFichaAction] = useState<{
    notifId:       number;
    instructorId:  number;
    mode:          'approve' | 'reject';
  } | null>(null);
  const [fichaMotivoInput, setFichaMotivoInput] = useState('');

  // Estado para respuesta a solicitud de módulo (sprint)
  const [sprintAction, setSprintAction] = useState<{
    notifId: number;
    mode:    'accept' | 'reject';
  } | null>(null);
  const [sprintMotivoInput, setSprintMotivoInput] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: notifications = [], isLoading, isFetching } = useQuery({
    queryKey:        ['notifications'],
    queryFn:         notificationService.getAll,
    staleTime:       20_000,
    refetchInterval: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const aceptarMut = useMutation({
    mutationFn: ({ permisoId, dias }: { permisoId: number; dias: number }) =>
      permisosService.aceptar(permisoId, dias),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setActionState(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al aceptar el permiso'),
  });

  const rechazarMut = useMutation({
    mutationFn: ({ permisoId, motivo }: { permisoId: number; motivo?: string }) =>
      permisosService.rechazar(permisoId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setActionState(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al rechazar'),
  });

  const responderFichaMut = useMutation({
    mutationFn: ({ instructorId, aprobada, motivo }: { instructorId: number; aprobada: boolean; motivo?: string }) =>
      fichaService.responderSolicitud(instructorId, aprobada, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setFichaAction(null);
      setFichaMotivoInput('');
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al responder la solicitud'),
  });

  const aceptarSprintMut = useMutation({
    mutationFn: (notifId: number) => projectService.acceptSprintSolicitud(notifId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setSprintAction(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al aceptar la solicitud'),
  });

  const rechazarSprintMut = useMutation({
    mutationFn: ({ notifId, motivo }: { notifId: number; motivo?: string }) =>
      projectService.rejectSprintSolicitud(notifId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setSprintAction(null);
      setSprintMotivoInput('');
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al rechazar la solicitud'),
  });

  const markReadMut = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMut = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMut = useMutation({
    mutationFn: notificationService.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // ── Derivados ──────────────────────────────────────────────────────────────
  const notifs = useMemo(() => (notifications as any[]).filter(n => {
    if (!n.para_rol || n.para_rol === 'todos') return true;
    return n.para_rol === user?.rol;
  }), [notifications, user?.rol]);

  const unread = notifs.filter(n => !n.leida).length;

  const grouped = useMemo<Record<TGroup, any[]>>(() => {
    const g: Record<TGroup, any[]> = { hoy: [], semana: [], anterior: [] };
    notifs.forEach(n => g[getGroup(n.creado_en)].push(n));
    return g;
  }, [notifs]);

  // ── Handlers de permiso ───────────────────────────────────────────────────
  const openAction = (n: any, mode: 'accept' | 'reject') => {
    const data = JSON.parse(n.action_data || '{}');
    setActionState({ notifId: n.id, permisoId: data.permiso_id, mode });
    setDiasInput('7');
    setMotivoInput('');
  };

  const handleAccept = () => {
    if (!actionState) return;
    const dias = parseInt(diasInput);
    if (isNaN(dias) || dias < 5) {
      alert('El permiso debe durar al menos 5 días');
      return;
    }
    aceptarMut.mutate({ permisoId: actionState.permisoId, dias });
  };

  const handleReject = () => {
    if (!actionState) return;
    rechazarMut.mutate({ permisoId: actionState.permisoId, motivo: motivoInput || undefined });
  };

  // ── Render: notificación individual ───────────────────────────────────────
  const renderNotif = (n: any) => {
    const cfg              = getNotifCfg(n);
    const Icon             = cfg.icon;
    const isExpanded       = actionState?.notifId === n.id;
    const isPermiso        = n.action_type === 'permiso_solicitud'    && !n.leida;
    const isFichaRequest   = n.action_type === 'approve_ficha_request' && !n.leida;
    const isFichaExpanded  = fichaAction?.notifId === n.id;
    const isSprintRequest  = n.action_type === 'solicitar_modulo'     && !n.leida;
    const isSprintExpanded = sprintAction?.notifId === n.id;

    // Las notificaciones de acción (permiso, ficha, sprint) NO deben navegar
    // al hacer clic — tienen sus propios botones inline.
    const hasInlineAction = isPermiso || isFichaRequest || isSprintRequest;
    const target          = hasInlineAction ? null : notifTarget(n);
    const isLink          = !!target;

    return (
      <motion.div
        key={n.id}
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 30, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        onClick={isLink ? () => openNotif(n) : undefined}
        title={isLink ? 'Abrir' : undefined}
        className={`relative flex items-start gap-3.5 px-4 py-4 group border-l-[3px] transition-colors ${
          isLink ? 'cursor-pointer' : ''
        } ${
          !n.leida
            ? `${cfg.leftBorder} bg-zinc-800/25 hover:bg-zinc-800/40`
            : 'border-l-transparent hover:bg-zinc-800/15'
        }`}
      >
        {/* Punto de pulso — no leída */}
        {!n.leida && (
          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-zinc-900 animate-pulse" />
        )}

        {/* Ícono badge */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          n.leida ? 'bg-zinc-800/50' : cfg.bg
        }`}>
          <Icon size={16} className={n.leida ? 'text-zinc-600' : cfg.color} />
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-w-0 pr-7">
          {n.titulo && (
            <p className={`text-[11px] font-black uppercase tracking-widest mb-1 leading-tight ${
              n.leida ? 'text-zinc-600' : 'text-zinc-300'
            }`}>
              {n.titulo}
            </p>
          )}
          <p className={`text-sm leading-relaxed ${n.leida ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {n.mensaje}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1.5 flex items-center gap-1">
            <Clock size={9} className="shrink-0" />
            {timeAgo(n.creado_en)}
          </p>

          {/* Botones de acción — solicitud de permiso */}
          {isPermiso && !isExpanded && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => openAction(n, 'accept')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-bold hover:bg-emerald-500/25 transition-all"
              >
                <Check size={12} /> Aceptar permiso
              </button>
              <button
                onClick={() => openAction(n, 'reject')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition-all"
              >
                <X size={12} /> Rechazar
              </button>
            </div>
          )}

          {/* Botones de acción — solicitud de creación de ficha */}
          {/* `responderFichaMut.isPending` desactiva los botones mientras el
              backend procesa la respuesta para evitar doble-click. El backend
              además elimina TODAS las notifs de la solicitud al procesarse,
              por lo que tras el éxito de la mutation los botones desaparecen
              porque la notificación ya no existe en la lista. */}
          {isFichaRequest && !isFichaExpanded && (
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={responderFichaMut.isPending}
                onClick={() => {
                  const data = JSON.parse(n.action_data || '{}');
                  setFichaAction({ notifId: n.id, instructorId: data.instructorId, mode: 'approve' });
                  setFichaMotivoInput('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/25 text-xs font-bold hover:bg-blue-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={12} /> Aprobar solicitud
              </button>
              <button
                disabled={responderFichaMut.isPending}
                onClick={() => {
                  const data = JSON.parse(n.action_data || '{}');
                  setFichaAction({ notifId: n.id, instructorId: data.instructorId, mode: 'reject' });
                  setFichaMotivoInput('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X size={12} /> Rechazar
              </button>
            </div>
          )}

          {/* Botones de acción — solicitud de módulo (sprint) */}
          {isSprintRequest && !isSprintExpanded && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => { setSprintAction({ notifId: n.id, mode: 'accept' }); setSprintMotivoInput(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-bold hover:bg-emerald-500/25 transition-all"
              >
                <Check size={12} /> Aceptar módulo
              </button>
              <button
                onClick={() => { setSprintAction({ notifId: n.id, mode: 'reject' }); setSprintMotivoInput(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition-all"
              >
                <X size={12} /> Rechazar
              </button>
            </div>
          )}

          {/* Formulario inline — respuesta a solicitud de módulo */}
          <AnimatePresence>
            {isSprintExpanded && sprintAction && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                {sprintAction.mode === 'accept' ? (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-emerald-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                      Confirmar creación del módulo
                    </p>
                    <p className="text-xs text-zinc-400">
                      El módulo se creará automáticamente y el líder técnico recibirá una notificación.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => aceptarSprintMut.mutate(sprintAction.notifId)}
                        disabled={aceptarSprintMut.isPending}
                        className="flex-1 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {aceptarSprintMut.isPending ? 'Creando módulo…' : '✓ Aceptar y crear módulo'}
                      </button>
                      <button
                        onClick={() => setSprintAction(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-rose-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-400">
                      Motivo del rechazo
                    </p>
                    <textarea
                      value={sprintMotivoInput}
                      onChange={e => setSprintMotivoInput(e.target.value)}
                      placeholder="Explica brevemente por qué rechazas el módulo (opcional)…"
                      rows={2}
                      className="w-full bg-zinc-700/80 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/40 resize-none placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rechazarSprintMut.mutate({ notifId: sprintAction.notifId, motivo: sprintMotivoInput || undefined })}
                        disabled={rechazarSprintMut.isPending}
                        className="flex-1 py-2 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {rechazarSprintMut.isPending ? 'Enviando…' : '✗ Rechazar solicitud'}
                      </button>
                      <button
                        onClick={() => setSprintAction(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario inline — respuesta a solicitud de ficha */}
          <AnimatePresence>
            {isFichaExpanded && fichaAction && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                {fichaAction.mode === 'approve' ? (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-blue-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-blue-400">
                      Confirmar aprobación
                    </p>
                    <p className="text-xs text-zinc-400">
                      El instructor recibirá un correo confirmando que puede crear la nueva ficha.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => responderFichaMut.mutate({ instructorId: fichaAction.instructorId, aprobada: true })}
                        disabled={responderFichaMut.isPending}
                        className="flex-1 py-2 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {responderFichaMut.isPending ? 'Enviando…' : '✓ Aprobar y notificar'}
                      </button>
                      <button
                        onClick={() => setFichaAction(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-rose-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-400">
                      Motivo del rechazo
                    </p>
                    <textarea
                      value={fichaMotivoInput}
                      onChange={e => setFichaMotivoInput(e.target.value)}
                      placeholder="Explica brevemente el motivo del rechazo (opcional)…"
                      rows={2}
                      className="w-full bg-zinc-700/80 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/40 resize-none placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => responderFichaMut.mutate({ instructorId: fichaAction.instructorId, aprobada: false, motivo: fichaMotivoInput || undefined })}
                        disabled={responderFichaMut.isPending}
                        className="flex-1 py-2 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {responderFichaMut.isPending ? 'Enviando…' : '✗ Rechazar y notificar'}
                      </button>
                      <button
                        onClick={() => setFichaAction(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario inline expandible */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                {actionState?.mode === 'accept' ? (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-emerald-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                      Duración del permiso
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={5}
                        max={90}
                        value={diasInput}
                        onChange={e => setDiasInput(e.target.value)}
                        className="w-20 bg-zinc-700/80 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 font-bold outline-none focus:border-emerald-500/50 text-center"
                      />
                      <span className="text-xs text-zinc-400">
                        días <span className="text-zinc-600">(mín. 5)</span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAccept}
                        disabled={aceptarMut.isPending}
                        className="flex-1 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {aceptarMut.isPending ? 'Guardando…' : `✓ Conceder ${diasInput} días`}
                      </button>
                      <button
                        onClick={() => setActionState(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-zinc-800/70 rounded-xl border border-rose-500/20 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-400">
                      Motivo del rechazo
                    </p>
                    <textarea
                      value={motivoInput}
                      onChange={e => setMotivoInput(e.target.value)}
                      placeholder="Explica brevemente por qué rechazas la solicitud (opcional)…"
                      rows={2}
                      className="w-full bg-zinc-700/80 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/40 resize-none placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={rechazarMut.isPending}
                        className="flex-1 py-2 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                      >
                        {rechazarMut.isPending ? 'Guardando…' : '✗ Rechazar solicitud'}
                      </button>
                      <button
                        onClick={() => setActionState(null)}
                        className="px-3 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Acciones al hover (top-right) */}
        <div className="absolute right-2.5 top-3.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!n.leida && n.action_type !== 'permiso_solicitud' && n.action_type !== 'solicitar_modulo' && (
            <button
              onClick={() => markReadMut.mutate(n.id)}
              title="Marcar como leída"
              className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
            >
              <CheckCheck size={11} />
            </button>
          )}
          <button
            onClick={() => deleteMut.mutate(n.id)}
            title="Eliminar notificación"
            className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </motion.div>
    );
  };

  // ── Render: cluster colapsable ────────────────────────────────────────────
  const renderCluster = (notifs: NotifItem[], key: string) => {
    const first       = notifs[0];
    const cfg         = getNotifCfg(first);
    const Icon        = cfg.icon;
    const isExpanded  = expandedClusters.has(key);
    const unreadCount = notifs.filter((n: any) => !n.leida).length;

    return (
      <div key={key} className="border-b border-zinc-800/50 last:border-b-0">
        {/* Cabecera colapsable del cluster */}
        <button
          onClick={() => toggleCluster(key)}
          className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left border-l-[3px] transition-colors ${cfg.leftBorder} hover:bg-zinc-800/20`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
            <Icon size={16} className={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-0.5 truncate">
              {first.titulo}
            </p>
            <p className="text-[11px] text-zinc-500">
              <span className="font-bold text-zinc-400">{notifs.length}</span> notificaciones similares
              {unreadCount > 0 && (
                <span className="ml-2 font-bold text-blue-400">· {unreadCount} sin leer</span>
              )}
            </p>
          </div>
          <ChevronDown
            size={14}
            className={`text-zinc-600 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Items expandidos */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-l-2 border-zinc-800 ml-4"
            >
              {notifs.map((n: any) => renderNotif(n))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const groupOrder: TGroup[] = ['hoy', 'semana', 'anterior'];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-6 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-zinc-300" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] font-black text-white flex items-center justify-center px-1 ring-2 ring-zinc-900">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-base font-black text-zinc-100 uppercase tracking-widest">
              Notificaciones
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
              {unread > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  {unread} sin leer
                </>
              ) : (
                'Todo al día ✓'
              )}
              {isFetching && !isLoading && (
                <RefreshCw size={9} className="text-zinc-600 animate-spin ml-1" />
              )}
            </p>
          </div>
        </div>

        {unread > 0 && (
          <button
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-60"
          >
            <CheckCheck size={12} /> Leer todas
          </button>
        )}
      </div>

      {/* Lista / skeletons / vacío */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-20 bg-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-14 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
            <Bell size={22} className="text-zinc-600" />
          </div>
          <p className="text-sm font-bold text-zinc-400">Sin notificaciones</p>
          <p className="text-xs text-zinc-600 mt-1">Todo tranquilo por aquí</p>
        </motion.div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {groupOrder.map(group => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            const groupUnread = items.filter((n: any) => !n.leida).length;

            return (
              <div key={group}>
                {/* Encabezado de grupo */}
                <div className="px-4 py-2.5 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    {GROUP_LABEL[group]}
                  </span>
                  {groupUnread > 0 && (
                    <span className="text-[9px] font-black px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full">
                      {groupUnread} nueva{groupUnread > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Items (con clustering inteligente) */}
                <div className="divide-y divide-zinc-800/50 relative">
                  <AnimatePresence initial={false}>
                    {clusterGroup(items).map(item =>
                      item.kind === 'cluster'
                        ? renderCluster(item.notifs, item.key)
                        : renderNotif(item.notif)
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
