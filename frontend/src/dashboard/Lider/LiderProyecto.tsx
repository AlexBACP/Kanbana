/**
 * LiderProyecto — Panel unificado del Líder Técnico.
 *
 * Sigue el mismo patrón visual de ProjectsPanel (instructor):
 *   • Cabecera con título + pestañas en línea
 *   • Contenido cambia según pestaña activa
 *   • "Tareas" tiene sub-cabecera propia: Lista | Nueva Tarea | Solicitar Módulo
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Trash2, ChevronDown, UserCheck, AlertCircle,
  Loader2, Clock, AlertTriangle, CheckCircle2, Circle,
  ThumbsUp, RotateCcw, CheckCheck, PackageCheck,
} from 'lucide-react';
import { projectService }      from '../../services/project.service';
import { ticketService }       from '../../services/ticket.service';
import { userService }         from '../../services/user.service';
import { useAuthStore }        from '../../store/auth.store';
import { KanbanBoard }         from '../../components/KanbanBoard';
import { SprintContextBanner } from '../../components/SprintContextBanner';
import { ModuleDetailModal }   from '../../components/ModuleDetailModal';
import { TicketStatus }        from '../../types/ticket.types';
import { LiderEquipo }         from './LiderEquipo';

// ── Tipos de vista ────────────────────────────────────────────────────────────
type Tab      = 'tablero' | 'tareas' | 'equipo';
type SubView  = 'list' | 'nueva' | 'solicitar';

// ── Estilos compartidos ───────────────────────────────────────────────────────
const inCls = 'w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

// ── Dropdown de estado ────────────────────────────────────────────────────────
const ESTADOS = [
  { key: 'to_do',       label: 'Por hacer',   color: 'bg-zinc-800 text-zinc-400',             dot: 'bg-zinc-400',    icon: Circle },
  { key: 'in_progress', label: 'En progreso', color: 'bg-blue-500/15 text-blue-400',           dot: 'bg-blue-400',    icon: Clock },
  { key: 'testing',     label: 'En pruebas',  color: 'bg-amber-500/15 text-amber-400',         dot: 'bg-amber-400',   icon: AlertTriangle },
  { key: 'done',        label: 'Completado',  color: 'bg-emerald-500/15 text-emerald-400',     dot: 'bg-emerald-400', icon: CheckCircle2 },
];
const estadoByCfg = (key: string) => ESTADOS.find(e => e.key === key) ?? ESTADOS[0];

const EstadoDropdown = ({ ticket, onUpdate }: { ticket: any; onUpdate: (e: string) => void }) => {
  const [open, setOpen] = useState(false);
  const cfg = estadoByCfg(ticket.estado);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md cursor-pointer hover:opacity-80 transition-opacity select-none ${cfg.color}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl overflow-hidden min-w-[160px]">
            {ESTADOS.map(e => (
              <button key={e.key} onClick={() => { onUpdate(e.key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-zinc-800 transition-colors text-left ${ticket.estado === e.key ? 'bg-zinc-800/60' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} />
                <span className={e.color.split(' ')[1]}>{e.label}</span>
                {ticket.estado === e.key && <span className="ml-auto text-[9px] text-zinc-600">actual</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Dropdown de asignado ──────────────────────────────────────────────────────
const AsigneeDropdown = ({ ticket, miembros, onUpdate }: { ticket: any; miembros: any[]; onUpdate: (id: number | null) => void }) => {
  const [open, setOpen] = useState(false);
  const asignado = ticket.asignado_a;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors group"
      >
        {asignado ? (
          <>
            <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {asignado.avatar_url
                ? <img src={userService.getAvatarUrl(asignado.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                : <span className="text-[8px] font-semibold text-blue-400">{asignado.nombre?.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <span className="truncate max-w-[100px]">{asignado.nombre}</span>
          </>
        ) : (
          <>
            <UserCheck size={12} className="text-zinc-600" />
            <span className="text-zinc-600 italic">Sin asignar</span>
          </>
        )}
        <ChevronDown size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl overflow-hidden min-w-[180px]">
            <button onClick={() => { onUpdate(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <UserCheck size={10} />
              </div>
              Sin asignar
            </button>
            {miembros.map((m: any) => (
              <button key={m.id} onClick={() => { onUpdate(m.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${ticket.asignado_a?.id === m.id ? 'bg-zinc-800/60' : ''}`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar_url
                    ? <img src={userService.getAvatarUrl(m.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                    : <span className="text-[8px] font-semibold text-blue-400">{m.nombre?.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <span className="text-zinc-200 truncate">{m.nombre}</span>
                <span className={`ml-auto text-[9px] shrink-0 ${m.es_lider_tecnico ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {m.es_lider_tecnico ? 'Líder' : 'Aprendiz'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const LiderProyecto = () => {
  const { user }  = useAuthStore();
  const qc        = useQueryClient();

  const [activeTab,    setActiveTab]    = useState<Tab>('tablero');
  const [subView,      setSubView]      = useState<SubView>('list');
  const [search,       setSearch]       = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [formError,    setFormError]    = useState<string | null>(null);
  const [solicitarForm, setSolicitarForm] = useState({ nombre: '', justificacion: '' });
  const [solicitarOk,   setSolicitarOk]   = useState(false);
  const [solicitarLoading, setSolicitarLoading] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: activeSprint, isLoading: loadingSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', miProyecto?.id, activeSprint?.id, 'tablero'],
    queryFn:  () => ticketService.getAll(miProyecto?.id, activeSprint?.id),
    enabled:  !!miProyecto?.id,
  });

  const { data: allTickets = [], isLoading: loadingAllTickets } = useQuery({
    queryKey: ['tickets', miProyecto?.id, 'all'],
    queryFn:  () => ticketService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id && activeTab === 'tareas',
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn:  () => projectService.getMembers(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprints'],
    queryFn:  () => projectService.getSprints(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });

  // rol === 'aprendiz' cubre tanto aprendices como líderes técnicos (sub-rol via es_lider_tecnico)
  const miembrosArr = (miembros as any[]).filter(m => m.rol === 'aprendiz');
  const aprendices  = (miembros as any[]).filter(m => m.rol === 'aprendiz' && !m.es_lider_tecnico);
  const sprintsArr  = sprints as any[];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateStatusMut = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
    },
  });

  const updateTicketMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: any }) => ticketService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const deleteTicketMut = useMutation({
    mutationFn: (id: number) => ticketService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => ticketService.approveCompletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => ticketService.rejectCompletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const createTicketMut = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
      setSubView('list');
      setFormError(null);
    },
    onError: (err: any) => setFormError(err?.response?.data?.message || 'Error al crear la tarea.'),
  });

  const [revisionOk,      setRevisionOk]      = useState(false);
  const [revisionErr,     setRevisionErr]     = useState<string | null>(null);
  const [showModuleDetail, setShowModuleDetail] = useState(false);

  const solicitarRevisionMut = useMutation({
    mutationFn: (sprintId: number) => projectService.solicitarRevision(sprintId),
    onSuccess: () => {
      setRevisionOk(true);
      setRevisionErr(null);
      qc.invalidateQueries({ queryKey: ['projects', miProyecto?.id, 'sprint', 'active'] });
      setTimeout(() => setRevisionOk(false), 5000);
    },
    onError: (err: any) => setRevisionErr(err?.response?.data?.message || 'No se pudo enviar el módulo a revisión.'),
  });

  // ── Derivados de Tareas ───────────────────────────────────────────────────
  const ticketsArr = (allTickets as any[]);
  const filteredTickets = ticketsArr.filter(t => {
    const matchSearch = t.titulo.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === 'all' || t.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNuevaTarea = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!miProyecto?.id) return;
    const f = new FormData(e.currentTarget);
    createTicketMut.mutate({
      titulo:        f.get('titulo') as string,
      descripcion:   (f.get('descripcion') as string) || '',
      prioridad:     f.get('prioridad') as string,
      tipo:          f.get('tipo') as string,
      proyecto_id:   miProyecto.id,
      creado_por_id: user?.id,
      asignado_a_id: f.get('asignado_a_id') ? Number(f.get('asignado_a_id')) : undefined,
      sprint_id:     f.get('sprint_id') ? Number(f.get('sprint_id')) : undefined,
      fecha_limite:  (f.get('fecha_limite') as string) || undefined,
    });
  };

  const handleSolicitarModulo = async () => {
    if (!miProyecto?.id || !solicitarForm.nombre.trim()) return;
    setSolicitarLoading(true);
    try {
      await projectService.solicitarSprint(miProyecto.id, {
        nombre:        solicitarForm.nombre,
        justificacion: solicitarForm.justificacion,
      });
      setSolicitarOk(true);
      setTimeout(() => {
        setSolicitarOk(false);
        setSolicitarForm({ nombre: '', justificacion: '' });
        setSubView('list');
      }, 2000);
    } catch { /* continuar */ }
    finally { setSolicitarLoading(false); }
  };

  // ── Tab helpers ───────────────────────────────────────────────────────────
  const goTab = (tab: Tab) => { setActiveTab(tab); setSubView('list'); setFormError(null); };
  const tabCls = (tab: Tab) =>
    `inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${
      activeTab === tab && (tab !== 'tareas' || subView === 'list')
        ? 'text-blue-400 border-white'
        : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
    }`;
  const subTabCls = (sv: SubView) =>
    `inline-flex items-center gap-1.5 py-2 text-[15px] font-black border-b transition-all duration-200 ${
      subView === sv
        ? 'text-blue-400 border-white'
        : 'text-zinc-500 border-transparent hover:text-blue-400 hover:border-zinc-600'
    }`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full text-zinc-100 bg-zinc-900 min-h-screen">

      {/* ── CABECERA PRINCIPAL ── estilo ProjectsPanel ────────────────────── */}
      <div className="flex items-left bg-zinc-900 pt-10 pl-10 gap-4 flex-col border-b border-zinc-600/60">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Mi Proyecto</h2>
          {miProyecto && (
            <p className="text-[13px] font-semibold text-zinc-400 mt-0.5">{miProyecto.nombre}</p>
          )}
        </div>

        {/* Pestañas principales */}
        <div className="flex items-center gap-5 flex-wrap">
          <button onClick={() => goTab('tablero')} className={tabCls('tablero')}>
            Tablero
          </button>
          <button
            onClick={() => { setActiveTab('tareas'); setSubView('list'); setFormError(null); }}
            className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${
              activeTab === 'tareas'
                ? 'text-blue-400 border-white'
                : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
            }`}
          >
            Tareas
          </button>
          <button onClick={() => goTab('equipo')} className={tabCls('equipo')}>
            Mi Equipo
          </button>
        </div>

        {/* Sub-cabecera: solo visible cuando Tareas está activa */}
        {activeTab === 'tareas' && (
          <div className="flex items-center gap-5 flex-wrap -mt-2 pb-0">
            <button onClick={() => setSubView('list')} className={subTabCls('list')}>
              Lista de tareas
            </button>
            <button onClick={() => { setSubView('nueva'); setFormError(null); }} className={subTabCls('nueva')}>
              <Plus size={14} /> Nueva tarea
            </button>
            <button onClick={() => { setSubView('solicitar'); setSolicitarOk(false); }} className={subTabCls('solicitar')}>
              <Plus size={14} /> Solicitar módulo
            </button>
          </div>
        )}
      </div>

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────────── */}

      {/* ═══ TABLERO KANBAN ════════════════════════════════════════════════ */}
      {activeTab === 'tablero' && (
        <div className="p-6 h-[calc(100vh-200px)] flex flex-col gap-4">
          {/* Barra superior del tablero */}
          <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
            {loadingSprint ? (
              <div className="w-64 h-8 bg-zinc-800/60 rounded-xl animate-pulse" />
            ) : activeSprint ? (
              <SprintContextBanner
                sprint={activeSprint}
                ticketsDone={(tickets as any[]).filter(t => t.estado === 'done').length}
                ticketsTotal={(tickets as any[]).length}
                onClick={() => setShowModuleDetail(true)}
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Clock size={11} className="text-amber-400" />
                <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Sin módulo activo</span>
              </div>
            )}

            {/* Botón enviar módulo a revisión: visible cuando todas las tareas están en testing o done */}
            {activeSprint && !activeSprint.pendiente_revision && !activeSprint.esta_finalizado && (tickets as any[]).length > 0 && (() => {
              const listas = (tickets as any[]).filter(t => t.estado === 'testing' || t.estado === 'done').length;
              const total  = (tickets as any[]).length;
              const puedeEnviar = listas === total;
              return puedeEnviar ? (
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => solicitarRevisionMut.mutate(activeSprint.id)}
                    disabled={solicitarRevisionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md shadow-violet-900/30"
                  >
                    {solicitarRevisionMut.isPending
                      ? <Loader2 size={11} className="animate-spin" />
                      : <PackageCheck size={11} />
                    }
                    Enviar módulo a revisión
                  </button>
                  {revisionOk && <span className="text-[10px] text-emerald-400 font-bold">✓ Enviado al instructor</span>}
                  {revisionErr && <span className="text-[10px] text-rose-400 font-bold">{revisionErr}</span>}
                </div>
              ) : null;
            })()}

            {activeSprint?.pendiente_revision && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/25 rounded-lg text-[11px] font-black text-violet-400 uppercase tracking-widest">
                <PackageCheck size={11} />
                Módulo enviado — esperando instructor
              </span>
            )}
          </div>

          {/* Barra de progreso */}
          {(tickets as any[]).length > 0 && activeSprint && (() => {
            const done = (tickets as any[]).filter(t => t.estado === 'done').length;
            const progress = Math.round((done / (tickets as any[]).length) * 100);
            return (
              <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            );
          })()}

          {/* Kanban */}
          <div className="flex-1 overflow-hidden">
            {loadingSprint ? (
              <div className="flex gap-5 h-full">
                {[1,2,3,4].map(i => <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />)}
              </div>
            ) : !activeSprint ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
                <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center mb-5">
                  <Clock size={28} className="text-zinc-600" />
                </div>
                <h3 className="text-[15px] font-black text-zinc-300 mb-2">El tablero está en espera</h3>
                <p className="text-[12px] text-zinc-500 mb-6 leading-relaxed">
                  El instructor debe activar un módulo para iniciar el flujo de trabajo del equipo.
                </p>
                <button
                  onClick={() => { setActiveTab('tareas'); setSubView('solicitar'); }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black rounded-md transition-all"
                >
                  Solicitar módulo al instructor
                </button>
              </div>
            ) : loadingTickets ? (
              <div className="flex gap-5 h-full overflow-x-auto pb-4">
                {[1,2,3,4].map(i => <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />)}
              </div>
            ) : (
              <div className="h-full overflow-x-auto overflow-y-hidden">
                <KanbanBoard
                  tickets={tickets as any[]}
                  onStatusChange={(ticketId, status) => updateStatusMut.mutate({ ticketId, status })}
                  role="lider_tecnico"
                  currentUserId={user?.id}
                  onApprove={(id) => approveMut.mutate(id)}
                  onReject={(id)  => rejectMut.mutate(id)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAREAS ════════════════════════════════════════════════════════ */}
      {activeTab === 'tareas' && (

        <>
          {/* ── Lista de tareas ────────────────────────────────────────────── */}
          {subView === 'list' && (
            <div className="animate-[fadeIn_0.18s_ease-out]">

              {/* Alerta: tareas listas para revisión del líder */}
              {ticketsArr.filter((t: any) => t.completado_por_aprendiz).length > 0 && (
                <div className="mx-10 mt-5 flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-md">
                  <CheckCheck size={15} className="text-emerald-400 shrink-0" />
                  <p className="text-sm font-medium text-emerald-400">
                    <span className="font-black">{ticketsArr.filter((t: any) => t.completado_por_aprendiz).length}</span> tarea{ticketsArr.filter((t: any) => t.completado_por_aprendiz).length !== 1 ? 's' : ''} lista{ticketsArr.filter((t: any) => t.completado_por_aprendiz).length !== 1 ? 's' : ''} para tu revisión — aparecen resaltadas en la lista.
                  </p>
                </div>
              )}

              {/* Filtros / búsqueda */}
              <div className="flex bg-zinc-900 flex-col pt-6 gap-4 px-10">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tarea..."
                    className="w-full bg-zinc-900 border border-zinc-400 rounded-lg pl-10 py-3 text-sm text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                {/* Estado chips */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'to_do', label: 'Por hacer' },
                    { key: 'in_progress', label: 'En progreso' },
                    { key: 'testing', label: 'En pruebas' },
                    { key: 'done', label: 'Completados' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilterEstado(key)}
                      className={`px-3 py-1 rounded-md border font-bold text-sm transition-all ${
                        filterEstado === key
                          ? 'bg-zinc-800 text-zinc-300 border-zinc-600'
                          : 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      {label}
                      <span className="ml-1.5 text-[10px] text-zinc-600 font-black">
                        {ticketsArr.filter(t => key === 'all' || t.estado === key).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla */}
              <div className="px-10 pt-6 pb-12">
                <div className="bg-zinc-900 border border-zinc-700/60 rounded-md overflow-hidden shadow-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-700 bg-zinc-950/40">
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Título</th>
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Estado</th>
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Prioridad</th>
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Asignado a</th>
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Revisión</th>
                        <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-[13px]">
                      {loadingAllTickets ? (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500 animate-pulse">Cargando tareas...</td></tr>
                      ) : filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-14 text-center">
                            <AlertCircle size={24} className="mx-auto text-zinc-600 mb-2 opacity-40" />
                            <p className="text-sm font-medium text-zinc-500">
                              {ticketsArr.length === 0 ? 'No hay tareas en este proyecto' : 'Sin coincidencias'}
                            </p>
                          </td>
                        </tr>
                      ) : filteredTickets.map((t: any) => {
                        const PRIO = { alta: 'text-rose-400', media: 'text-amber-400', baja: 'text-blue-400' };
                        const isReady = t.completado_por_aprendiz === true;
                        return (
                          <tr key={t.id} className={`transition-colors group ${isReady ? 'bg-emerald-950/25 hover:bg-emerald-950/35' : 'hover:bg-zinc-800/30'}`}>
                            <td className="px-5 py-3 font-medium text-zinc-200 max-w-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="truncate" title={t.titulo}>{t.titulo}</p>
                                {isReady && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded uppercase tracking-widest shrink-0">
                                    Listo ✓
                                  </span>
                                )}
                              </div>
                              {t.tipo && <span className="text-[10px] text-zinc-500 capitalize">{t.tipo}</span>}
                            </td>
                            <td className="px-5 py-3">
                              <EstadoDropdown ticket={t} onUpdate={(estado) => updateStatusMut.mutate({ ticketId: t.id, status: estado as TicketStatus })} />
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold capitalize ${(PRIO as any)[t.prioridad] ?? 'text-zinc-400'}`}>{t.prioridad}</span>
                            </td>
                            <td className="px-5 py-3">
                              <AsigneeDropdown
                                ticket={t}
                                miembros={miembrosArr}
                                onUpdate={(userId) => updateTicketMut.mutate({ id: t.id, dto: { asignado_a_id: userId } })}
                              />
                            </td>
                            {/* Revisión: aprobar o devolver al pool */}
                            <td className="px-5 py-3">
                              {isReady ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => approveMut.mutate(t.id)}
                                    disabled={approveMut.isPending}
                                    title="Aprobar → pasa a En revisión"
                                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-md transition-all disabled:opacity-50"
                                  >
                                    <ThumbsUp size={10} />
                                    Aprobar
                                  </button>
                                  <button
                                    onClick={() => rejectMut.mutate(t.id)}
                                    disabled={rejectMut.isPending}
                                    title="Rechazar → devuelve al pool"
                                    className="flex items-center gap-1 px-2 py-1 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 text-[10px] font-black rounded-md transition-all disabled:opacity-50"
                                  >
                                    <RotateCcw size={10} />
                                    Devolver
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-700">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => window.confirm(`¿Eliminar "${t.titulo}"?`) && deleteTicketMut.mutate(t.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-md text-zinc-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Nueva tarea (inline form) ───────────────────────────────────── */}
          {subView === 'nueva' && (
            <div className="px-10 py-8 animate-[fadeIn_0.2s_ease-out]">
              <div className="border-b border-zinc-700/60 pb-4 mb-6">
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Plus className="text-blue-400" size={18} />
                  Crear Nueva Tarea
                </h2>
                <p className="text-[13px] text-zinc-400 font-medium mt-0.5">
                  Completa los campos para crear una tarea en el proyecto.
                </p>
              </div>

              <form onSubmit={handleNuevaTarea} className="space-y-5 max-w-2xl bg-zinc-900 p-6 rounded-md border border-zinc-700/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Título *">
                    <input name="titulo" required className={inCls} placeholder="Ej: Implementar login con JWT" />
                  </FormField>
                  <FormField label="Tipo">
                    <select name="tipo" defaultValue="task" className={inCls}>
                      <option value="task">Tarea</option>
                      <option value="bug">Bug</option>
                      <option value="story">Historia</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Descripción">
                  <textarea name="descripcion" rows={3} className={`${inCls} resize-none`} placeholder="Criterios de aceptación, detalles técnicos..." />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Prioridad">
                    <select name="prioridad" defaultValue="media" className={inCls}>
                      <option value="alta">🔴 Alta</option>
                      <option value="media">🟡 Media</option>
                      <option value="baja">🟢 Baja</option>
                    </select>
                  </FormField>
                  <FormField label="Asignar a">
                    <select name="asignado_a_id" className={inCls}>
                      <option value="">Sin asignar</option>
                      {aprendices.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Módulo">
                    <select name="sprint_id" className={inCls}>
                      <option value="">Cola de trabajo (sin módulo)</option>
                      {sprintsArr.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Fecha límite">
                    <input name="fecha_limite" type="date" className={inCls} />
                  </FormField>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
                    <AlertCircle size={13} className="text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-400">{formError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-zinc-700/60">
                  <button type="button" onClick={() => { setSubView('list'); setFormError(null); }}
                    className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={createTicketMut.isPending}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black rounded-md transition-all shadow-md flex items-center gap-2 disabled:opacity-60">
                    {createTicketMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Creando...</> : <><Plus size={13} /> Crear tarea</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Solicitar módulo (inline form) ──────────────────────────────── */}
          {subView === 'solicitar' && (
            <div className="px-10 py-8 animate-[fadeIn_0.2s_ease-out]">
              <div className="border-b border-zinc-700/60 pb-4 mb-6">
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Plus className="text-blue-400" size={18} />
                  Solicitar Módulo al Instructor
                </h2>
                <p className="text-[13px] text-zinc-400 font-medium mt-0.5">
                  Tu instructor recibirá la solicitud y podrá crear el módulo para el equipo.
                </p>
              </div>

              {solicitarOk ? (
                <div className="max-w-md py-12 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-4" />
                  <p className="text-emerald-400 font-black text-base">✓ Solicitud enviada correctamente</p>
                  <p className="text-zinc-400 text-sm mt-1">Recibirás una notificación cuando el módulo sea creado.</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-md bg-zinc-900 p-6 rounded-md border border-zinc-700/60">
                  <FormField label="Nombre del módulo *">
                    <input
                      value={solicitarForm.nombre}
                      onChange={e => setSolicitarForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Módulo 2 — Desarrollo backend"
                      className={inCls}
                    />
                  </FormField>
                  <FormField label="Justificación (opcional)">
                    <textarea
                      value={solicitarForm.justificacion}
                      onChange={e => setSolicitarForm(f => ({ ...f, justificacion: e.target.value }))}
                      rows={3}
                      placeholder="¿Por qué necesitas este módulo?"
                      className={`${inCls} resize-none`}
                    />
                  </FormField>
                  <div className="flex justify-end gap-3 pt-2 border-t border-zinc-700/60">
                    <button type="button" onClick={() => setSubView('list')}
                      className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSolicitarModulo}
                      disabled={solicitarLoading || !solicitarForm.nombre.trim()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black rounded-md transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                      {solicitarLoading ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : 'Enviar solicitud'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ EQUIPO ════════════════════════════════════════════════════════ */}
      {activeTab === 'equipo' && (
        <div className="p-6">
          <LiderEquipo />
        </div>
      )}

      {/* ═══ MODAL: Detalle del módulo ══════════════════════════════════════ */}
      {showModuleDetail && activeSprint && (
        <ModuleDetailModal
          sprint={activeSprint}
          tickets={tickets as any[]}
          onClose={() => setShowModuleDetail(false)}
          canEdit={true}
          onSave={async (desc) => {
            await projectService.updateSprint(activeSprint.id, { descripcion: desc });
            qc.invalidateQueries({ queryKey: ['projects', miProyecto?.id, 'sprint', 'active'] });
          }}
        />
      )}
    </div>
  );
};
