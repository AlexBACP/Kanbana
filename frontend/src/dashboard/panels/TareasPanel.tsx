import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare, Clock, Layers, CheckCircle2, AlertTriangle,
  Search, Filter, Calendar, Flag, Zap, Inbox, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { ticketService }  from '../../services/ticket.service';
import { projectService } from '../../services/project.service';
import { Ticket, TicketStatus } from '../../types/ticket.types';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type FilterKey = 'all' | TicketStatus | 'pool';

// ── Configuración de estado ───────────────────────────────────────────────────
const STATUS_CFG: Record<TicketStatus, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  to_do:       { label: 'Pendiente',   icon: Clock,         dot: 'bg-zinc-400',    badge: 'bg-zinc-800 text-zinc-300 border-zinc-700'              },
  in_progress: { label: 'En progreso', icon: Layers,        dot: 'bg-blue-400',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20'        },
  testing:     { label: 'En revisión', icon: AlertTriangle, dot: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'     },
  done:        { label: 'Completada',  icon: CheckCircle2,  dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  alta:  { label: 'Alta',  color: 'text-rose-400'   },
  media: { label: 'Media', color: 'text-amber-400'  },
  baja:  { label: 'Baja',  color: 'text-blue-400'   },
};

const FILTER_TABS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: 'all',         label: 'Mis tareas',   icon: Filter      },
  { key: 'pool',        label: 'Por tomar',    icon: Inbox       },
  { key: 'to_do',       label: 'Pendientes',   icon: Clock       },
  { key: 'in_progress', label: 'En progreso',  icon: Layers      },
  { key: 'testing',     label: 'En revisión',  icon: AlertTriangle },
  { key: 'done',        label: 'Completadas',  icon: CheckCircle2 },
];

// ── Componente ────────────────────────────────────────────────────────────────
export const TareasPanel = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [search,       setSearch]       = useState('');
  const [sortBy,       setSortBy]       = useState<'recientes' | 'prioridad' | 'proyecto'>('recientes');

  // ── Proyecto del usuario (para obtener el pool de tareas) ────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  // ── Mis tickets asignados ────────────────────────────────────────────────
  const { data: allTickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['mis-tareas'],
    queryFn:  () => ticketService.getAll(),
    select: (data) => data.filter(t =>
      (t as any).asignado_a?.id === user?.id ||
      (t as any).asignado_a_id  === user?.id ||
      t.asignado_a              === user?.id
    ),
    staleTime: 30_000,
  });

  // ── Pool de tareas disponibles (to_do sin asignar en mi proyecto) ────────
  const { data: poolTickets = [], isLoading: poolLoading } = useQuery<Ticket[]>({
    queryKey: ['pool-tasks', miProyecto?.id],
    queryFn:  () => ticketService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    select: (data) => data.filter(t => {
      const asignadoId = (t as any).asignado_a?.id ?? (t as any).asignado_a_id ?? t.asignado_a;
      return t.estado === 'to_do' && !asignadoId;
    }),
    staleTime: 20_000,
  });

  // ── Navegación ───────────────────────────────────────────────────────────
  const navigate = useNavigate();

  // ── Mutaciones ───────────────────────────────────────────────────────────
  const markCompleteMut = useMutation({
    mutationFn: (id: number) => ticketService.markCompleteByAprendiz(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-tareas'] }),
  });

  const claimMut = useMutation({
    mutationFn: (id: number) => ticketService.claimTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-tareas'] });
      qc.invalidateQueries({ queryKey: ['pool-tasks'] });
      // Cambiar al tab de mis tareas para ver la recién tomada
      setActiveFilter('in_progress');
    },
  });

  // ── Conteos por estado ────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:         allTickets.length,
    to_do:       allTickets.filter(t => t.estado === 'to_do').length,
    in_progress: allTickets.filter(t => t.estado === 'in_progress').length,
    testing:     allTickets.filter(t => t.estado === 'testing').length,
    done:        allTickets.filter(t => t.estado === 'done').length,
    pool:        poolTickets.length,
  }), [allTickets, poolTickets]);

  const avance = allTickets.length > 0
    ? Math.round((counts.done / allTickets.length) * 100)
    : 0;

  // ── Lista filtrada y ordenada ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    // El pool tiene su propia lista
    if (activeFilter === 'pool') return [];

    let list = allTickets;
    if (activeFilter !== 'all') list = list.filter(t => t.estado === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.titulo.toLowerCase().includes(q) ||
        t.proyecto?.nombre?.toLowerCase().includes(q)
      );
    }
    const PRIO_ORDER = { alta: 0, media: 1, baja: 2 };
    if (sortBy === 'prioridad') {
      return [...list].sort((a, b) => (PRIO_ORDER[a.prioridad] ?? 1) - (PRIO_ORDER[b.prioridad] ?? 1));
    }
    if (sortBy === 'proyecto') {
      return [...list].sort((a, b) => (a.proyecto?.nombre ?? '').localeCompare(b.proyecto?.nombre ?? ''));
    }
    return [...list].sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [allTickets, activeFilter, search, sortBy]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ══ CABECERA DEL PANEL ══════════════════════════════════════════════ */}
      <div className="px-6 pt-6 pb-4 bg-zinc-900 border-b border-zinc-800 space-y-4 shrink-0">

        {/* Ordenar (a la derecha) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-zinc-600" />
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Filtros activos</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Orden</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2.5 py-1.5 outline-none cursor-pointer focus:border-blue-600 transition-colors"
            >
              <option value="recientes">Recientes</option>
              <option value="prioridad">Prioridad</option>
              <option value="proyecto">Proyecto</option>
            </select>
          </div>
        </div>

        {/* Tabs de filtro + buscador */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_TABS.map(({ key, label, icon: Icon }) => {
              const active = activeFilter === key;
              const count = counts[key as keyof typeof counts] ?? 0;
              const isPool = key === 'pool';
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all border ${
                    active
                      ? isPool
                        ? 'bg-primary-600/15 text-primary-400 border-primary-600/30'
                        : 'bg-blue-600/15 text-blue-400 border-blue-600/30'
                      : 'text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 bg-zinc-900'
                  }`}
                >
                  <Icon size={11} />
                  {label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    active
                      ? isPool
                        ? 'bg-primary-600/20 text-primary-300'
                        : 'bg-blue-600/20 text-blue-300'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {activeFilter !== 'pool' && (
            <div className="relative sm:ml-auto shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tarea o proyecto..."
                className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 outline-none focus:border-blue-600 transition-colors w-52"
              />
            </div>
          )}
        </div>
      </div>

      {/* ══ CONTENIDO ══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">

        {/* ── POOL: tareas disponibles para tomar ─────────────────────── */}
        {activeFilter === 'pool' && (
          <>
            {poolLoading ? (
              <div className="divide-y divide-zinc-800">
                {[1, 2, 3].map(i => (
                  <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-zinc-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 rounded w-1/2" />
                      <div className="h-2 bg-zinc-800/60 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : poolTickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="w-12 h-12 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Inbox size={22} className="text-zinc-700" />
                </div>
                <p className="text-sm font-bold text-zinc-400">No hay tareas disponibles</p>
                <p className="text-xs text-zinc-600 max-w-[240px]">
                  Cuando tu líder cree tareas sin asignar, aparecerán aquí para que las tomes.
                </p>
              </div>
            ) : (
              <>
                {/* Banner informativo */}
                <div className="mx-6 mt-5 mb-3 flex items-start gap-3 p-3.5 bg-primary-500/5 border border-primary-500/15 rounded-md">
                  <Zap size={14} className="text-primary-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-primary-300 leading-relaxed">
                    Estas tareas están disponibles para todo el equipo. Al tomarla, se asignará a ti
                    y pasará a <span className="font-black">En desarrollo</span>. Solo toma las que puedas completar.
                  </p>
                </div>

                {/* Cabecera tabla */}
                <div className="hidden md:grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_90px_110px_120px] px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-10">
                  {['Tarea', 'Proyecto', 'Prioridad', 'Fecha límite', ''].map(h => (
                    <p key={h} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.15em]">{h}</p>
                  ))}
                </div>

                <div className="divide-y divide-zinc-800/50">
                  {poolTickets.map(t => {
                    const pc = PRIORITY_CFG[t.prioridad] ?? PRIORITY_CFG.media;
                    return (
                      <div
                        key={t.id}
                        className="grid grid-cols-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_90px_110px_120px] px-6 py-3.5 hover:bg-zinc-800/25 transition-colors items-center gap-2 md:gap-0 group"
                      >
                        {/* Título */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0 bg-zinc-400" />
                          <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                            {t.titulo}
                          </p>
                        </div>

                        {/* Proyecto (desktop) */}
                        <p className="hidden md:block text-xs text-zinc-500 truncate pr-4">
                          {t.proyecto?.nombre ?? '—'}
                        </p>

                        {/* Prioridad */}
                        <div className="flex items-center gap-1.5">
                          <Flag size={11} className={pc.color} />
                          <span className={`text-xs font-bold ${pc.color}`}>{pc.label}</span>
                        </div>

                        {/* Fecha límite */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          {t.fecha_limite ? (
                            <>
                              <Calendar size={11} className="shrink-0" />
                              {new Date(t.fecha_limite).toLocaleDateString('es-ES', {
                                day: '2-digit', month: 'short',
                              })}
                            </>
                          ) : (
                            <span className="text-zinc-700">Sin fecha</span>
                          )}
                        </div>

                        {/* Botón tomar */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => claimMut.mutate(t.id)}
                            disabled={claimMut.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-400 text-[11px] font-black rounded-md transition-all disabled:opacity-50"
                          >
                            <Zap size={11} />
                            Tomar tarea
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── MIS TAREAS (vista normal) ────────────────────────────────── */}
        {activeFilter !== 'pool' && (
          <>
            {isLoading ? (
              <div className="divide-y divide-zinc-800">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-zinc-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 rounded w-1/2" />
                      <div className="h-2 bg-zinc-800/60 rounded w-1/4" />
                    </div>
                    <div className="h-5 bg-zinc-800 rounded w-20" />
                    <div className="h-5 bg-zinc-800 rounded w-16" />
                  </div>
                ))}
              </div>

            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="w-12 h-12 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <CheckCircle2 size={22} className="text-zinc-700" />
                </div>
                <p className="text-sm font-bold text-zinc-400">
                  {search.trim() ? 'Sin resultados para tu búsqueda' : 'No hay tareas en este filtro'}
                </p>
                <p className="text-xs text-zinc-600 max-w-[240px]">
                  {search.trim()
                    ? 'Prueba con otro término o cambia el filtro'
                    : allTickets.length === 0
                      ? 'Cuando te asignen tareas o tomes una del pool, aparecerán aquí'
                      : 'Todas las tareas de este estado ya están listas'}
                </p>
              </div>

            ) : (
              <>
                {/* Cabecera de columnas */}
                <div className="hidden md:grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_130px_90px_110px_100px] px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-10">
                  {['Tarea', 'Proyecto', 'Estado', 'Prioridad', 'Fecha límite', ''].map(h => (
                    <p key={h} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.15em]">{h}</p>
                  ))}
                </div>

                <div className="divide-y divide-zinc-800/50">
                  {filtered.map(t => {
                    const sc = STATUS_CFG[t.estado];
                    const pc = PRIORITY_CFG[t.prioridad] ?? PRIORITY_CFG.media;
                    const isReady = t.completado_por_aprendiz === true;
                    return (
                      <div
                        key={t.id}
                        onClick={() => navigate(`/tickets/${t.id}`)}
                        className={`cursor-pointer grid grid-cols-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_130px_90px_110px_100px] px-6 py-3.5 transition-colors items-center gap-2 md:gap-0 group ${
                          isReady ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-zinc-800/25'
                        }`}
                      >
                        {/* Título */}
                        <div className="flex items-start md:items-center gap-2.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 md:mt-0 ${isReady ? 'bg-emerald-400' : sc.dot}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate transition-colors ${isReady ? 'text-emerald-200 group-hover:text-emerald-100' : 'text-zinc-200 group-hover:text-white'}`}>
                              {t.titulo}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 md:hidden flex-wrap">
                              {t.proyecto && <span className="text-[10px] text-zinc-500">{t.proyecto.nombre}</span>}
                              {isReady && (
                                <span className="text-[9px] font-black px-1 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase">Completado</span>
                              )}
                              {t.esta_bloqueado && (
                                <span className="text-[9px] font-black px-1 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded uppercase">Bloqueada</span>
                              )}
                            </div>
                          </div>
                          {isReady && (
                            <span className="hidden md:inline text-[9px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase tracking-widest shrink-0">
                              ✓ Completado
                            </span>
                          )}
                          {!isReady && t.esta_bloqueado && (
                            <span className="hidden md:inline text-[9px] font-black px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded uppercase tracking-widest shrink-0">
                              ⚠ Bloqueada
                            </span>
                          )}
                        </div>

                        {/* Proyecto (desktop) */}
                        <p className="hidden md:block text-xs text-zinc-500 truncate pr-4">
                          {t.proyecto?.nombre ?? '—'}
                        </p>

                        {/* Estado — solo lectura para el aprendiz */}
                        <div>
                          <span className={`text-[10px] font-black border rounded-md px-2 py-1 uppercase inline-block ${sc.badge}`}>
                            {isReady ? 'En revisión' : sc.label}
                          </span>
                        </div>

                        {/* Prioridad */}
                        <div className="flex items-center gap-1.5">
                          <Flag size={11} className={pc.color} />
                          <span className={`text-xs font-bold ${pc.color}`}>{pc.label}</span>
                        </div>

                        {/* Fecha límite */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          {t.fecha_limite ? (
                            <>
                              <Calendar size={11} className="shrink-0" />
                              {new Date(t.fecha_limite).toLocaleDateString('es-ES', {
                                day: '2-digit', month: 'short',
                              })}
                            </>
                          ) : (
                            <span className="text-zinc-700">Sin fecha</span>
                          )}
                        </div>

                        {/* Acción: "Marcar listo" para tareas in_progress no completadas */}
                        <div className="flex justify-end">
                          {t.estado === 'in_progress' && !isReady && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markCompleteMut.mutate(t.id); }}
                              disabled={markCompleteMut.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md transition-all disabled:opacity-50"
                              title="Marcar como listo para revisión del líder"
                            >
                              <CheckCircle2 size={10} />
                              Listo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
