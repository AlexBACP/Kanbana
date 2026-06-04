/**
 * BacklogPage — Cola de trabajo + gestión de módulos
 *
 * Ruta: /projects/:id/backlog?trimestreId=X
 *
 * 3 tabs inline:
 *   1. Cola de trabajo — módulos (izq) + tareas sin módulo (der), filtrados por trimestre
 *   2. Nuevo módulo   — (coordinador/instructor) formulario crear módulo
 *      Solicitar módulo — (líder técnico) formulario solicitar → instructor aprueba
 *   3. Nueva tarea    — formulario crear tarea
 *
 * Módulos ordenados ascendente por fecha_inicio (orden lógico del proyecto).
 * Búsqueda en tab Cola de trabajo: busca en tareas Y módulos del trimestre.
 */
import { useState, useEffect }               from 'react';
import { useParams, useNavigate, Link,
         useSearchParams }                    from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Search, Play,
  Calendar, Flag, Layers, AlertCircle,
  BookMarked, CheckCircle2, Send, Loader2,
  GripVertical, Lock, Clock,
} from 'lucide-react';
import { DateTimeInput }       from '../components/DateTimeInput';
import { SugerenciasCompactas } from '../components/SugerenciasCompactas';
import { projectService }  from '../services/project.service';
import { ticketService }   from '../services/ticket.service';
import { userService }     from '../services/user.service';
import { useForm }         from 'react-hook-form';
import { CreateTicketDto, CreateSprintDto } from '../types/ticket.types';
import { Trimestre }       from '../types/trimestre.types';
import { useAuthStore }    from '../store/auth.store';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TabId = 'backlog' | 'modulo' | 'tarea';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inCls = 'w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2.5 text-[13px] text-zinc-100 outline-none hover:bg-zinc-900 focus:bg-zinc-900 focus:border-blue-500 transition-colors placeholder-zinc-600';

const FormField = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.15em]">{label}</label>
    {children}
    {error && <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1"><AlertCircle size={9} />{error}</p>}
  </div>
);

const PRIORITY_COLORS: Record<string, string> = {
  alta:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  baja:  'bg-zinc-700/30 text-zinc-500 border-zinc-700/50',
};

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
export const BacklogPage = () => {
  const navigate          = useNavigate();
  const { id }            = useParams<{ id: string }>();
  const [searchParams]    = useSearchParams();
  const projectId         = Number(id);
  const qc                = useQueryClient();
  const { user }          = useAuthStore();

  const isAdmin  = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLider  = user?.rol === 'aprendiz' && (user as any).es_lider_tecnico;

  // Tab activo
  const [activeTab,     setActiveTab]     = useState<TabId>('backlog');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [activeTrimId,  setActiveTrimId]  = useState<number | null>(null);
  const [solicitarOk,      setSolicitarOk]      = useState(false);
  const [solicitarLoad,    setSolicitarLoad]    = useState(false);
  const [solicitarForm,    setSolicitarForm]    = useState({ nombre: '', justificacion: '', fecha_inicio: '', fecha_fin: '' });
  const [trimError,        setTrimError]        = useState('');
  // Sprint seleccionado en el form de nueva tarea (para constraints de fecha dinámicos)
  const [taskSprintId,     setTaskSprintId]     = useState<number | ''>('');

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn:  () => projectService.getById(projectId),
    enabled:  !!projectId,
  });

  const { data: backlogTickets = [], isLoading: loadingBacklog } = useQuery({
    queryKey: ['tickets', projectId, 'backlog'],
    queryFn:  () => ticketService.getAll(projectId, undefined, true),
    enabled:  !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn:  () => projectService.getSprints(projectId),
    enabled:  !!projectId,
  });

  const { data: trimestresData = [] } = useQuery<Trimestre[]>({
    queryKey: ['trimestres', projectId],
    queryFn:  () => projectService.getTrimestres(projectId),
    enabled:  !!projectId,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['users', 'by-proyecto', projectId],
    queryFn:  () => userService.getByProyecto(projectId),
    enabled:  !!projectId,
    staleTime: 120_000,
  });

  const trimestresArr = trimestresData as Trimestre[];
  const sprintsAll   = sprints as any[];

  // ── Auto-selección de trimestre ───────────────────────────────────────────
  // Prioridad: 1) query param, 2) trimestre del sprint activo, 3) primer no finalizado
  useEffect(() => {
    if (trimestresArr.length === 0) return;

    // Si viene de URL param
    const paramTrimId = searchParams.get('trimestreId');
    if (paramTrimId) {
      const found = trimestresArr.find(t => t.id === Number(paramTrimId));
      if (found) { setActiveTrimId(found.id); return; }
    }

    // Sprint activo → su trimestre
    const activeSprint = sprintsAll.find(s => s.esta_activo);
    if (activeSprint?.trimestre_id) {
      setActiveTrimId(activeSprint.trimestre_id);
      return;
    }

    // Primer trimestre no finalizado
    const noFinalizado = trimestresArr.find(t => !t.esta_finalizado);
    if (noFinalizado) { setActiveTrimId(noFinalizado.id); return; }

    // Último como fallback
    setActiveTrimId(trimestresArr[trimestresArr.length - 1]?.id ?? null);
  }, [trimestresArr.length, sprintsAll.length]); // eslint-disable-line

  // ── Sprints filtrados y ordenados ─────────────────────────────────────────
  // Filtrar por trimestre seleccionado, ordenar ascendente por fecha_inicio
  const sprintsDelTrimestre = sprintsAll
    .filter(s => activeTrimId ? s.trimestre_id === activeTrimId : true)
    .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  // Cola de trabajo (tareas sin módulo), acotada al trimestre activo:
  //  - pertenecen a este trimestre (trimestre_id === activeTrimId)
  //  - NO están finalizadas (estado !== 'done')
  //  - coinciden con la búsqueda
  const backlogBase    = backlogTickets as any[];
  const backlogDelTrimestre = backlogBase.filter(t =>
    (activeTrimId ? t.trimestre_id === activeTrimId : true) &&
    t.estado !== 'done'
  );
  const filteredBacklog = backlogDelTrimestre.filter(t =>
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Módulos que coinciden con la búsqueda (para búsqueda cruzada)
  const filteredSprints = sprintsDelTrimestre.filter(s =>
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );
  // Cuando hay búsqueda: también mostrar módulos que la contienen
  const sprintsToShow = searchTerm
    ? sprintsDelTrimestre.filter(s =>
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.tickets ?? []).some((t: any) => t.titulo.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : sprintsDelTrimestre;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createTicketMut = useMutation({
    mutationFn: (data: any) => ticketService.create({
      ...data,
      proyecto_id:  projectId,
      story_points: Number(data.story_points) || 0,
      sprint_id:    data.sprint_id ? Number(data.sprint_id) : undefined,
      trimestre_id: activeTrimId ?? undefined,
      asignado_a:   data.asignado_a ? Number(data.asignado_a) : undefined,
    }),
    onSuccess: () => {
      // Invalidar backlog Y sprints: si la tarea fue asignada a un sprint,
      // desaparece del backlog y aparece en el módulo correcto.
      qc.invalidateQueries({ queryKey: ['tickets', projectId, 'backlog'] });
      qc.invalidateQueries({ queryKey: ['tickets', projectId] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      resetTicket();
      setActiveTab('backlog');
    },
  });

  const createSprintMut = useMutation({
    mutationFn: (data: any) => projectService.createSprint(projectId, {
      ...data,
      trimestre_id: activeTrimId ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      qc.invalidateQueries({ queryKey: ['trimestres', projectId] });
      resetSprint();
      setActiveTab('backlog');
    },
  });

  const moveTaskMut = useMutation({
    mutationFn: ({ ticketId, sprint_id }: { ticketId: number; sprint_id: number | null }) =>
      ticketService.moveTask(ticketId, sprint_id),
    onSuccess: () => {
      // Invalidar explícitamente el backlog Y los sprints para que la UI refleje
      // el nuevo estado inmediatamente — sin esto la tarea queda visible en ambos lados.
      qc.invalidateQueries({ queryKey: ['tickets', projectId, 'backlog'] });
      qc.invalidateQueries({ queryKey: ['tickets', projectId] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    },
  });

  const startSprintMut = useMutation({
    mutationFn: (sprintId: number) => projectService.startSprint(sprintId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] }),
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
  const {
    register: regTicket,
    handleSubmit: handleTicketSubmit,
    reset: resetTicket,
    formState: { errors: ticketErrors },
  } = useForm<CreateTicketDto>();

  const {
    register: regSprint,
    handleSubmit: handleSprintSubmit,
    reset: resetSprint,
    setValue: setSprintValue,
    formState: { errors: sprintErrors },
  } = useForm<CreateSprintDto>();

  // Auto-rellena nombre y fechas al seleccionar trimestre (ya está seleccionado)
  useEffect(() => {
    if (!activeTrimId) return;
    const trim = trimestresArr.find(t => t.id === activeTrimId);
    if (!trim) return;
    const count = sprintsDelTrimestre.length;
    setSprintValue('nombre', `T${trim.numero} MOD-${count + 1}`);
    if (trim.fecha_inicio) setSprintValue('fecha_inicio', String(trim.fecha_inicio).slice(0, 10));
    if (trim.fecha_fin)    setSprintValue('fecha_fin',    String(trim.fecha_fin).slice(0, 10));
  }, [activeTrimId, activeTab]); // eslint-disable-line

  const onSprintSubmit = handleSprintSubmit(data => {
    if (!activeTrimId) { setTrimError('Selecciona un trimestre primero'); return; }
    setTrimError('');
    createSprintMut.mutate(data);
  });

  const handleSolicitar = async () => {
    if (!solicitarForm.nombre.trim()) return;
    setSolicitarLoad(true);
    try {
      await projectService.solicitarSprint(projectId, {
        nombre:        solicitarForm.nombre,
        justificacion: solicitarForm.justificacion || undefined,
        fecha_inicio:  solicitarForm.fecha_inicio  || undefined,
        fecha_fin:     solicitarForm.fecha_fin      || undefined,
      });
      setSolicitarOk(true);
      setTimeout(() => {
        setSolicitarOk(false);
        setSolicitarForm({ nombre: '', justificacion: '', fecha_inicio: '', fecha_fin: '' });
        setActiveTab('backlog');
      }, 2500);
    } catch { /* no op */ }
    finally { setSolicitarLoad(false); }
  };

  // ── Tab label del segundo tab según rol ───────────────────────────────────
  const tab2Label = isAdmin ? 'Nuevo módulo' : 'Solicitar módulo';
  const trimActual = trimestresArr.find(t => t.id === activeTrimId);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950">

      {/* ── CABECERA — mismo patrón que ProyectoDetalle en FichasPanel ────── */}
      <div className="bg-zinc-900 border-b border-zinc-800 shrink-0">

        {/* Back + info principal */}
        <div className="px-6 pt-5 pb-4">

          {/* Volver */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-black uppercase tracking-widest mb-4"
          >
            <ChevronLeft size={13} /> Volver
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Izquierda: badges + título + contexto */}
            <div className="flex-1 min-w-0">
              {/* Chips de contexto */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-600/10 border border-blue-500/20 rounded-lg">
                  <Layers size={12} className="text-blue-400" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Cola de trabajo</span>
                </div>
                {trimActual && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
                    <Calendar size={10} className="text-zinc-500" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      {(trimActual as any).nombre ?? `T${(trimActual as any).numero}`}
                    </span>
                    {sprintsDelTrimestre.some((s: any) => s.esta_activo) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </div>
                )}
              </div>

              {/* Título: nombre del proyecto */}
              <h2 className="text-[22px] font-black text-white tracking-tight leading-tight truncate">
                {(project as any)?.nombre ?? '—'}
              </h2>

              {/* Ficha */}
              {(project as any)?.ficha && (
                <p className="text-[12px] text-zinc-400 mt-1">
                  {(project as any).ficha.programa ?? (project as any).ficha.codigo}
                  {(project as any).ficha.codigo && (
                    <span className="ml-2 text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                      · {(project as any).ficha.codigo}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Derecha: pills de stats — mismo estilo que FichasPanel */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {[
                {
                  label: 'Módulos',
                  value: sprintsDelTrimestre.length,
                  color: 'text-blue-400',
                },
                {
                  label: 'Sin módulo',
                  value: backlogDelTrimestre.length,
                  color: 'text-zinc-300',
                },
                {
                  label: 'Activos',
                  value: sprintsDelTrimestre.filter((s: any) => s.esta_activo).length,
                  color: 'text-emerald-400',
                },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-md min-w-[56px]">
                  <span className={`text-[18px] font-black ${s.color}`}>{s.value}</span>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar — mismo patrón PTab de FichasPanel */}
        <div className="flex items-center gap-1 px-4 border-t border-zinc-800/60 overflow-x-auto">
          {([
            { id: 'backlog', icon: Layers,    label: 'Cola de trabajo' },
            { id: 'modulo',  icon: isAdmin ? BookMarked : Send, label: tab2Label },
            { id: 'tarea',   icon: Plus,      label: 'Nueva tarea'    },
          ] as { id: TabId; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-black border-b-2 transition-all duration-200 whitespace-nowrap ${
                activeTab === id
                  ? 'text-white border-white'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB: COLA DE TRABAJO ════════════════════════════════════════════ */}
      {activeTab === 'backlog' && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Barra de búsqueda */}
          <div className="shrink-0 px-6 py-3 border-b border-zinc-800/60 bg-zinc-950">
            <div className="relative max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar tareas o módulos…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 w-full bg-zinc-900 border border-zinc-800 rounded-md text-[13px] text-zinc-300 outline-none focus:border-blue-500/50 placeholder:text-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Layout dos columnas (apiladas en móvil) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

            {/* ─── MÓDULOS (izquierda) ─────────────────────────────────────── */}
            <div className="w-full md:w-[54%] md:border-r border-b md:border-b-0 border-zinc-800 flex flex-col overflow-hidden md:overflow-hidden max-h-[60vh] md:max-h-none">
              <div className="shrink-0 px-5 py-2.5 border-b border-zinc-800/60 flex items-center gap-2">
                <BookMarked size={11} className="text-zinc-500" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">Módulos</p>
                <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                  {sprintsToShow.length}
                </span>
                {trimActual && (
                  <span className="ml-auto text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    {trimActual.nombre ?? `T${trimActual.numero}`}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sprintsToShow.length === 0 ? (
                  <div className="py-14 text-center">
                    <BookMarked size={24} className="mx-auto text-zinc-700 mb-3" />
                    <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest">
                      {searchTerm ? 'Sin módulos que coincidan' : 'Sin módulos en este trimestre'}
                    </p>
                    {!searchTerm && (isAdmin || isLider) && (
                      <button
                        onClick={() => setActiveTab('modulo')}
                        className="mt-3 text-[11px] text-blue-400 font-black hover:text-blue-300 transition-colors"
                      >
                        + {tab2Label}
                      </button>
                    )}
                  </div>
                ) : (
                  sprintsToShow.map((sprint: any) => {
                    const isActivo     = sprint.esta_activo && !sprint.esta_finalizado;
                    const isFinalizado = sprint.esta_finalizado;

                    // Tareas del sprint: excluir finalizadas + filtro de búsqueda
                    const sprintTickets = (sprint.tickets ?? []).filter((t: any) =>
                      t.estado !== 'done' &&
                      (searchTerm ? t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) : true)
                    );

                    return (
                      <div key={sprint.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                        {/* Cabecera del módulo */}
                        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800/60 ${
                          isActivo ? 'bg-emerald-500/5' : isFinalizado ? 'bg-zinc-800/20' : 'bg-amber-500/3'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center border shrink-0 ${
                              isActivo     ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              isFinalizado ? 'bg-zinc-700/30 text-zinc-500 border-zinc-700/50' :
                                             'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {isActivo     ? <Play size={11} fill="currentColor" /> :
                               isFinalizado ? <Lock size={10} /> :
                                              <Clock size={10} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-[13px] text-white truncate">{sprint.nombre}</h3>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest shrink-0 ${
                                  isActivo     ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  isFinalizado ? 'bg-zinc-700/30 text-zinc-500 border-zinc-700/50' :
                                                 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {isActivo ? 'Activo' : isFinalizado ? 'Finalizado' : 'Planificado'}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-600 font-bold mt-0.5">
                                {fmtDate(String(sprint.fecha_inicio))} → {fmtDate(String(sprint.fecha_fin))}
                                {' · '}<span className="text-zinc-700">{(sprint.tickets ?? []).length} tarea{(sprint.tickets ?? []).length !== 1 ? 's' : ''}</span>
                              </p>
                            </div>
                          </div>

                          {/* Acciones del módulo */}
                          {!isFinalizado && isAdmin && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isActivo && (
                                <button
                                  onClick={() => startSprintMut.mutate(sprint.id)}
                                  disabled={startSprintMut.isPending}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 rounded-md text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                                >
                                  <Play size={10} fill="currentColor" /> Activar
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Tareas del módulo */}
                        <div className="p-2.5 space-y-1.5">
                          {sprintTickets.length > 0 ? sprintTickets.map((ticket: any) => (
                            <div
                              key={ticket.id}
                              className="flex items-center gap-2.5 px-3 py-2 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-700 rounded-md transition-all group"
                            >
                              <GripVertical size={12} className="text-zinc-700 cursor-grab shrink-0" />
                              <div className="flex-1 min-w-0">
                                <Link
                                  to={`/tickets/${ticket.id}`}
                                  className="text-[12px] font-bold text-zinc-200 hover:text-blue-400 truncate transition-colors block"
                                >
                                  {ticket.titulo}
                                </Link>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {ticket.esta_bloqueado && (
                                  <div className="p-1 bg-rose-500/10 rounded border border-rose-500/20 text-rose-400">
                                    <Flag size={9} fill="currentColor" />
                                  </div>
                                )}
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${PRIORITY_COLORS[ticket.prioridad] ?? PRIORITY_COLORS.baja}`}>
                                  {ticket.prioridad}
                                </span>
                                {/* Mover a otro módulo del mismo trimestre */}
                                {isAdmin && (
                                  <select
                                    className="text-[10px] font-black uppercase tracking-widest bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-zinc-400 outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                                    onChange={e => moveTaskMut.mutate({
                                      ticketId: ticket.id,
                                      sprint_id: e.target.value === 'backlog' ? null : Number(e.target.value),
                                    })}
                                    value=""
                                  >
                                    <option value="" disabled>Mover</option>
                                    <option value="backlog">↩ Cola de trabajo</option>
                                    {sprintsDelTrimestre
                                      .filter((s: any) => s.id !== sprint.id && !s.esta_finalizado)
                                      .map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                      ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          )) : (
                            <p className="text-center text-[10px] text-zinc-700 italic py-3">
                              {searchTerm ? 'Sin coincidencias' : 'Sin tareas asignadas a este módulo'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ─── COLA DE TRABAJO / TAREAS SIN MÓDULO (derecha) ──────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 px-5 py-2.5 border-b border-zinc-800/60 flex items-center gap-2">
                <Layers size={11} className="text-zinc-500" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">Sin módulo asignado</p>
                <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                  {filteredBacklog.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loadingBacklog ? (
                  <div className="py-8 text-center text-zinc-600 text-[12px] animate-pulse font-bold">Cargando…</div>
                ) : filteredBacklog.length === 0 ? (
                  <div className="py-14 text-center">
                    <Layers size={24} className="mx-auto text-zinc-700 mb-3" />
                    <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest">
                      {searchTerm ? 'Sin coincidencias' : 'Cola vacía'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={() => setActiveTab('tarea')}
                        className="mt-3 text-[11px] text-blue-400 font-black hover:text-blue-300 transition-colors"
                      >
                        + Nueva tarea
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredBacklog.map((ticket: any) => (
                      <div
                        key={ticket.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700 rounded-md transition-all group"
                      >
                        <GripVertical size={12} className="text-zinc-700/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/tickets/${ticket.id}`}
                            className="text-[12px] font-bold text-zinc-300 hover:text-blue-400 truncate transition-colors block"
                          >
                            {ticket.titulo}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${PRIORITY_COLORS[ticket.prioridad] ?? PRIORITY_COLORS.baja}`}>
                            {ticket.prioridad}
                          </span>
                          {/* Mover a módulo activo del trimestre */}
                          {sprintsDelTrimestre.filter((s: any) => !s.esta_finalizado).length > 0 && (
                            <select
                              className="text-[10px] font-black uppercase tracking-widest bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-zinc-400 outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                              onChange={e => moveTaskMut.mutate({
                                ticketId: ticket.id,
                                sprint_id: Number(e.target.value),
                              })}
                              value=""
                            >
                              <option value="" disabled>Mover a módulo</option>
                              {sprintsDelTrimestre
                                .filter((s: any) => !s.esta_finalizado)
                                .map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.nombre}{s.esta_activo ? ' ★' : ''}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: NUEVO MÓDULO (admin) / SOLICITAR MÓDULO (líder) ════════════ */}
      {activeTab === 'modulo' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* ── IZQUIERDA: formulario ──────────────────────────────────────── */}
          <div className="w-full md:w-1/2 md:border-r border-b md:border-b-0 border-zinc-800 overflow-y-auto p-4 md:p-8">
            <div className="max-w-lg">

              {/* Encabezado */}
              <div className="mb-6 pb-4 border-b border-zinc-800">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] mb-1">
                  {trimActual ? ((trimActual as any).nombre ?? `T${(trimActual as any).numero}`) : 'Trimestre'}
                </p>
                <h2 className="text-[18px] font-black text-white flex items-center gap-2">
                  {isAdmin ? <BookMarked size={17} className="text-blue-400" /> : <Send size={17} className="text-blue-400" />}
                  {isAdmin ? 'Nuevo módulo' : 'Solicitar módulo al instructor'}
                </h2>
                {isLider && (
                  <p className="text-[12px] text-zinc-500 mt-1">Tu instructor recibirá la solicitud y podrá aprobarla.</p>
                )}
                {trimError && (
                  <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1 mt-2">
                    <AlertCircle size={11} /> {trimError}
                  </p>
                )}
              </div>

              {/* Formulario instructor/coordinador */}
              {isAdmin && (
                <form onSubmit={onSprintSubmit} className="space-y-5">
                  <FormField label="Nombre del módulo *" error={sprintErrors.nombre?.message}>
                    <input
                      {...regSprint('nombre', { required: 'El nombre es obligatorio' })}
                      className={inCls}
                      placeholder="Ej: T1 MOD-1 — Levantamiento de requerimientos"
                      autoFocus
                    />
                  </FormField>

                  <FormField label="Descripción / Objetivos">
                    <textarea
                      {...regSprint('descripcion')}
                      rows={4}
                      className={`${inCls} resize-none`}
                      placeholder="¿Qué debe lograr el equipo al finalizar este módulo?"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Fecha inicio *" error={sprintErrors.fecha_inicio?.message}>
                      <DateTimeInput
                        {...regSprint('fecha_inicio', { required: 'Requerida' }) as any}
                        min={trimActual ? String((trimActual as any).fecha_inicio).slice(0, 10) : undefined}
                        max={trimActual ? String((trimActual as any).fecha_fin).slice(0, 10) : undefined}
                        rangeLabel={trimActual ? ((trimActual as any).nombre ?? `T${(trimActual as any).numero}`) : undefined}
                      />
                    </FormField>
                    <FormField label="Fecha fin *" error={sprintErrors.fecha_fin?.message}>
                      <DateTimeInput
                        {...regSprint('fecha_fin', { required: 'Requerida' }) as any}
                        min={trimActual ? String((trimActual as any).fecha_inicio).slice(0, 10) : undefined}
                        max={trimActual ? String((trimActual as any).fecha_fin).slice(0, 10) : undefined}
                      />
                    </FormField>
                  </div>

                  {createSprintMut.isError && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-[12px] font-bold">
                      <AlertCircle size={13} />
                      {(createSprintMut.error as any)?.response?.data?.message ?? 'Error al crear el módulo.'}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                    <button type="button" onClick={() => setActiveTab('backlog')}
                      className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={createSprintMut.isPending}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black rounded-md transition-all flex items-center gap-2 disabled:opacity-60">
                      {createSprintMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Creando…</> : <><BookMarked size={13} /> Crear módulo</>}
                    </button>
                  </div>
                </form>
              )}

              {/* Formulario líder técnico — solicitar */}
              {isLider && (
                solicitarOk ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                    <p className="text-emerald-400 font-black text-base">Solicitud enviada al instructor</p>
                    <p className="text-zinc-500 text-[13px] mt-1">Recibirás una notificación cuando sea aprobada.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <FormField label="Nombre del módulo *">
                      <input
                        value={solicitarForm.nombre}
                        onChange={e => setSolicitarForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Ej: Módulo 2 — Desarrollo de la API"
                        className={inCls}
                        autoFocus
                      />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Fecha de inicio">
                        <DateTimeInput
                          value={solicitarForm.fecha_inicio}
                          onChange={e => setSolicitarForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                          min={trimActual ? String((trimActual as any).fecha_inicio).slice(0, 10) : undefined}
                          max={trimActual ? String((trimActual as any).fecha_fin).slice(0, 10) : undefined}
                          rangeLabel={trimActual ? ((trimActual as any).nombre ?? `T${(trimActual as any).numero}`) : undefined}
                        />
                      </FormField>
                      <FormField label="Fecha de fin">
                        <DateTimeInput
                          value={solicitarForm.fecha_fin}
                          onChange={e => setSolicitarForm(f => ({ ...f, fecha_fin: e.target.value }))}
                          min={trimActual ? String((trimActual as any).fecha_inicio).slice(0, 10) : undefined}
                          max={trimActual ? String((trimActual as any).fecha_fin).slice(0, 10) : undefined}
                        />
                      </FormField>
                    </div>

                    <FormField label="Justificación (opcional)">
                      <textarea
                        value={solicitarForm.justificacion}
                        onChange={e => setSolicitarForm(f => ({ ...f, justificacion: e.target.value }))}
                        rows={3}
                        placeholder="¿Por qué se necesita este módulo? ¿Qué cubrirá?"
                        className={`${inCls} resize-none`}
                      />
                    </FormField>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                      <button type="button" onClick={() => setActiveTab('backlog')}
                        className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                        Cancelar
                      </button>
                      <button onClick={handleSolicitar} disabled={solicitarLoad || !solicitarForm.nombre.trim()}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black rounded-md transition-all flex items-center gap-2 disabled:opacity-60">
                        {solicitarLoad ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Send size={13} /> Solicitar módulo</>}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── DERECHA: sugerencias del trimestre ────────────────────────── */}
          <div className="w-full md:w-1/2 bg-zinc-950/40 overflow-hidden flex flex-col min-h-[40vh] md:min-h-0">
            <SugerenciasCompactas
              proyectoId={projectId}
              trimestreId={activeTrimId}
              canManage={isAdmin || isLider}
              onPreFill={({ nombre, descripcion }) => {
                setSprintValue('nombre', nombre);
                if (descripcion) setSprintValue('descripcion', descripcion);
                if (isLider) setSolicitarForm(f => ({
                  ...f,
                  nombre,
                  justificacion: descripcion ?? f.justificacion,
                }));
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ TAB: NUEVA TAREA ════════════════════════════════════════════════ */}
      {activeTab === 'tarea' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-xl">
            <div className="mb-6 pb-4 border-b border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] mb-1">
                {trimActual ? (trimActual.nombre ?? `T${trimActual.numero}`) : 'Cola de trabajo'}
              </p>
              <h2 className="text-[18px] font-black text-white flex items-center gap-2">
                <Plus size={17} className="text-blue-400" /> Nueva tarea
              </h2>
            </div>

            <form onSubmit={handleTicketSubmit(data => createTicketMut.mutate(data))} className="space-y-5">
              <FormField label="Título *" error={ticketErrors.titulo?.message}>
                <input
                  {...regTicket('titulo', { required: 'El título es obligatorio' })}
                  className={inCls}
                  placeholder="Descripción breve de la tarea…"
                  autoFocus
                />
              </FormField>

              <FormField label="Descripción">
                <textarea
                  {...regTicket('descripcion')}
                  rows={3}
                  className={`${inCls} resize-none`}
                  placeholder="Detalles y criterios de aceptación…"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prioridad">
                  <select {...regTicket('prioridad')} className={inCls} defaultValue="media">
                    <option value="baja">🟢 Baja</option>
                    <option value="media">🟡 Media</option>
                    <option value="alta">🔴 Alta</option>
                  </select>
                </FormField>
                <FormField label="Puntos de historia">
                  <input type="number" {...regTicket('story_points')} className={inCls} defaultValue={0} min={0} />
                </FormField>
              </div>

              {/* Selector de módulo — controla los constraints de fecha */}
              <FormField label="Módulo (opcional)">
                <select
                  {...regTicket('sprint_id' as any)}
                  className={inCls}
                  defaultValue=""
                  onChange={e => setTaskSprintId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Sin módulo — cola de trabajo</option>
                  {sprintsDelTrimestre.filter(s => !s.esta_finalizado).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}{s.esta_activo ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-600 mt-1">
                  {taskSprintId
                    ? 'La tarea irá directamente a este módulo.'
                    : 'Sin módulo → aparecerá en "Sin módulo asignado".'}
                </p>
              </FormField>

              {/* Asignar a un miembro del equipo */}
              {(miembros as any[]).length > 0 && (
                <FormField label="Asignar a (opcional)">
                  <select {...regTicket('asignado_a' as any)} className={inCls} defaultValue="">
                    <option value="">— Sin asignar —</option>
                    {(miembros as any[]).map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.es_lider_tecnico ? '⭐' : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {/* Fecha límite con constraints dinámicos según módulo/trimestre */}
              {(() => {
                const sprintSel = taskSprintId
                  ? sprintsDelTrimestre.find((s: any) => s.id === taskSprintId)
                  : null;
                const minDate = sprintSel
                  ? String(sprintSel.fecha_inicio).slice(0, 10)
                  : trimActual ? String((trimActual as any).fecha_inicio).slice(0, 10) : undefined;
                const maxDate = sprintSel
                  ? String(sprintSel.fecha_fin).slice(0, 10)
                  : trimActual ? String((trimActual as any).fecha_fin).slice(0, 10) : undefined;

                return (
                  <FormField label="Fecha límite (opcional)">
                    <DateTimeInput
                      name="fecha_limite"
                      min={minDate}
                      max={maxDate}
                      defaultValue={maxDate}
                      withTime={true}
                      timeName="hora_limite"
                      rangeLabel={
                        sprintSel
                          ? `Dentro de "${sprintSel.nombre}"`
                          : trimActual ? `Dentro del ${(trimActual as any).nombre ?? `T${(trimActual as any).numero}`}` : undefined
                      }
                    />
                  </FormField>
                );
              })()}

              {createTicketMut.isError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-[12px] font-bold">
                  <AlertCircle size={13} /> Error al crear la tarea. Intenta de nuevo.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                <button type="button" onClick={() => setActiveTab('backlog')}
                  className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={createTicketMut.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black rounded-md transition-all flex items-center gap-2 disabled:opacity-60">
                  {createTicketMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Creando…</> : <><Plus size={13} /> Crear tarea</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
