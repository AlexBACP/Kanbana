/**
 * LiderDashboard — Panel de control del Líder Técnico.
 *
 * Banner con fecha + sugerencias rotativas.
 * Stats del proyecto activo + progreso del módulo + resumen del equipo.
 */
import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon, CheckCircle2, Clock, Lightbulb,
  AlertTriangle, Layers, FolderKanban, ChevronRight, Users, BarChart3,
  Link2, Github, HardDrive, Figma, BookOpen, LayoutGrid, Ticket as TicketIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { projectService } from '../../services/project.service';
import { ticketService }  from '../../services/ticket.service';
import { recursoService } from '../../services/recurso.service';
import { GitHubWidget }   from '../../components/GitHubWidget';
import { MiContextoCard } from '../../components/MiContextoCard';

// ── Sugerencias del líder (cambia según el día) ──────────────────────────────
const SUGGESTIONS = [
  'Realiza el Daily Scrum con tu equipo para sincronizar avances y bloqueos.',
  'Revisa las tareas "En revisión" — el equipo puede necesitar tu retroalimentación.',
  'Asegúrate de que cada tarea tenga un responsable claro antes de iniciar el módulo.',
  'Una cola de trabajo bien priorizada acelera la planificación del próximo módulo.',
  '¡Felicita a tu equipo por las tareas completadas! La motivación importa.',
  'Identifica tareas bloqueadas y ayuda al equipo a desbloquearlas hoy.',
  'La comunicación constante con el instructor evita sorpresas en la revisión del módulo.',
];

const STAT_CONFIG = [
  { key: 'to_do',       label: 'Por hacer',   icon: Clock,         color: 'text-zinc-400',    bg: 'bg-zinc-800/60'    },
  { key: 'in_progress', label: 'En desarrollo', icon: Layers,        color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  { key: 'testing',     label: 'En revisión', icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  { key: 'done',        label: 'Completadas', icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
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
  figma:  { icon: Figma,      color: 'text-pink-400' },
  docs:   { icon: BookOpen,   color: 'text-emerald-400'},
  notion: { icon: BookOpen,   color: 'text-pink-400'   },
  jira:   { icon: LayoutGrid, color: 'text-blue-500'   },
  trello: { icon: LayoutGrid, color: 'text-blue-400'   },
};
const getRecursoIconCfg = (tipo: string) =>
  RECURSO_ICON_MAP[tipo?.toLowerCase()] ?? { icon: Link2, color: 'text-zinc-400' };

export const LiderDashboard = () => {
  const { user } = useAuthStore();

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date());
  }, []);

  const suggestion = useMemo(() => SUGGESTIONS[new Date().getDay() % SUGGESTIONS.length], []);

  // Reloj en tiempo real
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: activeSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn: () => projectService.getActiveSprint(miProyecto?.id),
    enabled: !!miProyecto?.id,
    staleTime: 60_000,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', miProyecto?.id, activeSprint?.id],
    queryFn: () => ticketService.getAll(miProyecto?.id, activeSprint?.id),
    enabled: !!miProyecto?.id,
    staleTime: 30_000,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(miProyecto?.id),
    enabled: !!miProyecto?.id,
    staleTime: 60_000,
  });

  const { data: recursos = [] } = useQuery({
    queryKey: ['recursos', miProyecto?.id],
    queryFn:  () => recursoService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });
  const recursosArr   = recursos as any[];
  const githubRecurso = recursosArr.find((r: any) => r.tipo === 'github');

  // ── Derivados ──────────────────────────────────────────────────────────────
  const t = tickets as any[];
  const counts = {
    to_do:       t.filter(x => x.estado === 'to_do').length,
    in_progress: t.filter(x => x.estado === 'in_progress').length,
    testing:     t.filter(x => x.estado === 'testing').length,
    done:        t.filter(x => x.estado === 'done').length,
  };
  const total  = t.length;
  const avance = total > 0 ? Math.round((counts.done / total) * 100) : 0;
  const equipo = (miembros as any[]).filter(m => m.rol === 'aprendiz').length;

  return (
    <div className="space-y-6">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden m-6 rounded-md p-8 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1a2234 0%, #243852 50%, #0f1825 100%)' }}>
        {/* SVG decorativo: columnas del tablero — identidad visual del líder técnico */}
        <div className="absolute top-0 right-0 w-2/5 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Headers de columnas */}
            <rect x="8"  y="18" width="48" height="13" rx="3" fill="currentColor" opacity="0.5"/>
            <rect x="76" y="18" width="48" height="13" rx="3" fill="currentColor" opacity="0.5"/>
            <rect x="144" y="18" width="48" height="13" rx="3" fill="currentColor" opacity="0.5"/>
            {/* Tarjetas columna 1 (Por hacer) */}
            <rect x="8"  y="38" width="48" height="30" rx="3" fill="currentColor" opacity="0.22"/>
            <rect x="8"  y="76" width="48" height="30" rx="3" fill="currentColor" opacity="0.18"/>
            <rect x="8"  y="114" width="48" height="22" rx="3" fill="currentColor" opacity="0.14"/>
            {/* Tarjetas columna 2 (En progreso) — más visibles, el foco */}
            <rect x="76" y="38" width="48" height="30" rx="3" fill="currentColor" opacity="0.38"/>
            <rect x="76" y="76" width="48" height="22" rx="3" fill="currentColor" opacity="0.28"/>
            {/* Tarjetas columna 3 (Completado) */}
            <rect x="144" y="38" width="48" height="30" rx="3" fill="currentColor" opacity="0.32"/>
            <rect x="144" y="76" width="48" height="30" rx="3" fill="currentColor" opacity="0.26"/>
            <rect x="144" y="114" width="48" height="22" rx="3" fill="currentColor" opacity="0.2"/>
            {/* Detalles en tarjeta activa */}
            <line x1="82" y1="48" x2="116" y2="48" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            <line x1="82" y1="55" x2="108" y2="55" stroke="currentColor" strokeWidth="1"   opacity="0.3"/>
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
            <p className="text-slate-200 font-medium text-sm">
              {miProyecto
                ? `Liderando: ${miProyecto.nombre}${activeSprint ? ` · ${activeSprint.nombre}` : ''}`
                : 'Sin proyecto asignado aún'}
            </p>

            {/* Sugerencia del día */}
            <div className="flex items-start gap-2 mt-3 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 max-w-sm border border-white/10">
              <Lightbulb size={13} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/90 leading-relaxed">{suggestion}</p>
            </div>
          </div>

          {/* Badge de progreso */}
          <div className="hidden sm:flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-5 py-3 rounded-md border border-white/20 min-w-[120px]">
              <span className="text-3xl font-black">{isLoading ? '—' : `${avance}%`}</span>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Progreso</span>
            </div>
            {!isLoading && counts.testing > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 rounded-md px-3 py-1.5">
                <AlertTriangle size={11} className="text-amber-300" />
                <span className="text-xs font-bold text-amber-200">
                  {counts.testing} en revisión
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mi contexto en el sistema (ficha, instructor, proyecto, módulo) */}
      <div className="mx-6">
        <MiContextoCard />
      </div>

      {/* ── Recursos del proyecto ──────────────────────────────────────────── */}
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
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold rounded-xl border border-zinc-700/80 text-zinc-200 hover:border-blue-500/40 hover:bg-zinc-700/60 bg-zinc-800/80 shadow-sm cursor-pointer select-none transition-colors"
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
                canManage={true}
                defaultExpanded={false}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* ── Tarjetas de estado ──────────────────────────────────────────────── */}
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

      {/* ── Progreso del módulo + Card del equipo ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mx-6">

        {/* Barra de progreso */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-400" />
              <span className="text-sm font-bold text-zinc-200">
                {activeSprint ? `Progreso: ${activeSprint.nombre}` : 'Progreso del proyecto'}
              </span>
            </div>
            <span className="text-sm font-black text-blue-400">{isLoading ? '—' : `${avance}%`}</span>
          </div>
          {total > 0 ? (
            <>
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
                <span className="text-amber-400 font-medium">{counts.testing} en revisión</span>
                <span>·</span>
                <span>{counts.to_do} pendientes</span>
                <span>·</span>
                <span className="text-zinc-400">{total} total</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-600 mt-2">
              {isLoading ? 'Cargando...' : activeSprint ? 'Sin tareas en el módulo activo.' : 'No hay módulo activo.'}
            </p>
          )}
        </div>

        {/* Card del equipo */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-blue-400" />
            <span className="text-sm font-bold text-zinc-200">Mi Equipo</span>
          </div>
          {miProyecto ? (
            <>
              <p className="text-3xl font-black text-zinc-100">{equipo}</p>
              <p className="text-xs text-zinc-500 mt-1">
                aprendiz{equipo !== 1 ? 'es' : ''} asignado{equipo !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5 truncate" title={miProyecto.nombre}>
                {miProyecto.nombre}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-600">Sin proyecto asignado</p>
          )}
        </div>
      </div>

      {/* ── Últimas tareas del módulo activo ───────────────────────────────── */}
      {!isLoading && t.length > 0 && (
        <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} className="text-blue-400" />
              <h3 className="text-sm font-bold text-zinc-200">Últimas tareas</h3>
            </div>
            <span className="text-xs text-zinc-500">{total} en el módulo activo</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {t.slice(0, 6).map((ticket: any) => {
              const Icon  = STATUS_ICON[ticket.estado]  ?? Clock;
              const color = STATUS_COLOR[ticket.estado] ?? 'text-zinc-400';
              return (
                <div key={ticket.id} className="px-5 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors">
                  <Icon size={13} className={color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium truncate">{ticket.titulo}</p>
                    {ticket.asignado_a?.nombre && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">{ticket.asignado_a.nombre}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${
                    ticket.prioridad === 'alta' ? 'text-rose-400' :
                    ticket.prioridad === 'baja' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {ticket.prioridad}
                  </span>
                  <ChevronRight size={12} className="text-zinc-700 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty: sin proyecto ────────────────────────────────────────────── */}
      {!isLoading && !miProyecto && (
        <div className="mx-6 flex flex-col items-center gap-3 py-16 text-center bg-zinc-900 border border-zinc-800 rounded-md">
          <div className="w-12 h-12 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <FolderKanban size={22} className="text-zinc-600" />
          </div>
          <p className="text-sm font-bold text-zinc-300">No tienes un proyecto asignado</p>
          <p className="text-xs text-zinc-600 max-w-[260px]">
            Un instructor o coordinador debe asignarte como líder técnico de un proyecto.
          </p>
        </div>
      )}
    </div>
  );
};
