import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { projectService } from '../../services/project.service';
import { fichaService } from '../../services/ficha.service';
import { ticketService } from '../../services/ticket.service';
import {
  FolderKanban, GraduationCap, Clock, CheckCircle2, ArrowRight,
  Calendar as CalendarIcon, Lightbulb, Layers, AlertTriangle, BarChart3,
  PackageCheck, MessageSquareWarning, Loader2,
} from 'lucide-react';

// ── Sugerencias específicas para instructor ──────────────────────────────────
const SUGGESTIONS = [
  'Revisa el avance del módulo activo en cada ficha — los cierres de sprint se acercan.',
  'Una retroalimentación clara esta semana evita desvíos en la entrega del proyecto formativo.',
  'Valida que todos los sprints activos tienen tareas asignadas y líderes técnicos definidos.',
  'Compara el progreso entre tus fichas — si alguna va lenta, puede necesitar atención urgente.',
  'Antes de la revisión de módulo, confirma que las evidencias estén cargadas por los aprendices.',
  'El líder técnico necesita tus directrices claras sobre los entregables del próximo trimestre.',
  'Identifica proyectos en pausa y evalúa si el equipo está disponible para reactivarlos hoy.',
];

const STAT_CONFIG = [
  { key: 'activos',     label: 'Proyectos activos',  icon: FolderKanban,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'en_progreso', label: 'Tareas en progreso', icon: Layers,        color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  { key: 'completadas', label: 'Completadas',         icon: CheckCircle2,  color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  { key: 'bloqueadas',  label: 'Bloqueadas',          icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10'    },
] as const;

interface Props {
  onNavigate: (section: any) => void;
}

export const InstructorOverview = ({ onNavigate }: Props) => {
  const { user } = useAuthStore();

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

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });

  const { data: fichas = [] } = useQuery({
    queryKey: ['fichas'],
    queryFn: fichaService.getAll,
    staleTime: 60_000,
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', 'instructor-all'],
    queryFn: () => ticketService.getAll(),
    staleTime: 30_000,
  });

  const { data: pendingReview = [] } = useQuery({
    queryKey: ['sprints', 'pending-review'],
    queryFn: projectService.getSprintsPendientesRevision,
    staleTime: 30_000,
  });

  const qc = useQueryClient();

  const correccionesMut = useMutation({
    mutationFn: ({ sprintId, mensaje }: { sprintId: number; mensaje: string }) =>
      projectService.solicitarCorrecciones(sprintId, mensaje),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', 'pending-review'] });
      setCorreccionMsg('');
      setCorreccionSprintId(null);
    },
  });

  const closeMut = useMutation({
    mutationFn: (sprintId: number) => projectService.closeSprint(sprintId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', 'pending-review'] }),
  });

  const [correccionSprintId, setCorreccionSprintId] = useState<number | null>(null);
  const [correccionMsg, setCorreccionMsg] = useState('');

  const isLoading = loadingProyectos || loadingTickets;

  // ── Derivados ──────────────────────────────────────────────────────────────
  const p = proyectos as any[];
  const f = fichas as any[];

  // Filtrar tickets solo de los proyectos del instructor (el endpoint devuelve todos)
  const misProyectoIds = new Set(p.map((pr: any) => pr.id));
  const t = (tickets as any[]).filter(
    (tk: any) => misProyectoIds.has(tk.proyecto_id) || misProyectoIds.has(tk.proyecto?.id)
  );

  // Fichas donde el instructor tiene proyectos
  const misFichaIds = [...new Set(p.map((pr: any) => pr.fichaId).filter(Boolean))];
  const misFichas   = f.filter((fi: any) => misFichaIds.includes(fi.id));

  const activos     = p.filter((pr: any) => pr.estado === 'activo').length;
  const pausados    = p.filter((pr: any) => pr.estado === 'pausado').length;

  // Métricas de tickets
  const en_progreso = t.filter((x: any) => x.estado === 'in_progress').length;
  const completadas = t.filter((x: any) => x.estado === 'done').length;
  const bloqueadas  = t.filter((x: any) => x.esta_bloqueado).length;
  const total_t     = t.length;
  const avancePct   = total_t > 0 ? Math.round((completadas / total_t) * 100) : 0;

  const counts = { activos, en_progreso, completadas, bloqueadas };

  return (
    <div className="space-y-6">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden m-6 rounded-md p-8 text-white shadow-lg bg-gradient-to-br from-violet-700 via-purple-800 to-purple-950">
        {/* SVG decorativo: líneas onduladas académicas */}
        <div className="absolute top-0 right-0 w-2/5 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Ondas que representan el flujo del conocimiento */}
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M0,55 Q50,35 100,55 Q150,75 200,55" opacity="0.6"/>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M0,85 Q50,65 100,85 Q150,105 200,85" opacity="0.5"/>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M0,115 Q50,95 100,115 Q150,135 200,115" opacity="0.4"/>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M0,145 Q50,125 100,145 Q150,165 200,145" opacity="0.3"/>
            {/* Silueta de libro */}
            <rect x="62" y="18" width="68" height="88" rx="4"
              fill="none" stroke="currentColor" strokeWidth="2" opacity="0.45"/>
            <line x1="96" y1="18" x2="96" y2="106"
              stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
            {/* Líneas de texto en el libro */}
            <line x1="70" y1="34" x2="92" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
            <line x1="70" y1="42" x2="92" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
            <line x1="70" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
            <line x1="100" y1="34" x2="122" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
            <line x1="100" y1="42" x2="122" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
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
            <p className="text-violet-200 font-medium text-sm">
              {misFichas.length > 0
                ? `Supervisando ${misFichas.length} ficha${misFichas.length !== 1 ? 's' : ''} · ${activos} proyecto${activos !== 1 ? 's' : ''} activo${activos !== 1 ? 's' : ''}`
                : 'Estado de tus fichas y proyectos formativos'}
            </p>

            <div className="flex items-start gap-2 mt-3 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 max-w-sm border border-white/10">
              <Lightbulb size={13} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/90 leading-relaxed">{suggestion}</p>
            </div>
          </div>

          {/* Badge resumen */}
          <div className="hidden sm:flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-5 py-3 rounded-md border border-white/20 min-w-[120px]">
              <span className="text-3xl font-black">{isLoading ? '—' : `${avancePct}%`}</span>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Completadas</span>
            </div>
            {!isLoading && en_progreso > 0 && (
              <div className="flex items-center gap-1.5 bg-violet-500/20 border border-violet-400/30 rounded-md px-3 py-1.5">
                <Layers size={11} className="text-violet-300" />
                <span className="text-xs font-bold text-violet-200">
                  {en_progreso} en progreso
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tarjetas de métricas ────────────────────────────────────────────── */}
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

      {/* ── Barra de progreso global ────────────────────────────────────────── */}
      {!isLoading && total_t > 0 && (
        <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-violet-400" />
              <span className="text-sm font-bold text-zinc-200">Progreso general de tareas</span>
            </div>
            <span className="text-sm font-black text-violet-400">{avancePct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-700"
              style={{ width: `${avancePct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-500 flex-wrap">
            <span className="text-violet-400 font-medium">{completadas} completadas</span>
            <span>·</span>
            <span className="text-blue-400 font-medium">{en_progreso} en progreso</span>
            <span>·</span>
            {bloqueadas > 0 && (
              <>
                <span className="text-rose-400 font-medium">{bloqueadas} bloqueadas</span>
                <span>·</span>
              </>
            )}
            <span className="text-zinc-400">{total_t} total</span>
          </div>
        </div>
      )}

      {/* ── Alerta: tareas bloqueadas ───────────────────────────────────────── */}
      {!isLoading && bloqueadas > 0 && (
        <div className="mx-6 flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-md">
          <AlertTriangle size={15} className="text-rose-400 shrink-0" />
          <p className="text-sm font-medium text-rose-400">
            Hay <span className="font-black">{bloqueadas}</span> tarea{bloqueadas !== 1 ? 's' : ''} bloqueada{bloqueadas !== 1 ? 's' : ''} en tus proyectos — revisa con los líderes técnicos.
          </p>
        </div>
      )}

      {/* ── Mis fichas ──────────────────────────────────────────────────────── */}
      <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <GraduationCap size={14} className="text-violet-400" />
            <h3 className="text-sm font-bold text-zinc-200">Mis fichas</h3>
          </div>
          <button
            onClick={() => onNavigate('fichas')}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
          >
            Ver todas <ArrowRight size={11} />
          </button>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="px-5 py-3 animate-pulse flex gap-3">
                <div className="h-3 bg-zinc-800 rounded w-1/3" />
                <div className="h-3 bg-zinc-800 rounded w-1/4 ml-auto" />
              </div>
            ))
          ) : misFichas.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-600 text-center">Sin fichas asignadas</p>
          ) : misFichas.map((fi: any) => {
            const proyFicha  = p.filter((pr: any) => pr.fichaId === fi.id);
            const activosFi  = proyFicha.filter((pr: any) => pr.estado === 'activo').length;
            // Calcular avance de tickets de esta ficha
            const ticketsFicha   = t.filter((tk: any) => proyFicha.some((pr: any) => pr.id === tk.proyecto_id || pr.id === tk.proyecto?.id));
            const donesFicha     = ticketsFicha.filter((tk: any) => tk.estado === 'done').length;
            const avanceFicha    = ticketsFicha.length > 0 ? Math.round((donesFicha / ticketsFicha.length) * 100) : 0;
            return (
              <div key={fi.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{fi.programa}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Ficha {fi.codigo} · {proyFicha.length} proyecto{proyFicha.length !== 1 ? 's' : ''}
                    {ticketsFicha.length > 0 && ` · ${avanceFicha}% completado`}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ml-3 shrink-0 ${
                  activosFi > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>
                  {activosFi} activo{activosFi !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Proyectos recientes ─────────────────────────────────────────────── */}
      <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FolderKanban size={14} className="text-violet-400" />
            <h3 className="text-sm font-bold text-zinc-200">Proyectos recientes</h3>
          </div>
          <button
            onClick={() => onNavigate('projects')}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight size={11} />
          </button>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {p.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-600 text-center">Sin proyectos asignados</p>
          ) : p.slice(0, 5).map((pr: any) => {
            // Progreso por proyecto
            const ticketsPr  = t.filter((tk: any) => tk.proyecto_id === pr.id || tk.proyecto?.id === pr.id);
            const donesPr    = ticketsPr.filter((tk: any) => tk.estado === 'done').length;
            const avancePr   = ticketsPr.length > 0 ? Math.round((donesPr / ticketsPr.length) * 100) : 0;
            return (
              <div key={pr.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                <div className="w-7 h-7 bg-violet-500/10 rounded-md flex items-center justify-center shrink-0">
                  <FolderKanban size={13} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{pr.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-500">{pr.ficha?.codigo ?? 'Sin ficha'}</p>
                    {ticketsPr.length > 0 && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="h-1 bg-zinc-800 rounded-full flex-1 overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full transition-all duration-500"
                              style={{ width: `${avancePr}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500 shrink-0">{avancePr}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                  pr.estado === 'activo'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : pr.estado === 'pausado'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>
                  {pr.estado === 'activo' ? 'Activo' : pr.estado === 'pausado' ? 'En pausa' : 'Finalizado'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Módulos pendientes de revisión ──────────────────────────────────── */}
      {(pendingReview as any[]).length > 0 && (
        <div className="mx-6 bg-zinc-900 border border-violet-500/30 rounded-md overflow-hidden shadow-md shadow-violet-900/20">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800 bg-violet-500/5">
            <PackageCheck size={14} className="text-violet-400" />
            <h3 className="text-sm font-bold text-zinc-200">
              Módulos pendientes de revisión
            </h3>
            <span className="ml-auto bg-violet-500/20 text-violet-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-violet-500/30">
              {(pendingReview as any[]).length}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {(pendingReview as any[]).map((sprint: any) => (
              <div key={sprint.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[13px] font-bold text-zinc-200">{sprint.nombre}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {sprint.proyecto?.nombre} · {sprint.tickets?.length ?? 0} tarea{sprint.tickets?.length !== 1 ? 's' : ''}
                      {sprint.proyecto?.lider && ` · Líder: ${sprint.proyecto.lider.nombre}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-full uppercase tracking-widest shrink-0">
                    Esperando revisión
                  </span>
                </div>

                {/* Botón solicitar correcciones (toggle form) */}
                {correccionSprintId === sprint.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={correccionMsg}
                      onChange={e => setCorreccionMsg(e.target.value)}
                      placeholder="Describe qué debe corregir el líder…"
                      rows={2}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-200 resize-none outline-none focus:border-amber-500/50 placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => correccionesMut.mutate({ sprintId: sprint.id, mensaje: correccionMsg })}
                        disabled={!correccionMsg.trim() || correccionesMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all"
                      >
                        {correccionesMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <MessageSquareWarning size={11} />}
                        Enviar correcciones
                      </button>
                      <button
                        onClick={() => { setCorreccionSprintId(null); setCorreccionMsg(''); }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[11px] font-bold rounded-lg transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => closeMut.mutate(sprint.id)}
                      disabled={closeMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md shadow-emerald-900/30"
                    >
                      {closeMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Aprobar y cerrar módulo
                    </button>
                    <button
                      onClick={() => setCorreccionSprintId(sprint.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-400 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all"
                    >
                      <MessageSquareWarning size={11} />
                      Solicitar correcciones
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!isLoading && p.length === 0 && (
        <div className="mx-6 flex flex-col items-center gap-3 py-16 text-center bg-zinc-900 border border-zinc-800 rounded-md">
          <div className="w-12 h-12 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <FolderKanban size={22} className="text-zinc-600" />
          </div>
          <p className="text-sm font-bold text-zinc-300">Sin proyectos asignados aún</p>
          <p className="text-xs text-zinc-600 max-w-[260px]">
            Los proyectos de tus fichas aparecerán aquí una vez que el coordinador los cree.
          </p>
        </div>
      )}
    </div>
  );
};
