import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon, CheckCircle2, Clock, Lightbulb,
  AlertTriangle, Layers, FolderKanban, ChevronRight, Zap,
  CheckCheck, Inbox, Link2, Github, HardDrive, BookOpen, LayoutGrid,
} from 'lucide-react';
import { SprintContextBanner } from '../../components/SprintContextBanner';
import { useAuthStore } from '../../store/auth.store';
import { ticketService }  from '../../services/ticket.service';
import { projectService } from '../../services/project.service';
import { recursoService } from '../../services/recurso.service';
import { GitHubWidget }   from '../../components/GitHubWidget';
import { Ticket } from '../../types/ticket.types';

// ── Sugerencias rotativas (específicas para aprendiz) ────────────────────────
const SUGGESTIONS = [
  '¿Tienes tareas en progreso? Completa una antes de tomar otra del pool disponible.',
  'Si tu última tarea está lista, márcala ahora para que el líder la revise antes del cierre del módulo.',
  'Los detalles en tus evidencias hacen la diferencia en la revisión del instructor — documenta cada paso.',
  'Una tarea bien entregada hoy evita correcciones de último momento cuando se cierre el módulo vigente.',
  'Comunica cualquier bloqueo hoy mismo — tu líder puede desbloquearte en cuestión de minutos.',
  'Revisa el tablero del módulo activo — puede haber tareas del equipo que dependan de las tuyas.',
  'Antes de terminar el día, actualiza el estado de todas tus tareas para que el líder tenga visibilidad.',
];

const STAT_CONFIG = [
  { key: 'to_do'      , label: 'Pendientes',  icon: Clock,         color: 'text-zinc-400',    bg: 'bg-zinc-800/60'     },
  { key: 'in_progress', label: 'En progreso', icon: Layers,        color: 'text-blue-400',    bg: 'bg-blue-500/10'     },
  { key: 'testing'    , label: 'En revisión', icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10'    },
  { key: 'done'       , label: 'Completadas', icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10'  },
] as const;

const STATUS_ICON: Record<string, React.ElementType> = {
  to_do: Clock, in_progress: Layers, testing: AlertTriangle, done: CheckCircle2,
};
const STATUS_COLOR: Record<string, string> = {
  to_do: 'text-zinc-400', in_progress: 'text-blue-400', testing: 'text-amber-400', done: 'text-emerald-400',
};

const RECURSO_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  github: { icon: Github,     color: 'text-zinc-300'   },
  drive:  { icon: HardDrive,  color: 'text-amber-400'  },
  docs:   { icon: BookOpen,   color: 'text-emerald-400'},
  notion: { icon: BookOpen,   color: 'text-pink-400'   },
  jira:   { icon: LayoutGrid, color: 'text-blue-500'   },
  trello: { icon: LayoutGrid, color: 'text-blue-400'   },
};
const getRecursoIconCfg = (tipo: string) =>
  RECURSO_ICON_MAP[tipo?.toLowerCase()] ?? { icon: Link2, color: 'text-zinc-400' };

export const AprendizOverview = () => {
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date());
  }, []);

  const suggestion = useMemo(() => SUGGESTIONS[new Date().getDay() % SUGGESTIONS.length], []);

  // Reloj en tiempo real
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Proyecto del usuario ──────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  // ── Módulo activo ─────────────────────────────────────────────────────────
  const { data: activeSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });

  // ── Mis tickets asignados ─────────────────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['mis-tareas'],
    queryFn:  () => ticketService.getAll(),
    select: (data) => data.filter(t =>
      (t as any).asignado_a?.id === user?.id ||
      (t as any).asignado_a_id  === user?.id ||
      t.asignado_a              === user?.id
    ),
    staleTime: 30_000,
  });

  // ── Pool de tareas disponibles (to_do sin asignar) ────────────────────────
  const { data: poolTickets = [] } = useQuery<Ticket[]>({
    queryKey: ['pool-tasks', miProyecto?.id],
    queryFn:  () => ticketService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    select: (data) => data.filter(t => {
      const asignadoId = (t as any).asignado_a?.id ?? (t as any).asignado_a_id ?? t.asignado_a;
      return t.estado === 'to_do' && !asignadoId;
    }),
    staleTime: 20_000,
  });

  // ── Recursos del proyecto ─────────────────────────────────────────────────
  const { data: recursos = [] } = useQuery({
    queryKey: ['recursos', miProyecto?.id],
    queryFn:  () => recursoService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });
  const recursosArr   = recursos as any[];
  const githubRecurso = recursosArr.find((r: any) => r.tipo === 'github');

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const claimMut = useMutation({
    mutationFn: (id: number) => ticketService.claimTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-tareas'] });
      qc.invalidateQueries({ queryKey: ['pool-tasks'] });
    },
  });

  const markCompleteMut = useMutation({
    mutationFn: (id: number) => ticketService.markCompleteByAprendiz(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-tareas'] }),
  });

  const counts = {
    to_do:       tickets.filter(t => t.estado === 'to_do').length,
    in_progress: tickets.filter(t => t.estado === 'in_progress').length,
    testing:     tickets.filter(t => t.estado === 'testing').length,
    done:        tickets.filter(t => t.estado === 'done').length,
    bloqueadas:  tickets.filter(t => t.esta_bloqueado).length,
    listo:       tickets.filter(t => t.completado_por_aprendiz).length,
  };
  const total  = tickets.length;
  const avance = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden m-6 rounded-md p-8 text-white shadow-lg bg-gradient-to-br from-cyan-700 via-sky-800 to-sky-950">
        {/* SVG decorativo: línea de progreso ascendente con nodos */}
        <div className="absolute top-0 right-0 w-2/5 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Línea ascendente — representa el avance del aprendiz */}
            <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              d="M10,185 L45,145 L78,162 L110,108 L143,122 L168,72 L195,38" opacity="0.7"/>
            {/* Nodos en la línea */}
            <circle cx="45"  cy="145" r="5"  fill="currentColor" opacity="0.6"/>
            <circle cx="110" cy="108" r="7"  fill="currentColor" opacity="0.8"/>
            <circle cx="168" cy="72"  r="5"  fill="currentColor" opacity="0.6"/>
            <circle cx="195" cy="38"  r="9"  fill="currentColor" opacity="0.9"/>
            {/* Área bajo la curva */}
            <path fill="currentColor"
              d="M10,185 L45,145 L78,162 L110,108 L143,122 L168,72 L195,38 L195,200 L10,200 Z"
              opacity="0.06"/>
            {/* Sparkles decorativos */}
            <circle cx="25"  cy="60"  r="2" fill="currentColor" opacity="0.4"/>
            <circle cx="65"  cy="28"  r="3" fill="currentColor" opacity="0.5"/>
            <circle cx="130" cy="185" r="2" fill="currentColor" opacity="0.3"/>
            <circle cx="185" cy="155" r="2" fill="currentColor" opacity="0.35"/>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-sm font-medium opacity-80 flex items-center gap-2 capitalize">
                <CalendarIcon size={13} />
                {formattedDate}
              </p>
              <p className="text-sm font-black opacity-90 flex items-center gap-1.5 tabular-nums">
                <Clock size={13} />
                {time}
              </p>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {user?.nombre?.split(' ')[0]} {user?.nombre?.split(' ')[1] || ''}
            </h1>
            <p className="text-cyan-200 font-medium text-sm">
              {miProyecto
                ? `Proyecto activo: ${miProyecto.nombre}`
                : 'Sin proyecto asignado aún'}
            </p>

            <div className="flex items-start gap-2 mt-3 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 max-w-sm border border-white/10">
              <Lightbulb size={13} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/90 leading-relaxed">{suggestion}</p>
            </div>
          </div>

          {/* Badge de avance + tareas en progreso */}
          <div className="hidden sm:flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-5 py-3 rounded-md border border-white/20 min-w-[120px]">
              <span className="text-3xl font-black">{isLoading ? '—' : `${avance}%`}</span>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Mi avance</span>
            </div>
            {!isLoading && counts.in_progress > 0 && (
              <div className="flex items-center gap-1.5 bg-cyan-500/20 border border-cyan-400/30 rounded-md px-3 py-1.5">
                <Layers size={11} className="text-cyan-300" />
                <span className="text-xs font-bold text-cyan-200">
                  {counts.in_progress} en progreso
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Módulo activo ─────────────────────────────────────────────── */}
      {miProyecto && (
        <div className="mx-6">
          {activeSprint ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Módulo activo</p>
              <SprintContextBanner
                sprint={activeSprint}
                ticketsDone={counts.done}
                ticketsTotal={total}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40">
              <Clock size={14} className="text-zinc-600 shrink-0" />
              <div>
                <p className="text-[12px] font-black text-zinc-500">Sin módulo activo</p>
                <p className="text-[11px] text-zinc-700">El instructor activará un módulo cuando el equipo esté listo para trabajar.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recursos del proyecto ──────────────────────────────────────── */}
      {miProyecto && recursosArr.length > 0 && (
        <div className="mx-6 space-y-3">
          {/* Encabezado mini */}
          <div className="flex items-center gap-2">
            <Link2 size={11} className="text-zinc-500" />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Recursos del proyecto
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-500">
              {recursosArr.length}
            </span>
          </div>

          {/* Chip strip animado */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {recursosArr.map((r: any, i: number) => {
              const { icon: RIcon, color } = getRecursoIconCfg(r.tipo);
              return (
                <motion.a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.07, type: 'spring', stiffness: 340, damping: 22 }}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold rounded-xl border border-zinc-700/80 text-zinc-200 hover:border-cyan-500/40 hover:bg-zinc-700/60 bg-zinc-800/80 shadow-sm cursor-pointer select-none transition-colors"
                >
                  <RIcon size={15} className={color} />
                  <span>{r.nombre}</span>
                </motion.a>
              );
            })}
          </div>

          {/* GitHub widget */}
          {githubRecurso && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: recursosArr.length * 0.07 + 0.1, duration: 0.3 }}
            >
              <GitHubWidget
                recursoId={githubRecurso.id}
                proyectoId={miProyecto.id}
                canManage={false}
                defaultExpanded={false}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* ── Tarjetas de métricas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-6">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-md flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className={`text-2xl font-black ${color}`}>
              {isLoading ? '—' : counts[key as keyof typeof counts]}
            </p>
          </div>
        ))}
      </div>

      {/* ── Alerta: tareas listas para revisión ──────────────────────── */}
      {!isLoading && counts.listo > 0 && (
        <div className="mx-6 flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-md">
          <CheckCheck size={15} className="text-emerald-400 shrink-0" />
          <p className="text-sm font-medium text-emerald-400">
            Tienes <span className="font-black">{counts.listo}</span> tarea{counts.listo !== 1 ? 's' : ''} marcada{counts.listo !== 1 ? 's' : ''} como lista — esperando revisión de tu líder.
          </p>
        </div>
      )}

      {/* ── Alerta: tareas bloqueadas ─────────────────────────────────── */}
      {!isLoading && counts.bloqueadas > 0 && (
        <div className="mx-6 flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-md">
          <AlertTriangle size={15} className="text-rose-400 shrink-0" />
          <p className="text-sm font-medium text-rose-400">
            Tienes <span className="font-black">{counts.bloqueadas}</span> tarea{counts.bloqueadas !== 1 ? 's' : ''} bloqueada{counts.bloqueadas !== 1 ? 's' : ''} — comunícate con tu líder técnico.
          </p>
        </div>
      )}

      {/* ── Pool de tareas disponibles ───────────────────────────────── */}
      {poolTickets.length > 0 && (
        <div className="mx-6 bg-zinc-900 border border-cyan-500/20 rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-cyan-500/5">
            <div className="flex items-center gap-2">
              <Inbox size={14} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-zinc-200">Tareas disponibles para tomar</h3>
            </div>
            <span className="text-xs font-black px-2 py-0.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 rounded-full">
              {poolTickets.length} libre{poolTickets.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {poolTickets.slice(0, 4).map(t => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors group">
                <Zap size={13} className="text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">{t.titulo}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {t.proyecto && <span className="text-[10px] text-zinc-500">{t.proyecto.nombre}</span>}
                    <span className={`text-[9px] font-bold capitalize ${
                      t.prioridad === 'alta' ? 'text-rose-400' :
                      t.prioridad === 'media' ? 'text-amber-400' : 'text-blue-400'
                    }`}>{t.prioridad}</span>
                  </div>
                </div>
                <button
                  onClick={() => claimMut.mutate(t.id)}
                  disabled={claimMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/30 text-cyan-400 text-[11px] font-black rounded-md transition-all shrink-0 disabled:opacity-50"
                >
                  <Zap size={10} />
                  Tomar
                </button>
              </div>
            ))}
            {poolTickets.length > 4 && (
              <div className="px-5 py-2.5 text-center">
                <span className="text-[11px] text-zinc-500">
                  y {poolTickets.length - 4} más en la pestaña "Por tomar"
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Barra de avance ──────────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-zinc-200">Progreso general</span>
            <span className="text-sm font-black text-blue-400">{avance}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
              style={{ width: `${avance}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-500 flex-wrap">
            <span className="text-emerald-400 font-medium">{counts.done} completadas</span>
            <span>·</span>
            <span className="text-blue-400 font-medium">{counts.in_progress} en progreso</span>
            <span>·</span>
            <span>{counts.to_do} pendientes</span>
            <span>·</span>
            <span>{total} total</span>
          </div>
        </div>
      )}

      {/* ── Tareas recientes ─────────────────────────────────────────── */}
      {!isLoading && tickets.length > 0 && (
        <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} className="text-blue-400" />
              <h3 className="text-sm font-bold text-zinc-200">Últimas tareas</h3>
            </div>
            <span className="text-xs text-zinc-500">{tickets.length} asignada{tickets.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {tickets.slice(0, 5).map(t => {
              const Icon  = STATUS_ICON[t.estado] ?? Clock;
              const color = STATUS_COLOR[t.estado] ?? 'text-zinc-400';
              const isReady = t.completado_por_aprendiz === true;
              return (
                <div
                  key={t.id}
                  className={`px-5 py-3 flex items-center gap-3 transition-colors ${isReady ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-zinc-800/30'}`}
                >
                  {isReady
                    ? <CheckCheck size={13} className="text-emerald-400 shrink-0" />
                    : <Icon size={13} className={color} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isReady ? 'text-emerald-200' : 'text-zinc-200'}`}>
                      {t.titulo}
                    </p>
                    {t.proyecto && <p className="text-[10px] text-zinc-500 mt-0.5">{t.proyecto.nombre}</p>}
                  </div>
                  {isReady ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase tracking-widest shrink-0">
                      Listo ✓
                    </span>
                  ) : t.estado === 'in_progress' ? (
                    <button
                      onClick={() => markCompleteMut.mutate(t.id)}
                      disabled={markCompleteMut.isPending}
                      className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded uppercase shrink-0 transition-colors disabled:opacity-50"
                      title="Marcar como listo para revisión"
                    >
                      Marcar listo
                    </button>
                  ) : t.esta_bloqueado ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded uppercase tracking-widest shrink-0">
                      Bloqueada
                    </span>
                  ) : null}
                  <ChevronRight size={12} className="text-zinc-700 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!isLoading && tickets.length === 0 && poolTickets.length === 0 && (
        <div className="mx-6 flex flex-col items-center gap-3 py-16 text-center bg-zinc-900 border border-zinc-800 rounded-md">
          <div className="w-12 h-12 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-zinc-600" />
          </div>
          <p className="text-sm font-bold text-zinc-300">No tienes tareas asignadas aún</p>
          <p className="text-xs text-zinc-600 max-w-[260px]">
            Cuando tu líder técnico cree tareas, aparecerán en el pool para que las tomes,
            o te las asignará directamente.
          </p>
        </div>
      )}
    </div>
  );
};
