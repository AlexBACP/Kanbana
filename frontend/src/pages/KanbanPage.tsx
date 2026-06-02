/**
 * KanbanPage — Tablero Kanban completo de un proyecto.
 * Ruta: /projects/:id/kanban
 *
 * Rediseñado con estilo zinc/moderno, unificado con el resto de la app.
 */
import { useState, useMemo }                       from 'react';
import { useParams, useNavigate }                 from 'react-router-dom';
import { useQuery, useMutation, useQueryClient }  from '@tanstack/react-query';
import {
  ChevronLeft, Search, CheckCircle2,
  Users, Plus, AlertCircle, LayoutGrid, Layers,
  Clock, SlidersHorizontal, X, Flag, User2, CalendarClock,
} from 'lucide-react';
import { projectService }  from '../services/project.service';
import { ticketService }   from '../services/ticket.service';
import { KanbanBoard }     from '../components/KanbanBoard';
import { Modal }           from '../components/Modal';
import { Button }          from '../components/Button';
import { DateTimeInput }   from '../components/DateTimeInput';
import { RejectModal }     from '../components/RejectModal';
import { useAuthStore }    from '../store/auth.store';
import { TicketStatus }    from '../types/ticket.types';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600';

export const KanbanPage = () => {
  const { id }      = useParams<{ id: string }>();
  const projectId   = Number(id);
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const navigate    = useNavigate();

  const [searchTerm,       setSearchTerm]       = useState('');
  const [showTicketModal,  setShowTicketModal]  = useState(false);
  const [showMembers,      setShowMembers]      = useState(false);
  const [showFilters,      setShowFilters]      = useState(false);
  const [rejectingTicket,  setRejectingTicket]  = useState<{ id: number; titulo?: string } | null>(null);

  // ── Filtros avanzados ─────────────────────────────────────────────────────
  const [filterAssignee,  setFilterAssignee]  = useState<number | null>(null);
  const [filterPriority,  setFilterPriority]  = useState<string | null>(null);
  const [filterBlocked,   setFilterBlocked]   = useState(false);
  const [filterDate,      setFilterDate]      = useState<'overdue' | 'week' | null>(null);

  const canManage   = user?.rol === 'coordinador' || user?.rol === 'instructor' ||
                      (user?.rol === 'aprendiz' && (user as any).es_lider_tecnico);
  const esInstructor = user?.rol === 'instructor' || user?.rol === 'coordinador';
  const esLider      = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const kanbanRole   = esInstructor ? user!.rol
                     : esLider      ? 'lider_tecnico'
                     : 'aprendiz';

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn:  () => projectService.getById(projectId),
    enabled:  !!projectId,
  });

  const { data: activeSprint, isLoading: loadingSprint } = useQuery({
    queryKey: ['projects', projectId, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(projectId),
    enabled:  !!projectId,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', projectId, activeSprint?.id],
    queryFn:  () => ticketService.getAll(projectId, activeSprint?.id),
    enabled:  !!projectId,
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn:  () => projectService.getMembers(projectId),
    enabled:  !!projectId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', projectId] }),
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'No se pudo actualizar el estado.'),
  });

  const closeSprintMutation = useMutation({
    mutationFn: () => projectService.closeSprint(activeSprint!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'No se pudo cerrar el módulo.'),
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({ ...dto, proyecto_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      setShowTicketModal(false);
    },
  });

  // Líder técnico: aprobar/rechazar tareas en revisión (testing)
  const liderApproveMut = useMutation({
    mutationFn: (ticketId: number) => ticketService.approveCompletion(ticketId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', projectId] }),
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'No se pudo aprobar la tarea.'),
  });

  const liderRejectMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      ticketService.rejectCompletion(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      setRejectingTicket(null);
    },
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'No se pudo rechazar la tarea.'),
  });

  // ── Derivados ──────────────────────────────────────────────────────────────
  const ticketsArr = tickets as any[];
  const membersArr = members as any[];
  const aprendices = membersArr.filter((m: any) => m.rol === 'aprendiz');

  const filteredTickets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    return ticketsArr.filter(t => {
      if (searchTerm && !t.titulo?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterAssignee) {
        const aid = t.asignado_a?.id ?? t.asignado_a_id ?? t.asignado_a;
        if (aid !== filterAssignee) return false;
      }
      if (filterPriority && t.prioridad !== filterPriority) return false;
      if (filterBlocked && !t.esta_bloqueado) return false;
      if (filterDate === 'overdue') {
        if (!t.fecha_limite) return false;
        const due = new Date(t.fecha_limite);
        if (due >= today) return false;
      }
      if (filterDate === 'week') {
        if (!t.fecha_limite) return false;
        const due = new Date(t.fecha_limite);
        if (due < today || due > endOfWeek) return false;
      }
      return true;
    });
  }, [ticketsArr, searchTerm, filterAssignee, filterPriority, filterBlocked, filterDate]);

  const activeFilterCount = [filterAssignee, filterPriority, filterBlocked, filterDate].filter(Boolean).length;

  const done       = ticketsArr.filter(t => t.estado === 'done').length;
  const inProgress = ticketsArr.filter(t => t.estado === 'in_progress').length;
  const todo       = ticketsArr.filter(t => t.estado === 'to_do').length;
  const blocked    = ticketsArr.filter(t => t.esta_bloqueado).length;
  const progress   = ticketsArr.length > 0 ? Math.round((done / ticketsArr.length) * 100) : 0;

  if (!project && !ticketsLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <LayoutGrid size={40} className="text-zinc-600 opacity-40" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">Proyecto no encontrado</p>
        <button onClick={() => navigate('/dashboard')} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
          ← Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-5 py-3.5 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 border border-zinc-700 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-black text-zinc-100 tracking-tight truncate max-w-xs">
                  {project?.nombre || '...'}
                </h1>
                {loadingSprint ? (
                  <div className="w-24 h-5 bg-zinc-800 rounded-full animate-pulse" />
                ) : activeSprint ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{activeSprint.nombre}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full shrink-0">
                    <Clock size={10} className="text-amber-400" />
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Sin módulo activo</span>
                  </div>
                )}
              </div>
              {/* Stats rápidos */}
              <div className="flex items-center gap-3 mt-0.5 text-[11px] font-black text-zinc-500">
                <span className="text-emerald-400">{done} completadas</span>
                <span>·</span>
                <span className="text-blue-400">{inProgress} en progreso</span>
                <span>·</span>
                <span>{todo} pendientes</span>
                {blocked > 0 && <><span>·</span><span className="text-rose-400">{blocked} bloqueadas</span></>}
                {ticketsArr.length > 0 && <><span>·</span><span className="text-primary-400">{progress}%</span></>}
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscador */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Filtrar tareas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 outline-none focus:border-primary-500/50 w-40 placeholder:text-zinc-600 transition-colors"
              />
            </div>

            {/* Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <SlidersHorizontal size={13} /> Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Equipo */}
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showMembers
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <Users size={13} /> {aprendices.length}
            </button>

            {/* Cola de trabajo */}
            <button
              onClick={() => navigate(`/projects/${projectId}/backlog`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            >
              <Layers size={13} /> Cola de trabajo
            </button>

            {/* Nueva tarea */}
            {canManage && (
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/15 border border-primary-500/25 text-primary-400 rounded-xl text-xs font-black hover:bg-primary-600/25 transition-all"
              >
                <Plus size={13} /> Tarea
              </button>
            )}

            {/* Finalizar módulo */}
            {activeSprint && canManage && (
              <button
                onClick={() => {
                  if (confirm('¿Finalizar el módulo actual? Se verificará que todas las tareas estén completadas.')) {
                    closeSprintMutation.mutate();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-black hover:bg-rose-500/20 transition-all"
              >
                <CheckCircle2 size={13} /> Finalizar módulo
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {ticketsArr.length > 0 && (
          <div className="mt-3 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Panel de filtros avanzados ────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-5 py-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">

            {/* Asignado a */}
            <div className="flex items-center gap-2">
              <User2 size={12} className="text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Asignado a</span>
              <select
                value={filterAssignee ?? ''}
                onChange={e => setFilterAssignee(e.target.value ? Number(e.target.value) : null)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="">Todos</option>
                {aprendices.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nombre.split(' ')[0]}</option>
                ))}
              </select>
            </div>

            {/* Prioridad */}
            <div className="flex items-center gap-2">
              <Flag size={12} className="text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Prioridad</span>
              <div className="flex gap-1">
                {[
                  { val: null,    label: 'Todas', cls: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
                  { val: 'alta',  label: '🔴 Alta',  cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                  { val: 'media', label: '🟡 Media', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                  { val: 'baja',  label: '🟢 Baja',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                ].map(({ val, label, cls }) => (
                  <button
                    key={String(val)}
                    onClick={() => setFilterPriority(val)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                      filterPriority === val ? cls + ' ring-1 ring-offset-0' : 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bloqueado */}
            <button
              onClick={() => setFilterBlocked(b => !b)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                filterBlocked
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
              }`}
            >
              🚫 Solo bloqueados
            </button>

            {/* Fecha */}
            <div className="flex items-center gap-2">
              <CalendarClock size={12} className="text-zinc-500" />
              <div className="flex gap-1">
                {[
                  { val: null,      label: 'Cualquier fecha' },
                  { val: 'overdue', label: 'Vencidas' },
                  { val: 'week',    label: 'Esta semana' },
                ].map(({ val, label }) => (
                  <button
                    key={String(val)}
                    onClick={() => setFilterDate(val as any)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                      filterDate === val
                        ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                        : 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Limpiar filtros */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterAssignee(null); setFilterPriority(null); setFilterBlocked(false); setFilterDate(null); }}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
              >
                <X size={11} /> Limpiar
              </button>
            )}
          </div>

          {/* Resumen de resultados */}
          {activeFilterCount > 0 && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Mostrando <span className="text-zinc-300 font-bold">{filteredTickets.length}</span> de{' '}
              <span className="text-zinc-300 font-bold">{ticketsArr.length}</span> tareas
            </p>
          )}
        </div>
      )}

      {/* ── Panel de equipo (colapsable) ───────────────────────────────────── */}
      {showMembers && (
        <div className="bg-zinc-900/80 border-b border-zinc-800 px-5 py-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Equipo:</span>
            {aprendices.length === 0 ? (
              <span className="text-xs text-zinc-600 italic">Sin integrantes asignados</span>
            ) : aprendices.map((m: any) => (
              <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-lg border border-zinc-700 text-xs">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-[9px] font-black text-white shrink-0">
                  {m.nombre?.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-zinc-200 font-bold">{m.nombre.split(' ')[0]}</span>
                {m.es_lider_tecnico && (
                  <span className="text-[9px] text-emerald-400 font-bold">Líder</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tablero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        {!activeSprint && !loadingSprint ? (
          <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center mb-5">
              <LayoutGrid size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-lg font-black text-zinc-300 tracking-tight mb-2">El tablero está en espera</h3>
            <p className="text-zinc-500 max-w-xs text-sm leading-relaxed mb-7">
              Activa un módulo desde la cola de trabajo para visualizar el flujo de trabajo del equipo.
            </p>
            <button
              onClick={() => navigate(`/projects/${projectId}/backlog`)}
              className="px-7 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-black text-sm transition-all"
            >
              Cola de Trabajo
            </button>
          </div>
        ) : ticketsLoading || loadingSprint ? (
          <div className="flex gap-5 h-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-2xl border border-zinc-700/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <KanbanBoard
            tickets={filteredTickets}
            onStatusChange={(ticketId, status) => updateStatusMutation.mutate({ ticketId, status })}
            readonly={!canManage}
            role={kanbanRole}
            currentUserId={user?.id}
            onApprove={esLider ? (id) => liderApproveMut.mutate(id) : undefined}
            onReject={esLider ? (id) => {
              const t = ticketsArr.find(x => x.id === id);
              setRejectingTicket({ id, titulo: t?.titulo });
            } : undefined}
          />
        )}
      </div>

      {/* ── Modal: Rechazo de tarea ────────────────────────────────────────── */}
      <RejectModal
        ticket={rejectingTicket}
        onClose={() => setRejectingTicket(null)}
        onReject={(id, motivo) => liderRejectMut.mutate({ id, motivo: motivo || undefined })}
        isPending={liderRejectMut.isPending}
      />

      {/* ── Modal: Nueva Tarea ─────────────────────────────────────────────── */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nueva Tarea">
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createTicketMutation.mutate({
              titulo:       f.get('titulo') as string,
              descripcion:  f.get('descripcion') as string,
              prioridad:    f.get('prioridad') as string,
              asignado_a:   f.get('asignado_a') ? Number(f.get('asignado_a')) : undefined,
              fecha_limite: f.get('fecha_limite') || undefined,
              sprint_id:    activeSprint?.id || undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Título">
            <input name="titulo" required className={inputCls} placeholder="Descripción breve de la tarea" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" className={`${inputCls} resize-none`} rows={3} placeholder="Detalles de la tarea..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prioridad">
              <select name="prioridad" className={inputCls} defaultValue="media">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </FormField>
            <FormField label="Asignar a">
              <select name="asignado_a" className={inputCls}>
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Fecha límite">
            <DateTimeInput
              name="fecha_limite"
              withTime={true}
              timeName="hora_limite"
              min={(activeSprint as any)?.fecha_inicio?.toString().slice(0, 10)}
              max={(activeSprint as any)?.fecha_fin?.toString().slice(0, 10)}
              rangeLabel={(activeSprint as any)?.nombre ? `Dentro de "${(activeSprint as any).nombre}"` : undefined}
            />
          </FormField>
          {activeSprint && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
              <CheckCircle2 size={13} />
              Se añadirá al módulo activo: <strong>{activeSprint.nombre}</strong>
            </div>
          )}
          <Button type="submit" isLoading={createTicketMutation.isPending} className="w-full py-3.5">
            {createTicketMutation.isPending ? 'Creando...' : 'Crear Tarea'}
          </Button>
          {createTicketMutation.isError && (
            <p className="text-xs text-rose-400 text-center flex items-center justify-center gap-1">
              <AlertCircle size={12} /> Error al crear la tarea
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
