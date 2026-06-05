/**
 * ModuloExpandible — Tarjeta de módulo (sprint) con vista expandible inteligente.
 *
 * Muestra:
 *   - Cabecera con nombre, estado, progreso, acciones rápidas
 *   - Al expandir:
 *     · Tab "Resumen" — métricas, distribución por estado, tareas críticas
 *     · Tab "Tareas" — lista filtrable con asignados y prioridad
 *     · Tab "Equipo" — quién hizo qué (contribuciones por persona)
 *     · Tab "Comentarios" — caja de comentarios del módulo
 *
 * Pensado como acordeón inline para evitar navegación adicional.
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, Lock, ChevronDown, ChevronRight,
  Search, Filter, Layers, MessageSquare, Users as UsersIcon,
  BarChart3, Calendar, Flag, AlertCircle, Zap, Play, ExternalLink,
  Paperclip,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'resumen' | 'tareas' | 'equipo' | 'comentarios';

interface ModuloExpandibleProps {
  mod: any;
  proyectoId: number;
  canEdit: boolean;
  onClose?: (sprintId: number) => void;
  onActivate?: (sprintId: number) => void;
}

const PRIO_COLOR: Record<string, string> = {
  alta:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  baja:  'bg-zinc-800 text-zinc-500 border-zinc-700',
};

const ESTADO_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En desarrollo',
  testing:     'En revisión',
  done:        'Finalizado',
};

const ESTADO_COLOR: Record<string, string> = {
  to_do:       'bg-zinc-700 text-zinc-300 border-zinc-600',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  testing:     'bg-amber-500/15 text-amber-400 border-amber-500/25',
  done:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export const ModuloExpandible = ({ mod, proyectoId, canEdit, onClose, onActivate }: ModuloExpandibleProps) => {
  const [expanded, setExpanded] = useState(false);
  const [tab,      setTab]      = useState<Tab>('resumen');
  const [search,   setSearch]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [filtroPrio,   setFiltroPrio]   = useState<string | null>(null);

  const tickets  = (mod.tickets ?? []) as any[];
  const done     = tickets.filter(t => t.estado === 'done').length;
  const progreso = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;

  // ── Distribución por estado ──────────────────────────────────────────────
  const porEstado = useMemo(() => {
    const acc: Record<string, number> = { to_do: 0, in_progress: 0, testing: 0, done: 0 };
    tickets.forEach(t => { acc[t.estado] = (acc[t.estado] ?? 0) + 1; });
    return acc;
  }, [tickets]);

  // ── Tareas filtradas (para tab Tareas) ───────────────────────────────────
  const tareasFiltradas = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.titulo?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filtroEstado && t.estado !== filtroEstado) return false;
      if (filtroPrio && t.prioridad !== filtroPrio) return false;
      return true;
    });
  }, [tickets, search, filtroEstado, filtroPrio]);

  // ── Contribuciones por persona ───────────────────────────────────────────
  const contribuciones = useMemo(() => {
    const map = new Map<number, { user: any; total: number; done: number; pendientes: number }>();
    tickets.forEach(t => {
      const u = t.asignado_a ?? t.asignado_a_rel;
      if (!u) return;
      const cur = map.get(u.id) ?? { user: u, total: 0, done: 0, pendientes: 0 };
      cur.total++;
      if (t.estado === 'done') cur.done++;
      else cur.pendientes++;
      map.set(u.id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tickets]);

  // ── Tareas críticas (bloqueadas + alta prioridad sin asignar) ────────────
  const criticas = useMemo(() => tickets.filter(t =>
    t.esta_bloqueado || (t.prioridad === 'alta' && t.estado !== 'done')
  ), [tickets]);

  // ── Estado visual del módulo ─────────────────────────────────────────────
  const statusInfo = mod.esta_finalizado
    ? { icon: CheckCircle2, color: 'text-emerald-400',  bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Finalizado' }
    : mod.esta_activo
      ? { icon: Play,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',   label: 'Activo' }
      : { icon: Clock,      color: 'text-zinc-500',    bg: 'bg-zinc-800/50',   border: 'border-zinc-700',      label: 'Planificado' };

  const StatusIcon = statusInfo.icon;

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      expanded
        ? 'border-blue-500/30 bg-zinc-900 shadow-lg shadow-blue-500/5'
        : mod.esta_finalizado
          ? 'border-zinc-800 bg-zinc-900/40'
          : mod.esta_activo
            ? 'border-blue-500/20 bg-zinc-900 hover:border-blue-500/40'
            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
    }`}>

      {/* ── Cabecera (siempre visible) ──────────────────────────────────── */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="p-4 cursor-pointer select-none"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg border ${statusInfo.bg} ${statusInfo.border}`}>
              <StatusIcon size={13} className={statusInfo.color} />
            </div>
            <span className="text-sm font-black text-zinc-100 truncate">{mod.nombre}</span>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-zinc-500 hidden sm:inline">
              {fmt(mod.fecha_inicio)} → {fmt(mod.fecha_fin)}
            </span>
            {canEdit && !mod.esta_finalizado && !mod.esta_activo && onActivate && (
              <button
                onClick={e => { e.stopPropagation(); onActivate(mod.id); }}
                className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
              >
                <Play size={9} fill="currentColor" /> Activar
              </button>
            )}
            {canEdit && mod.esta_activo && !mod.esta_finalizado && onClose && (
              <button
                onClick={e => { e.stopPropagation(); if (confirm(`¿Cerrar módulo "${mod.nombre}"?`)) onClose(mod.id); }}
                className="text-[10px] font-bold text-zinc-500 hover:text-emerald-400 px-2 py-1 rounded-lg border border-zinc-800 hover:border-emerald-500/30 transition-all"
              >
                Cerrar
              </button>
            )}
            {expanded
              ? <ChevronDown  size={16} className="text-zinc-500" />
              : <ChevronRight size={16} className="text-zinc-500" />}
          </div>
        </div>

        {/* Barra de progreso (siempre visible) */}
        {tickets.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>{tickets.length} tareas · {done} completadas · {progreso}%</span>
              {criticas.length > 0 && (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle size={9} /> {criticas.length} crítica{criticas.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden flex">
              {(['done', 'testing', 'in_progress', 'to_do'] as const).map(estado => {
                const count = porEstado[estado] ?? 0;
                if (!count) return null;
                const pct = (count / tickets.length) * 100;
                const colors = {
                  done:        'bg-emerald-500',
                  testing:     'bg-amber-500',
                  in_progress: 'bg-blue-500',
                  to_do:       'bg-zinc-600',
                };
                return (
                  <div
                    key={estado}
                    className={`h-full transition-all ${colors[estado]}`}
                    style={{ width: `${pct}%` }}
                    title={`${ESTADO_LABEL[estado]}: ${count}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Contenido expandido ─────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 border-b border-zinc-800 overflow-x-auto">
              {([
                { id: 'resumen',      label: 'Resumen',      icon: BarChart3 },
                { id: 'tareas',       label: 'Tareas',       icon: Layers },
                { id: 'equipo',       label: 'Contribuciones', icon: UsersIcon },
                { id: 'comentarios',  label: 'Comentarios',  icon: MessageSquare },
              ] as { id: Tab; label: string; icon: any }[]).map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                      active
                        ? 'text-blue-400 border-blue-500'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    <Icon size={11} /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Contenido de tabs */}
            <div className="p-4">

              {/* ── RESUMEN ────────────────────────────────────────────── */}
              {tab === 'resumen' && (
                <div className="space-y-4">
                  {/* Métricas en grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total',         val: tickets.length,            color: 'text-zinc-300',    bg: 'bg-zinc-800/40' },
                      { label: 'En desarrollo', val: porEstado.in_progress,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
                      { label: 'En revisión',   val: porEstado.testing,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
                      { label: 'Finalizadas',   val: porEstado.done,           color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map(m => (
                      <div key={m.label} className={`p-3 rounded-xl border border-zinc-800 ${m.bg}`}>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{m.label}</p>
                        <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tareas críticas */}
                  {criticas.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <AlertCircle size={11} /> Atención requerida ({criticas.length})
                      </p>
                      <div className="space-y-1.5">
                        {criticas.slice(0, 5).map(t => (
                          <Link
                            key={t.id}
                            to={`/tickets/${t.id}`}
                            className="flex items-center gap-2 p-2.5 bg-rose-500/5 border border-rose-500/15 rounded-lg hover:bg-rose-500/10 transition-all group"
                          >
                            {t.esta_bloqueado
                              ? <Flag size={11} className="text-rose-400 shrink-0" fill="currentColor" />
                              : <Zap size={11} className="text-rose-400 shrink-0" />}
                            <span className="text-xs text-zinc-200 truncate flex-1 group-hover:text-white">{t.titulo}</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${PRIO_COLOR[t.prioridad]}`}>
                              {t.prioridad}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descripción del módulo */}
                  {mod.descripcion && (
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Objetivos</p>
                      <p className="text-[13px] text-zinc-300 leading-relaxed bg-zinc-950/50 border border-zinc-800 rounded-xl p-3">
                        {mod.descripcion}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-zinc-800">
                    <Link
                      to={`/projects/${proyectoId}/trimestre/${mod.trimestre_id}/kanban`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all"
                    >
                      <ExternalLink size={11} /> Abrir tablero
                    </Link>
                  </div>
                </div>
              )}

              {/* ── TAREAS ────────────────────────────────────────────── */}
              {tab === 'tareas' && (
                <div className="space-y-3">
                  {/* Filtros */}
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar tarea..."
                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[12px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500/40"
                      />
                    </div>

                    <select
                      value={filtroEstado ?? ''}
                      onChange={e => setFiltroEstado(e.target.value || null)}
                      className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="">Todos los estados</option>
                      {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>

                    <select
                      value={filtroPrio ?? ''}
                      onChange={e => setFiltroPrio(e.target.value || null)}
                      className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="">Toda prioridad</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>

                    {(filtroEstado || filtroPrio || search) && (
                      <button
                        onClick={() => { setSearch(''); setFiltroEstado(null); setFiltroPrio(null); }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-200 underline"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Lista de tareas */}
                  {tareasFiltradas.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-zinc-600">
                      {tickets.length === 0 ? 'Este módulo no tiene tareas aún' : 'Sin coincidencias con los filtros'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {tareasFiltradas.map(t => {
                        const asignado = t.asignado_a ?? t.asignado_a_rel;
                        const hasAdjuntos = (t.adjuntos ?? []).length > 0;
                        return (
                          <Link
                            key={t.id}
                            to={`/tickets/${t.id}`}
                            className="flex items-center gap-3 p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:bg-zinc-900 transition-all group"
                          >
                            {/* Estado */}
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${ESTADO_COLOR[t.estado]}`}>
                              {ESTADO_LABEL[t.estado]}
                            </span>

                            {/* Título */}
                            <span className="text-[12px] text-zinc-200 truncate flex-1 group-hover:text-white">{t.titulo}</span>

                            {/* Indicadores */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {t.codigo_referencia && (
                                <span className="text-[9px] font-mono font-black text-blue-400">KAN-{t.codigo_referencia}</span>
                              )}
                              {t.esta_bloqueado && (
                                <Flag size={9} className="text-rose-400" fill="currentColor" />
                              )}
                              {hasAdjuntos && (
                                <span className="flex items-center gap-0.5 text-[9px] text-zinc-500">
                                  <Paperclip size={9} /> {(t.adjuntos ?? []).length}
                                </span>
                              )}
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${PRIO_COLOR[t.prioridad]}`}>
                                {t.prioridad}
                              </span>
                              {asignado && (
                                <Avatar
                                  nombre={asignado.nombre ?? '?'}
                                  size="xs"
                                  avatarUrl={asignado.avatar_url}
                                />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── EQUIPO / CONTRIBUCIONES ──────────────────────────── */}
              {tab === 'equipo' && (
                <div>
                  {contribuciones.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-zinc-600">
                      Aún no hay tareas asignadas a nadie
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contribuciones.map(c => {
                        const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                        return (
                          <div key={c.user.id} className="flex items-center gap-3 p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                            <Avatar nombre={c.user.nombre} avatarUrl={c.user.avatar_url} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[13px] font-bold text-zinc-200 truncate">{c.user.nombre}</span>
                                <span className="text-[10px] font-black text-zinc-500 shrink-0">
                                  {c.done}/{c.total} · {pct}%
                                </span>
                              </div>
                              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-500">
                                <span>✓ {c.done} completadas</span>
                                {c.pendientes > 0 && <span>⏳ {c.pendientes} pendientes</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── COMENTARIOS ────────────────────────────────────── */}
              {tab === 'comentarios' && (
                <div className="py-8 text-center">
                  <MessageSquare size={28} className="mx-auto text-zinc-700 mb-3" />
                  <p className="text-[12px] font-bold text-zinc-500">Próximamente</p>
                  <p className="text-[11px] text-zinc-600 mt-1 max-w-xs mx-auto">
                    Caja de comentarios del módulo para discusiones con el equipo.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
