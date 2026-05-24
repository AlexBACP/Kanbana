/**
 * FichasPanel — Inline navigation (ProjectsPanel style).
 *
 * Header (siempre visible):
 *   Coordinador: [Todas las fichas] [Nueva ficha]
 *   Instructor:  [Todas las fichas] [Solicitar nueva ficha]
 *
 * Contenido de "Todas las fichas":
 *   · Search bar + filtros (igual que ProjectsPanel)
 *   · Tabla de fichas
 *   · Al hacer clic en una ficha → FichaDetalle aparece inline (reemplaza tabla)
 *
 * FichaDetalle (inline):
 *   Breadcrumb ← + sub-tabs: Trimestres | Aprendices | Nuevo Proyecto
 *   Trimestre cards: 2 por fila — clic → lista de proyectos de la ficha
 *   "Nuevo Proyecto" idéntico al de ProjectsPanel
 *
 * ProyectoDetalle: sigue siendo full-page (sin header principal).
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, ChevronLeft, Hash, Calendar,
  GraduationCap, FolderKanban, Users, User,
  CheckCircle2, UserPlus, ShieldCheck, Search,
  Crown, UserMinus, Check, FileSpreadsheet, Upload, Download,
  AlertTriangle, Layers, Settings, Ticket, Send, Clock, LayoutGrid, Loader2,
  Pencil, X, Save, Link2,
  Github, HardDrive, Figma, BookOpen,
} from 'lucide-react';
import { fichaService } from '../../services/ficha.service';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { KanbanBoard } from '../../components/KanbanBoard';
import { UserProfileModal } from '../../components/UserProfileModal';
import { RecursosPanel } from '../../components/RecursosPanel';
import { recursoService } from '../../services/recurso.service';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = 'todas' | 'nueva' | 'solicitar';
type FichaTab = 'trimestres' | 'aprendices' | 'nuevo_proyecto';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  activo:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  finalizado: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Chip = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${color}`}>{label}</span>
);

const AvatarBadge = ({ nombre, url, size = 8 }: { nombre?: string; url?: string; size?: number }) => (
  <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>
    {url
      ? <img src={url} className="w-full h-full object-cover" alt="" />
      : <span className="text-white font-black text-xs">{nombre?.slice(0, 2).toUpperCase() || 'KA'}</span>}
  </div>
);

const SkeletonRow = () => (
  <div className="h-14 bg-zinc-800/40 rounded-md animate-pulse mx-4 mb-1" />
);

// ProjectsPanel-style label
const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

// Tab button (ProjectsPanel style)
const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${
      active
        ? 'text-blue-400 border-white'
        : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
    }`}
  >
    {children}
  </button>
);

// ─── ProyectoDetalle — diseño inline estilo ProjectsPanel ────────────────────
type ProyectoTab = 'tablero' | 'equipo' | 'nueva_tarea' | 'recursos';

const ProyectoDetalle = ({ proyectoId, onBack }: { proyectoId: number; onBack: () => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProyectoTab>('tablero');
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [memberAddOk, setMemberAddOk] = useState(false);
  const [equipoFilter, setEquipoFilter] = useState<'todos' | 'lideres' | 'aprendices'>('todos');
  const [equipoSearch, setEquipoSearch] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [ticketFormError, setTicketFormError] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['projects', proyectoId],
    queryFn: () => projectService.getById(proyectoId),
    staleTime: 60000,
  });
  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', proyectoId, 'members'],
    queryFn: () => projectService.getMembers(proyectoId),
    staleTime: 60000,
  });
  const { data: activeSprint } = useQuery({
    queryKey: ['projects', proyectoId, 'sprint', 'active'],
    queryFn: () => projectService.getActiveSprint(proyectoId),
    enabled: !!proyectoId,
  });
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', proyectoId, (activeSprint as any)?.id],
    queryFn: () => ticketService.getAll(proyectoId, (activeSprint as any)?.id),
    enabled: !!proyectoId,
    staleTime: 30000,
  });
  // Miembros de la ficha a la que pertenece este proyecto.
  // Se usa para "Añadir integrantes" — solo se ven aprendices de la misma ficha.
  // proyFichaId se puede resolver después de cargar `proyecto`, por eso enabled depende de él.
  const proyFichaId: number | null =
    (proyecto as any)?.fichaId ?? (proyecto as any)?.ficha?.id ?? null;
  const { data: fichaUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['fichas', proyFichaId, 'members'],
    queryFn:  () => fichaService.getMembers(proyFichaId!),
    staleTime: 60_000,
    enabled:  tab === 'equipo' && !!proyFichaId,
  });
  const { data: recursosData = [] } = useQuery({
    queryKey: ['recursos', proyectoId],
    queryFn: () => recursoService.getAll(proyectoId),
    staleTime: 60000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: any }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', proyectoId] }),
  });
  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({
      ...dto,
      proyecto_id:   proyectoId,
      creado_por_id: user?.id,
      sprint_id:     (activeSprint as any)?.id ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', proyectoId] });
      setTicketFormError(null);
      setTab('tablero');
    },
    onError: (err: any) => {
      setTicketFormError(err?.response?.data?.message || 'Error al crear la tarea.');
    },
  });
  const addMemberMutation = useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map(uid => projectService.addMember(proyectoId, uid))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      setSelectedMemberIds(new Set());
      setMemberAddOk(true);
      setTimeout(() => setMemberAddOk(false), 2000);
    },
  });
  const removeMemberMutation = useMutation({
    mutationFn: (uid: number) => projectService.removeMember(proyectoId, uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] }),
  });
  const toggleLiderMutation = useMutation({
    mutationFn: (uid: number) => userService.toggleLiderTecnico(uid),
    onSuccess: () => {
      // Invalidar el equipo del proyecto, el proyecto completo (liderId cambió)
      // y los usuarios — la pantalla del coordinador/instructor se actualiza inmediatamente
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      qc.invalidateQueries({ queryKey: ['projects', proyectoId] });
      qc.invalidateQueries({ queryKey: ['projects', 'for-me'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al cambiar rol'));
    },
  });

  // ── Skeleton / guards ─────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col h-full">
      <div className="h-[200px] bg-zinc-800/40 rounded-none animate-pulse" />
      <div className="p-6 space-y-4">
        {[1,2,3].map(n => <div key={n} className="h-16 bg-zinc-800/30 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );
  if (!proyecto) return null;

  const proy = proyecto as any;
  const miembrosArr = miembros as any[];
  const allUsersArr = fichaUsers as any[];
  const ticketsArr = tickets as any[];
  const sprint = activeSprint as any;
  const recursosArr = recursosData as any[];
  const canManage = user?.rol === 'coordinador' || user?.rol === 'instructor' ||
                    (user?.rol === 'aprendiz' && user.es_lider_tecnico);

  const done       = ticketsArr.filter((t: any) => t.estado === 'done').length;
  const inProgress = ticketsArr.filter((t: any) => t.estado === 'in_progress').length;
  const todo       = ticketsArr.filter((t: any) => t.estado === 'to_do').length;
  const progress   = ticketsArr.length > 0 ? Math.round((done / ticketsArr.length) * 100) : 0;

  const filteredTickets = ticketsArr.filter((t: any) =>
    t.titulo?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMiembros = (() => {
    let list = miembrosArr;
    if (equipoFilter === 'lideres') list = list.filter((m: any) => m.es_lider_tecnico);
    else if (equipoFilter === 'aprendices') list = list.filter((m: any) => !m.es_lider_tecnico);
    if (equipoSearch.trim()) {
      const q = equipoSearch.toLowerCase();
      list = list.filter((m: any) => m.nombre?.toLowerCase().includes(q) || m.correo?.toLowerCase().includes(q));
    }
    return list;
  })();

  const addableUsers = allUsersArr.filter((u: any) => {
    if (u.rol !== 'aprendiz') return false;
    if (miembrosArr.find((m: any) => m.id === u.id)) return false;
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      return u.nombre?.toLowerCase().includes(q) || u.correo?.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (id: number) => setSelectedMemberIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // ─── Tab button (header style) ────────────────────────────────────────────────
  const PTab = ({ id, icon: Icon, label }: { id: ProyectoTab; icon: any; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-5 py-3 text-[13px] font-black border-b-2 transition-all duration-200 whitespace-nowrap ${
        tab === id
          ? 'text-white border-white'
          : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <motion.div
      key="proyecto-detalle"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* ── Header card ───────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* Back + info row */}
        <div className="px-6 pt-5 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-black uppercase tracking-widest mb-4"
          >
            <ChevronLeft size={13} /> Todos los proyectos
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-primary-600/10 border border-primary-500/20 rounded-lg">
                  <FolderKanban size={12} className="text-primary-400" />
                  <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Proyecto formativo</span>
                </div>
                {proy.estado && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${STATUS_COLORS[proy.estado] || 'bg-zinc-700/30 text-zinc-400 border-zinc-700'}`}>
                    {proy.estado}
                  </span>
                )}
              </div>
              <h2 className="text-[22px] font-black text-white tracking-tight leading-tight truncate">{proy.nombre}</h2>
              {proy.descripcion && (
                <p className="text-[12px] text-zinc-400 mt-1 max-w-2xl line-clamp-2">{proy.descripcion}</p>
              )}
              {proy.lider && (
                <div className="flex items-center gap-2 mt-2">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span className="text-[12px] font-bold text-emerald-300">{proy.lider.nombre}</span>
                  <span className="text-[10px] text-zinc-500">· Líder Técnico</span>
                </div>
              )}
              {(proy.competencia || proy.resultado_aprendizaje) && (
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {proy.competencia && (
                    <p className="text-[11px] text-zinc-500 line-clamp-1">
                      <span className="text-zinc-600 font-bold">Competencia:</span> {proy.competencia}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {[
                { label: 'Total', value: ticketsArr.length, color: 'text-zinc-300' },
                { label: 'Por hacer', value: todo, color: 'text-slate-400' },
                { label: 'Progreso', value: inProgress, color: 'text-blue-400' },
                { label: 'Listas', value: done, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl min-w-[52px]">
                  <span className={`text-[18px] font-black ${s.color}`}>{s.value}</span>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {ticketsArr.length > 0 && (
            <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Recursos strip — acceso rápido siempre visible ──────────────── */}
        {(recursosArr.length > 0 || canManage) && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-t border-zinc-800/60 overflow-x-auto scrollbar-none">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest shrink-0">Recursos</span>
            {recursosArr.map((r: any) => {
              const ICONS: Record<string, any> = {
                github: Github,
                drive:  HardDrive,
                figma:  Figma,
                notion: BookOpen,
                trello: LayoutGrid,
                jira:   Ticket,
                link:   Link2,
              };
              const COLORS: Record<string, string> = {
                github: 'text-white   bg-zinc-800     border-zinc-600',
                drive:  'text-blue-400  bg-blue-500/10  border-blue-500/25',
                figma:  'text-pink-400  bg-pink-500/10  border-pink-500/25',
                notion: 'text-zinc-300 bg-zinc-700/40  border-zinc-600/40',
                trello: 'text-blue-400  bg-blue-500/10  border-blue-500/25',
                jira:   'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
                link:   'text-zinc-400 bg-zinc-700/30  border-zinc-600/30',
              };
              const tipo  = r.tipo || 'link';
              const RIcon = ICONS[tipo] || Link2;
              const cls   = COLORS[tipo] || COLORS.link;
              const isGH  = tipo === 'github';
              return (
                <button
                  key={r.id}
                  onClick={() => isGH ? setTab('recursos') : window.open(r.url, '_blank', 'noopener')}
                  title={isGH ? `Ver widget de GitHub — ${r.nombre}` : r.url}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-all hover:brightness-125 shrink-0 ${cls}`}
                >
                  <RIcon size={12} />
                  {r.nombre}
                  {isGH && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </button>
              );
            })}
            {canManage && (
              <button
                onClick={() => setTab('recursos')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 text-[11px] font-bold transition-all shrink-0"
              >
                <Plus size={11} /> Agregar
              </button>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 border-t border-zinc-800/60 overflow-x-auto">
          <PTab id="tablero"      icon={LayoutGrid} label="Tablero" />
          <PTab id="equipo"       icon={Users}      label={`Equipo (${miembrosArr.length})`} />
          <PTab id="recursos"     icon={Link2}      label="Recursos" />
          {canManage && <PTab id="nueva_tarea" icon={Plus}  label="Nueva tarea" />}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── TABLERO ─────────────────────────────────────────────────────── */}
          {tab === 'tablero' && (
            <motion.div
              key="tablero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full flex flex-col"
            >
              {/* Sprint info bar */}
              <div className="flex items-center justify-between gap-3 px-6 py-3 bg-zinc-900/60 border-b border-zinc-800/60 shrink-0 flex-wrap">
                <div className="flex items-center gap-3">
                  {sprint ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">{sprint.nombre}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                      <Clock size={11} className="text-amber-400" />
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Sin módulo activo</span>
                    </div>
                  )}
                  <div className="hidden md:flex items-center gap-3 text-[11px] font-black text-zinc-500">
                    <span className="text-emerald-400">{done} ✓</span>
                    <span>·</span>
                    <span className="text-blue-400">{inProgress} ⟳</span>
                    <span>·</span>
                    <span className="text-zinc-400">{todo} pendientes</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Filtrar tareas..."
                      className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 outline-none focus:border-primary-500/50 w-36 placeholder:text-zinc-600 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => navigate(`/projects/${proyectoId}/backlog`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    <Layers size={12} /> Cola de trabajo
                  </button>
                </div>
              </div>

              {/* Kanban board */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
                {!sprint ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
                    <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center mb-5">
                      <LayoutGrid size={28} className="text-zinc-600" />
                    </div>
                    <h3 className="text-[15px] font-black text-zinc-300 mb-2">El tablero está en espera</h3>
                    <p className="text-[12px] text-zinc-500 mb-6 leading-relaxed">
                      Activa un módulo desde la cola de trabajo para visualizar el flujo de trabajo del equipo.
                    </p>
                    <button
                      onClick={() => navigate(`/projects/${proyectoId}/backlog`)}
                      className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white text-[12px] font-black rounded-xl transition-all"
                    >
                      Cola de Trabajo
                    </button>
                  </div>
                ) : ticketsLoading ? (
                  <div className="flex gap-5 h-full">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-2xl border border-zinc-700/30 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <KanbanBoard
                    tickets={filteredTickets}
                    onStatusChange={(ticketId, newStatus) =>
                      updateStatusMutation.mutate({ ticketId, status: newStatus })
                    }
                    readonly={!canManage}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* ── VER EQUIPO ──────────────────────────────────────────────────── */}
          {tab === 'equipo' && (
            <motion.div
              key="equipo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto p-6"
            >
              <div className="max-w-2xl space-y-5">
                {/* Integrantes actuales */}
                <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5">
                  {/* Header + filtros */}
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Users size={13} /> Equipo actual ({miembrosArr.length})
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['todos', 'lideres', 'aprendices'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setEquipoFilter(f)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                            equipoFilter === f
                              ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          {f === 'todos' ? 'Todos' : f === 'lideres' ? 'Líderes' : 'Aprendices'}
                        </button>
                      ))}
                      <div className="relative flex-1 min-w-[140px]">
                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          value={equipoSearch}
                          onChange={e => setEquipoSearch(e.target.value)}
                          placeholder="Buscar integrante..."
                          className="pl-7 pr-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 outline-none focus:border-primary-500/50 w-full placeholder:text-zinc-600 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  {miembrosArr.length === 0 ? (
                    <p className="text-[12px] text-zinc-500 text-center py-4">Sin integrantes asignados</p>
                  ) : filteredMiembros.length === 0 ? (
                    <p className="text-[12px] text-zinc-500 text-center py-4">Sin resultados</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredMiembros.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-700/20 transition-all group">
                          <button onClick={() => setProfileUserId(m.id)} className="shrink-0 hover:opacity-80 transition-opacity">
                            <AvatarBadge nombre={m.nombre} url={m.avatar_url} size={8} />
                          </button>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setProfileUserId(m.id)}>
                            <p className="text-[13px] font-bold text-zinc-200 truncate hover:text-primary-400 transition-colors">{m.nombre}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{m.correo}</p>
                          </div>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest shrink-0 ${m.es_lider_tecnico ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                            {m.es_lider_tecnico ? 'Líder' : 'Aprendiz'}
                          </span>
                          {canManage && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {m.es_lider_tecnico ? (
                                <button
                                  onClick={() => toggleLiderMutation.mutate(m.id)}
                                  disabled={toggleLiderMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"
                                >
                                  <Crown size={11} /> Quitar líder
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleLiderMutation.mutate(m.id)}
                                  disabled={toggleLiderMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"
                                >
                                  <Crown size={11} /> Hacer líder
                                </button>
                              )}
                              <button
                                onClick={() => removeMemberMutation.mutate(m.id)}
                                disabled={removeMemberMutation.isPending}
                                className="p-1.5 rounded-xl text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-30"
                              >
                                <UserMinus size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Añadir integrantes */}
                {canManage && (
                  <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5">
                    <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <UserPlus size={13} /> Añadir integrantes
                    </h3>
                    {memberAddOk && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[11px] font-bold mb-3">
                        <CheckCircle2 size={13} /> Integrante(s) añadido(s) correctamente
                      </div>
                    )}
                    <div className="relative mb-3">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Buscar aprendices disponibles..."
                        className="input-dark pl-8 text-[12px] w-full"
                      />
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {loadingUsers ? (
                        [1,2,3].map(n => <div key={n} className="h-12 bg-zinc-700/30 rounded-xl animate-pulse" />)
                      ) : addableUsers.length === 0 ? (
                        <p className="text-[12px] text-zinc-500 text-center py-4">
                          {memberSearch ? 'Sin resultados' : 'No hay aprendices disponibles'}
                        </p>
                      ) : addableUsers.map((u: any) => {
                        const isSel = selectedMemberIds.has(u.id);
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleSelect(u.id)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${isSel ? 'bg-primary-600/15 border-primary-500/30' : 'bg-zinc-700/20 border-zinc-700/40 hover:border-zinc-600'}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isSel ? 'bg-primary-600 border-primary-500' : 'border-zinc-600 bg-zinc-800'}`}>
                              {isSel && <Check size={10} className="text-white" />}
                            </div>
                            <AvatarBadge nombre={u.nombre} url={u.avatar_url} size={7} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-zinc-200 truncate">{u.nombre}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{u.correo}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedMemberIds.size > 0 && (
                      <button
                        onClick={() => addMemberMutation.mutate([...selectedMemberIds])}
                        disabled={addMemberMutation.isPending}
                        className="mt-3 w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-[12px] font-black rounded-xl uppercase tracking-widest transition-all"
                      >
                        {addMemberMutation.isPending ? 'Añadiendo...' : `Añadir ${selectedMemberIds.size} integrante(s)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── NUEVA TAREA ─────────────────────────────────────────────────── */}
          {tab === 'nueva_tarea' && canManage && (
            <motion.div
              key="nueva_tarea"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto p-6"
            >
              <div className="max-w-lg">
                {/* Sprint activo info */}
                <div className={`flex items-center gap-2 p-3 rounded-xl text-[11px] font-bold mb-6 ${sprint ? 'bg-emerald-500/8 border border-emerald-500/15 text-emerald-400' : 'bg-amber-500/8 border border-amber-500/15 text-amber-400'}`}>
                  {sprint ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {sprint
                    ? <>La tarea se creará en el módulo activo: <strong>{sprint.nombre}</strong></>
                    : <>Sin módulo activo — la tarea quedará en la cola de trabajo</>
                  }
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    setTicketFormError(null);
                    const f = new FormData(e.currentTarget);
                    const asignadoRaw = f.get('asignado_a_id');
                    createTicketMutation.mutate({
                      titulo:        f.get('titulo') as string,
                      descripcion:   (f.get('descripcion') as string) || '',
                      tipo:          f.get('tipo') as string,
                      prioridad:     f.get('prioridad') as string,
                      asignado_a_id: asignadoRaw ? Number(asignadoRaw) : undefined,
                      fecha_limite:  (f.get('fecha_limite') as string) || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <FormField label="Título *">
                    <input
                      name="titulo"
                      required
                      placeholder="Descripción breve de la tarea"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors placeholder:text-dark-muted/50"
                    />
                  </FormField>

                  <FormField label="Descripción">
                    <textarea
                      name="descripcion"
                      rows={3}
                      placeholder="Detalles, criterios de aceptación..."
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-dark-muted/50"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Tipo">
                      <select name="tipo" defaultValue="task"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="task">✅ Tarea</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="story">📖 Historia</option>
                      </select>
                    </FormField>
                    <FormField label="Prioridad">
                      <select name="prioridad" defaultValue="media"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Media</option>
                        <option value="baja">🟢 Baja</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Asignar a">
                    <select name="asignado_a_id"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
                    >
                      <option value="">Sin asignar</option>
                      {miembrosArr.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} ({a.es_lider_tecnico ? 'Líder Técnico' : 'Aprendiz'})
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Fecha límite">
                    <input name="fecha_limite" type="date"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </FormField>

                  {ticketFormError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                      <p className="text-xs text-rose-400">{ticketFormError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={createTicketMutation.isPending}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {createTicketMutation.isPending
                      ? <><Loader2 size={14} className="animate-spin" /> Creando tarea...</>
                      : <><Plus size={14} /> Crear Tarea</>
                    }
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ── RECURSOS ──────────────────────────────────────────────────── */}
          {tab === 'recursos' && (
            <motion.div
              key="recursos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <RecursosPanel proyectoId={proyectoId} canManage={canManage} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── UserProfileModal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {profileUserId && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── MemberRow ────────────────────────────────────────────────────────────────
const MemberRow = ({ member, canManage, isLider, onPromote, onDemote, onRemove, onProfile, isLoading }: any) => (
  <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-800/40 transition-all group">
    <button onClick={onProfile} className="shrink-0 hover:opacity-80 transition-opacity">
      <AvatarBadge nombre={member.nombre} url={member.avatar_url} size={7} />
    </button>
    <div className="flex-1 min-w-0 cursor-pointer" onClick={onProfile}>
      <p className="text-xs font-bold text-zinc-200 truncate hover:text-primary-400 transition-colors">{member.nombre}</p>
      <p className="text-[10px] text-zinc-500 truncate">{member.correo}</p>
    </div>
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border uppercase tracking-widest shrink-0 ${isLider ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{isLider ? 'Líder' : 'Aprendiz'}</span>
    {canManage && (
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isLider
          ? <button onClick={onDemote} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"><Crown size={11} /> Quitar líder</button>
          : <button onClick={onPromote} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"><Crown size={11} /> Hacer líder</button>}
        <button onClick={onRemove} disabled={isLoading} className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"><UserMinus size={12} /></button>
      </div>
    )}
  </div>
);

// ─── AprendicesManager ────────────────────────────────────────────────────────
const AprendicesManager = ({ fichaId, canManage }: { fichaId: number; canManage: boolean }) => {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'invitar' | 'manual' | 'excel'>('invitar');
  const [inviteForm, setInviteForm] = useState({ nombre: '', correo: '', documento: '' });
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addResult, setAddResult] = useState<{ added: number[]; errors: { id: number; reason: string }[] } | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; linked: number; errors: { fila: number; correo: string; reason: string }[] } | null>(null);
  const [filterRole, setFilterRole] = useState<'todos' | 'lideres' | 'aprendices'>('todos');
  const [mainSearch, setMainSearch] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useQuery({ queryKey: ['fichas', fichaId, 'members'], queryFn: () => fichaService.getMembers(fichaId), staleTime: 30000 });
  const { data: available = [], isLoading: loadingAvailable } = useQuery({ queryKey: ['fichas', 'available-users'], queryFn: () => fichaService.getAvailableUsers(), staleTime: 30000, enabled: showAddModal && activeTab === 'manual' });

  const addMembersMutation = useMutation({
    mutationFn: (ids: number[]) => fichaService.addMembers(fichaId, ids),
    onSuccess: (result) => { setAddResult(result); setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }); qc.invalidateQueries({ queryKey: ['fichas', 'available-users'] }); if (!result.errors.length) setTimeout(() => { setShowAddModal(false); setAddResult(null); }, 1200); },
  });
  const importExcelMutation = useMutation({
    mutationFn: (file: File) => fichaService.importFromExcel(fichaId, file),
    onSuccess: (result) => { setImportResult(result); qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }); },
  });
  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => fichaService.removeMember(fichaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }),
  });
  const promoteMutation = useMutation({
    mutationFn: (userId: number) => fichaService.promoteToLider(fichaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }),
    onError: (err: any) => { const msg = err?.response?.data?.message; alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error')); },
  });
  const demoteMutation = useMutation({
    mutationFn: (userId: number) => fichaService.demoteToAprendiz(fichaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }),
    onError: (err: any) => { const msg = err?.response?.data?.message; alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error')); },
  });
  const inviteMutation = useMutation({
    mutationFn: (dto: any) => fichaService.invitarAprendiz(fichaId, dto),
    onSuccess: () => { setInviteSuccess(true); setInviteForm({ nombre: '', correo: '', documento: '' }); setInviteError(null); qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }); },
    onError: (err: any) => { const msg = err?.response?.data?.message; setInviteError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al invitar')); },
  });

  const membersArr = members as any[];
  const availableArr = available as any[];
  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return availableArr;
    const q = searchQuery.toLowerCase();
    return availableArr.filter((u: any) => u.nombre?.toLowerCase().includes(q) || u.correo?.toLowerCase().includes(q));
  }, [availableArr, searchQuery]);

  const filteredMembers = useMemo(() => {
    let list = membersArr.filter((m: any) => m.rol === 'aprendiz');
    if (filterRole === 'lideres') list = list.filter((m: any) => m.es_lider_tecnico);
    else if (filterRole === 'aprendices') list = list.filter((m: any) => !m.es_lider_tecnico);
    if (mainSearch.trim()) {
      const q = mainSearch.toLowerCase();
      list = list.filter((m: any) => m.nombre?.toLowerCase().includes(q) || m.correo?.toLowerCase().includes(q));
    }
    return list;
  }, [membersArr, filterRole, mainSearch]);

  const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleFileDrop = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) return;
    setExcelFile(file); setImportResult(null);
  };

  const lideres   = membersArr.filter(m => m.rol === 'aprendiz' && m.es_lider_tecnico);
  const aprendices = membersArr.filter(m => m.rol === 'aprendiz' && !m.es_lider_tecnico);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <GraduationCap size={13} /> Aprendices de la Ficha ({membersArr.filter((m:any) => m.rol === 'aprendiz').length})
        </h3>
        {canManage && (
          <button
            onClick={() => { setShowAddModal(true); setAddResult(null); setImportResult(null); setSelectedIds(new Set()); setSearchQuery(''); setExcelFile(null); setInviteForm({ nombre:'',correo:'',documento:'' }); setInviteSuccess(false); setInviteError(null); setActiveTab('invitar'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/10 border border-primary-500/20 text-primary-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/20 transition-all"
          >
            <UserPlus size={12} /> Agregar Aprendices
          </button>
        )}
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['todos', 'lideres', 'aprendices'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterRole(f)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              filterRole === f
                ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {f === 'todos' ? `Todos (${membersArr.filter((m:any) => m.rol === 'aprendiz').length})` : f === 'lideres' ? `Líderes (${lideres.length})` : `Aprendices (${aprendices.length})`}
          </button>
        ))}
        <div className="relative flex-1 min-w-[150px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={mainSearch}
            onChange={e => setMainSearch(e.target.value)}
            placeholder="Buscar aprendiz..."
            className="pl-7 pr-3 py-1 bg-zinc-800/60 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 outline-none focus:border-primary-500/50 w-full placeholder:text-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Lista */}
      {loadingMembers
        ? <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-12 bg-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
        : membersArr.filter((m:any) => m.rol === 'aprendiz').length === 0
          ? <div className="text-center py-8 bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-700"><GraduationCap size={24} className="mx-auto text-zinc-600 mb-2 opacity-30" /><p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sin aprendices vinculados</p></div>
          : filteredMembers.length === 0
            ? <p className="text-[12px] text-zinc-500 text-center py-6">Sin resultados</p>
            : <div className="space-y-1">
                {filteredMembers.map((m:any) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    canManage={canManage}
                    isLider={m.es_lider_tecnico}
                    onProfile={() => setProfileUserId(m.id)}
                    onPromote={() => { if (confirm(`¿Promover a ${m.nombre} como Líder Técnico?`)) promoteMutation.mutate(m.id); }}
                    onDemote={() => demoteMutation.mutate(m.id)}
                    onRemove={() => { if (confirm(`¿Desvincular a ${m.nombre}?`)) removeMemberMutation.mutate(m.id); }}
                    isLoading={promoteMutation.isPending || demoteMutation.isPending || removeMemberMutation.isPending}
                  />
                ))}
              </div>
      }

      {/* UserProfileModal */}
      <AnimatePresence>
        {profileUserId && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>

      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setAddResult(null); setImportResult(null); setExcelFile(null); setSelectedIds(new Set()); }} title="Agregar Aprendices a la Ficha">
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-dark-bg/60 rounded-2xl border border-dark-border">
            {(['invitar','manual','excel'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? (tab==='invitar' ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30' : tab==='manual' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30') : 'text-dark-muted hover:text-dark-text'}`}>
                {tab==='invitar' && <><UserPlus size={12} /> Invitar nuevo</>}{tab==='manual' && <><Search size={12} /> Buscar usuario</>}{tab==='excel' && <><FileSpreadsheet size={12} /> Excel masivo</>}
              </button>
            ))}
          </div>
          {activeTab === 'invitar' && (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-primary-500/8 border border-primary-500/20 rounded-2xl"><p className="text-[11px] font-black text-primary-400 uppercase tracking-widest">Crear cuenta y enviar invitación</p><p className="text-[10px] text-dark-muted mt-1">Se crea la cuenta con la cédula como contraseña inicial.</p></div>
              {inviteSuccess && <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /><p className="text-xs text-emerald-400 font-bold">¡Aprendiz invitado! Correo de confirmación enviado.</p></div>}
              {inviteError && <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2"><AlertTriangle size={14} className="text-rose-400" /><p className="text-xs text-rose-400 font-bold">{inviteError}</p></div>}
              <form onSubmit={e => { e.preventDefault(); if (!inviteForm.nombre.trim()||!inviteForm.correo.trim()||!inviteForm.documento.trim()) { setInviteError('Todos los campos son obligatorios'); return; } setInviteError(null); setInviteSuccess(false); inviteMutation.mutate(inviteForm); }} className="space-y-3">
                {([{key:'nombre' as const, label:'Nombre completo', placeholder:'Juan Pérez García', type:'text'}, {key:'correo' as const, label:'Correo electrónico', placeholder:'juan@sena.edu.co', type:'email'}, {key:'documento' as const, label:'Cédula / documento', placeholder:'1234567890', type:'text'}] as const).map(({key,label,placeholder,type}) => (
                  <div key={key} className="space-y-1.5"><label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label><input type={type} value={inviteForm[key]} onChange={e => setInviteForm(f => ({...f,[key]:e.target.value}))} placeholder={placeholder} className="input-dark w-full text-sm" /></div>
                ))}
                <button type="submit" disabled={inviteMutation.isPending} className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2">{inviteMutation.isPending ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Enviando...</> : <><UserPlus size={13} /> Crear cuenta y enviar correo</>}</button>
              </form>
            </div>
          )}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {addResult && <div className="space-y-2">{addResult.added.length>0 && <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2"><Check size={14} className="text-emerald-400" /><p className="text-xs text-emerald-400 font-bold">{addResult.added.length} aprendiz(ces) vinculados</p></div>}{addResult.errors.length>0 && <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">{addResult.errors.map(e => <p key={e.id} className="text-[10px] text-amber-400">· {e.reason}</p>)}</div>}</div>}
              <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted pointer-events-none" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nombre o correo..." className="input-dark pl-9 text-sm" /></div>
              {filteredAvailable.length > 0 && <div className="flex items-center justify-between"><p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest">{selectedIds.size>0 ? `${selectedIds.size} seleccionado(s)` : 'Selecciona aprendices'}</p><div className="flex gap-2"><button onClick={() => setSelectedIds(new Set(filteredAvailable.map((u:any)=>u.id)))} className="text-[10px] text-primary-400 font-bold hover:underline">Seleccionar todos</button>{selectedIds.size>0 && <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-dark-muted font-bold hover:underline">Limpiar</button>}</div></div>}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {loadingAvailable ? [1,2,3].map(n=><div key={n} className="h-14 bg-dark-bg/50 rounded-2xl animate-pulse" />) : filteredAvailable.length===0 ? <p className="text-sm text-dark-muted text-center py-8">{searchQuery ? 'Sin resultados' : 'No hay aprendices disponibles sin ficha'}</p> : filteredAvailable.map((u:any) => {
                  const isSel = selectedIds.has(u.id);
                  return <button key={u.id} onClick={() => toggleSelect(u.id)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${isSel ? 'bg-primary-600/15 border-primary-500/40' : 'bg-dark-bg/50 border-dark-border'}`}>
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${isSel ? 'bg-primary-600 border-primary-500' : 'border-dark-border bg-dark-bg'}`}>{isSel && <Check size={11} className="text-white" />}</div>
                    <AvatarBadge nombre={u.nombre} url={u.avatar_url} size={8} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-dark-text truncate">{u.nombre}</p><p className="text-[10px] text-dark-muted truncate">{u.correo}</p></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${u.es_lider_tecnico ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{u.es_lider_tecnico ? 'Líder técnico' : 'Aprendiz'}</span>
                  </button>;
                })}
              </div>
              <button onClick={() => selectedIds.size>0 && addMembersMutation.mutate([...selectedIds])} disabled={selectedIds.size===0||addMembersMutation.isPending} className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all">
                {addMembersMutation.isPending ? 'Vinculando...' : selectedIds.size===0 ? 'Selecciona aprendices' : `Vincular ${selectedIds.size} aprendiz${selectedIds.size>1?'ces':''}`}
              </button>
            </div>
          )}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl space-y-1"><p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Importación masiva Excel</p><p className="text-[10px] text-dark-muted">Columnas: <strong className="text-dark-text">nombre</strong>, <strong className="text-dark-text">correo</strong>, <strong className="text-dark-text">cedula</strong></p><p className="text-[10px] text-amber-400/70">⚠ Se envía correo de confirmación a cada aprendiz.</p></div>
              <button onClick={() => fichaService.downloadTemplate().catch(() => alert('Error al descargar'))} className="w-full flex items-center justify-center gap-2 py-2.5 bg-dark-bg/60 border border-dark-border hover:border-primary-500/30 text-dark-muted hover:text-primary-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"><Download size={13} /> Descargar plantilla .xlsx</button>
              {!importResult && <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFileDrop(f);}} className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${dragOver?'border-emerald-500/60 bg-emerald-500/8':excelFile?'border-emerald-500/40 bg-emerald-500/5':'border-dark-border hover:border-primary-500/30 bg-dark-bg/30'}`} onClick={()=>{const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls,.csv';input.onchange=e=>{const f=(e.target as HTMLInputElement).files?.[0];if(f)handleFileDrop(f);};input.click();}}>
                {excelFile ? <div className="space-y-2"><div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto"><FileSpreadsheet size={22} className="text-emerald-400" /></div><p className="text-sm font-black text-emerald-400">{excelFile.name}</p><button onClick={e=>{e.stopPropagation();setExcelFile(null);}} className="text-[10px] text-rose-400 hover:underline font-bold">Cambiar archivo</button></div>
                  : <div className="space-y-3"><div className="w-12 h-12 bg-dark-border/50 rounded-2xl flex items-center justify-center mx-auto"><Upload size={20} className="text-dark-muted" /></div><div><p className="text-sm font-black text-dark-text">Arrastra tu archivo aquí</p><p className="text-[10px] text-dark-muted mt-1">o haz clic · .xlsx, .xls, .csv</p></div></div>}
              </div>}
              {importResult && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-emerald-400">{importResult.created}</p><p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">Creados</p></div><div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-blue-400">{importResult.linked}</p><p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-wider">Vinculados</p></div></div>{importResult.errors.length>0 && <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-3"><p className="text-[11px] font-black text-amber-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {importResult.errors.length} fila(s) con errores</p>{importResult.errors.map((e,i)=><p key={i} className="text-[10px] text-amber-400/80">Fila {e.fila}: {e.reason}</p>)}</div>}<button onClick={()=>{setImportResult(null);setExcelFile(null);}} className="w-full py-2.5 bg-dark-bg/60 border border-dark-border text-dark-muted hover:text-dark-text rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Importar otro archivo</button></div>}
              {!importResult && <button onClick={()=>{if(excelFile)importExcelMutation.mutate(excelFile);}} disabled={!excelFile||importExcelMutation.isPending} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2">{importExcelMutation.isPending ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Importando...</> : <><FileSpreadsheet size={14} /> {excelFile ? 'Importar aprendices' : 'Selecciona un archivo primero'}</>}</button>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

// ─── FichaDetalle (inline — sin header propio) ────────────────────────────────
const FichaDetalleInline = ({
  fichaId, onBack, onSelectProyecto,
}: { fichaId: number; onBack: () => void; onSelectProyecto: (id: number) => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [fichaTab, setFichaTab] = useState<FichaTab>('trimestres');
  const [selectedTrimestre, setSelectedTrimestre] = useState<any | null>(null);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [numTrimFicha, setNumTrimFicha] = useState(3);
  const [numTrimestresNew, setNumTrimestresNew] = useState(3);

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    codigo: '', programa: '', fecha_inicio: '', fecha_fin: '', instructor_id: '',
  });

  const goToTab = (tab: FichaTab) => { setFichaTab(tab); setSelectedTrimestre(null); };

  const { data: ficha, isLoading: loadingFicha } = useQuery({ queryKey: ['fichas', fichaId], queryFn: () => fichaService.getById(fichaId), staleTime: 60000 });
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({ queryKey: ['projects', { fichaId }], queryFn: () => projectService.getAll({ fichaId }), staleTime: 60000 });
  const { data: fichaMembers = [] } = useQuery({ queryKey: ['fichas', fichaId, 'members'], queryFn: () => fichaService.getMembers(fichaId), staleTime: 30000 });
  const { data: trimestres = [], isLoading: loadingTrim } = useQuery({ queryKey: ['fichas', fichaId, 'trimestres'], queryFn: () => fichaService.getTrimestres(fichaId), staleTime: 30000 });
  const { data: allUsers = [] } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll(), staleTime: 60000 });

  // Solo líderes de ESTA ficha — ya tenemos fichaMembers cargado arriba
  const leaders = (fichaMembers as any[]).filter((u: any) => u.rol === 'aprendiz' && u.es_lider_tecnico);

  const createProyectoMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: async (proyecto: any) => {
      try { await projectService.generateTrimestres(proyecto.id, { num: numTrimestresNew }); } catch { }
      qc.invalidateQueries({ queryKey: ['projects', { fichaId }] });
      goToTab('trimestres');
      setNumTrimestresNew(3);
    },
  });

  const generateTrimMutation = useMutation({
    mutationFn: (dto: any) => fichaService.generateTrimestres(fichaId, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'trimestres'] }); setShowTrimModal(false); },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al generar trimestres'),
  });

  const updateFichaMutation = useMutation({
    mutationFn: (dto: any) => fichaService.update(fichaId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fichas', fichaId] });
      qc.invalidateQueries({ queryKey: ['fichas'] });
      setIsEditing(false);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al actualizar la ficha'),
  });

  const openEdit = (f: any) => {
    setEditForm({
      codigo:       f.codigo       ?? '',
      programa:     f.programa     ?? '',
      fecha_inicio: f.fecha_inicio ? f.fecha_inicio.slice(0, 10) : '',
      fecha_fin:    f.fecha_fin    ? f.fecha_fin.slice(0, 10)    : '',
      instructor_id: f.instructor_id ? String(f.instructor_id) : '',
    });
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const dto: any = {
      codigo:       editForm.codigo,
      programa:     editForm.programa,
      fecha_inicio: editForm.fecha_inicio || undefined,
      fecha_fin:    editForm.fecha_fin    || undefined,
      instructor_id: editForm.instructor_id ? Number(editForm.instructor_id) : null,
    };
    updateFichaMutation.mutate(dto);
  };

  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const canManageMembers = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const canManageTrim = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const aprendicesCount = (fichaMembers as any[]).filter(u => u.rol === 'aprendiz').length;
  const proyectosArr = proyectos as any[];
  const trimestresArr = trimestres as any[];

  if (loadingFicha) return <div className="p-6 space-y-4">{[1,2].map(n => <div key={n} className="h-36 bg-zinc-800/40 rounded-2xl animate-pulse" />)}</div>;
  if (!ficha) return null;
  const f = ficha as any;

  // instructores disponibles para el select (solo si canCreate)
  const instructores = (allUsers as any[]).filter((u: any) => u.rol === 'instructor');
  const inCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600 transition-colors';

  // ── Métricas de la ficha para el banner del coordinador ───────────────────
  const fichaActivos    = proyectosArr.filter((p: any) => p.estado === 'activo').length;
  const fichaPausados   = proyectosArr.filter((p: any) => p.estado === 'pausado').length;
  const fichaAvancePct  = proyectosArr.length > 0
    ? Math.round(proyectosArr.reduce((sum: number, p: any) => sum + (p.avance ?? 0), 0) / proyectosArr.length)
    : 0;

  return (
    <div className="animate-[fadeIn_0.2s_ease-out]">

      {/* ── Banner de métricas (solo coordinador) ─────────────────────────── */}
      {user?.rol === 'coordinador' && (
        <div className="relative overflow-hidden mx-6 mt-4 mb-0 rounded-md p-5 text-white shadow-lg bg-gradient-to-br from-emerald-700 via-teal-800 to-teal-950">
          {/* SVG de fondo */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polygon points="100,16 128,32 128,64 100,80 72,64 72,32" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8"/>
              <polygon points="150,56 178,72 178,104 150,120 122,104 122,72" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
              <polygon points="50,56 78,72 78,104 50,120 22,104 22,72" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
              <line x1="128" y1="48" x2="150" y2="72" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
              <line x1="72"  y1="48" x2="50"  y2="72" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
              <circle cx="100" cy="48"  r="4" fill="currentColor" opacity="0.7"/>
              <circle cx="150" cy="88"  r="3" fill="currentColor" opacity="0.5"/>
              <circle cx="50"  cy="88"  r="3" fill="currentColor" opacity="0.5"/>
            </svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">
                Ficha de Formación
              </p>
              <h2 className="text-lg font-black leading-tight text-white">
                #{f.codigo} — {f.programa}
              </h2>
              {f.instructor && (
                <p className="text-xs text-emerald-200 mt-0.5">
                  Instructor: {f.instructor.nombre}
                </p>
              )}
            </div>
            {/* Métricas rápidas */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'Proyectos',  value: proyectosArr.length, color: 'text-white' },
                { label: 'Activos',    value: fichaActivos,         color: 'text-emerald-300' },
                { label: 'En pausa',   value: fichaPausados,        color: 'text-amber-300' },
                { label: 'Aprendices', value: aprendicesCount,      color: 'text-cyan-300' },
                { label: 'Avance',     value: `${fichaAvancePct}%`, color: 'text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 border border-white/10 min-w-[64px]">
                  <span className={`text-lg font-black ${color}`}>{value}</span>
                  <span className="text-[9px] text-white/60 uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb + sub-tabs */}
      <div className="flex items-center gap-4 px-6 md:px-10 pt-6 pb-0 border-b border-zinc-700/50 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onBack} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-bold uppercase tracking-widest shrink-0">
            <ChevronLeft size={13} /> Fichas
          </button>
          <span className="text-zinc-700">/</span>
          <div className="min-w-0 flex items-center gap-2">
            <p className="text-zinc-400 font-black text-sm truncate">#{f.codigo} — {f.programa}</p>
            {canCreate && !isEditing && (
              <button
                onClick={() => openEdit(f)}
                title="Editar ficha"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-all text-[10px] font-black shrink-0"
              >
                <Pencil size={11} /> Editar
              </button>
            )}
          </div>
        </div>

        {/* sub-tabs */}
        <div className="flex items-center gap-4 shrink-0">
          {(['trimestres', ...(canManageMembers ? ['aprendices'] : []), ...(canCreate ? ['nuevo_proyecto'] : [])] as FichaTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => goToTab(tab)}
              className={`inline-flex items-center gap-1.5 py-2.5 text-sm font-black border-b-2 transition-all duration-200 whitespace-nowrap ${
                fichaTab === tab
                  ? 'text-blue-400 border-blue-400'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {tab === 'trimestres'     && <><Layers size={13} /> Trimestres</>}
              {tab === 'aprendices'     && <><GraduationCap size={13} /> Aprendices {aprendicesCount > 0 ? `(${aprendicesCount})` : ''}</>}
              {tab === 'nuevo_proyecto' && <><Plus size={13} /> Nuevo Proyecto</>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Inline edit form ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-zinc-700/50 bg-zinc-900/60"
          >
            <div className="px-6 md:px-10 py-5 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Editar información de la ficha</p>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Código</label>
                  <input
                    value={editForm.codigo}
                    onChange={e => setEditForm(p => ({ ...p, codigo: e.target.value }))}
                    placeholder="Ej: 2758315"
                    className={inCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Programa</label>
                  <input
                    value={editForm.programa}
                    onChange={e => setEditForm(p => ({ ...p, programa: e.target.value }))}
                    placeholder="Ej: Análisis y Desarrollo de Software"
                    className={inCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fecha inicio</label>
                  <input
                    type="date"
                    value={editForm.fecha_inicio}
                    onChange={e => setEditForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                    className={inCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fecha fin</label>
                  <input
                    type="date"
                    value={editForm.fecha_fin}
                    onChange={e => setEditForm(p => ({ ...p, fecha_fin: e.target.value }))}
                    className={inCls}
                  />
                </div>
                {instructores.length > 0 && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Instructor</label>
                    <select
                      value={editForm.instructor_id}
                      onChange={e => setEditForm(p => ({ ...p, instructor_id: e.target.value }))}
                      className={inCls}
                    >
                      <option value="">Sin instructor asignado</option>
                      {instructores.map((i: any) => (
                        <option key={i.id} value={i.id}>{i.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={updateFichaMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-all"
                >
                  <Save size={12} />
                  {updateFichaMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <div className="px-6 md:px-10 py-6">

        {/* ── Trimestres tab ── */}
        {fichaTab === 'trimestres' && !selectedTrimestre && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Layers size={14} /> Trimestres ({trimestresArr.length})</h3>
              {canManageTrim && <button onClick={() => setShowTrimModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[#3b82f6] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"><Settings size={12} /> {trimestresArr.length > 0 ? 'Reconfigurar' : 'Configurar'}</button>}
            </div>
            {loadingTrim ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(n=><div key={n} className="h-36 bg-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
              : trimestresArr.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-zinc-700/50 rounded-2xl">
                  <Layers size={32} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-black uppercase tracking-widest text-sm">Sin trimestres configurados</p>
                  {canManageTrim && <button onClick={() => setShowTrimModal(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[#3b82f6] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"><Settings size={13} /> Configurar ahora</button>}
                </div>
              ) : (
                /* 2 por fila */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trimestresArr.map((t: any) => {
                    const isDoc = t.tipo === 'documental';
                    return (
                      <motion.button key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedTrimestre(t)}
                        className={`text-left rounded-2xl border p-5 transition-all hover:scale-[1.01] hover:shadow-xl group cursor-pointer ${t.esta_finalizado ? 'border-zinc-700/50 bg-zinc-800/30 opacity-70' : isDoc ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50' : 'border-[#3b82f6]/30 bg-[#3b82f6]/5 hover:border-[#3b82f6]/50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${isDoc ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20'}`}>{isDoc ? 'Documental' : 'Desarrollo'}</span>
                          {t.esta_finalizado ? <CheckCircle2 size={14} className="text-zinc-600" /> : <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDoc ? 'text-amber-400' : 'text-[#3b82f6]'}`} />}
                        </div>
                        <p className="text-base font-black text-white mb-1">{t.nombre || `Trimestre ${t.numero}`}</p>
                        <p className="text-[11px] text-zinc-500">{fmt(t.fecha_inicio)} → {fmt(t.fecha_fin)}</p>
                        <p className={`text-[10px] font-bold mt-3 uppercase tracking-widest ${isDoc ? 'text-amber-400/60' : 'text-[#3b82f6]/60'}`}>{proyectosArr.length} proyecto{proyectosArr.length!==1?'s':''} · clic para ver →</p>
                      </motion.button>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {/* ── Proyectos del trimestre seleccionado ── */}
        {fichaTab === 'trimestres' && selectedTrimestre && (
          <div className="space-y-5">
            <button onClick={() => setSelectedTrimestre(null)} className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-bold uppercase tracking-widest"><ChevronLeft size={13} /> Trimestres</button>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${selectedTrimestre.tipo==='documental' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20'}`}>{selectedTrimestre.tipo==='documental' ? 'Documental' : 'Desarrollo'}</div>
              <div><h3 className="text-xl font-black text-white">{selectedTrimestre.nombre || `Trimestre ${selectedTrimestre.numero}`}</h3><p className="text-[11px] text-zinc-500">{fmt(selectedTrimestre.fecha_inicio)} → {fmt(selectedTrimestre.fecha_fin)}</p></div>
            </div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2"><FolderKanban size={14} /> Proyectos de la Ficha ({proyectosArr.length})</h4>
              {canCreate && <button onClick={() => goToTab('nuevo_proyecto')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[#3b82f6] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"><Plus size={13} /> Nuevo Proyecto</button>}
            </div>
            {loadingProyectos ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(n=><div key={n} className="h-40 bg-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
              : proyectosArr.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-zinc-700/50 rounded-2xl">
                  <FolderKanban size={32} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-black uppercase tracking-widest text-sm">Sin proyectos en esta ficha</p>
                  {canCreate && <button onClick={() => goToTab('nuevo_proyecto')} className="mt-4 text-[#3b82f6] text-[12px] font-bold hover:underline">+ Crear primer proyecto</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proyectosArr.map((p: any, i: number) => (
                    <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.05 }} onClick={() => onSelectProyecto(p.id)}
                      className="bg-zinc-800/50 border border-zinc-700/60 p-5 rounded-2xl hover:border-[#3b82f6]/40 hover:bg-zinc-800/80 transition-all text-left group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2.5 bg-[#3b82f6]/10 rounded-xl text-[#3b82f6] group-hover:scale-110 transition-transform"><FolderKanban size={18} /></div>
                        <Chip label={p.estado} color={STATUS_COLORS[p.estado] || STATUS_COLORS.activo} />
                      </div>
                      <h4 className="font-black text-base text-white group-hover:text-[#3b82f6] transition-colors uppercase tracking-tight line-clamp-1">{p.nombre}</h4>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{p.descripcion}</p>
                      {p.lider && <div className="flex items-center gap-1.5 mt-3"><ShieldCheck size={11} className="text-emerald-400" /><span className="text-[10px] font-bold text-emerald-400">{p.lider.nombre}</span></div>}
                      <div className="flex items-center justify-end mt-3"><span className="text-[10px] font-black text-[#3b82f6] flex items-center gap-1 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle <ChevronRight size={11} /></span></div>
                    </motion.button>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ── Aprendices tab ── */}
        {fichaTab === 'aprendices' && <AprendicesManager fichaId={fichaId} canManage={canManageMembers} />}

        {/* ── Nuevo Proyecto tab (idéntico a ProjectsPanel) ── */}
        {fichaTab === 'nuevo_proyecto' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="border-b border-zinc-600/80 pb-3 mb-6">
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Plus className="text-[#3b82f6]" size={18} /> Crear Proyecto Formativo
              </h2>
              <p className="text-[13px] text-zinc-400 font-medium mt-0.5">
                Diligencie los campos requeridos para estructurar e inicializar el nuevo portafolio.
              </p>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createProyectoMutation.mutate({
                  nombre:               fd.get('nombre') as string,
                  descripcion:          fd.get('descripcion') as string,
                  competencia:          fd.get('competencia') as string,
                  resultado_aprendizaje: fd.get('resultado_aprendizaje') as string,
                  fichaId,
                  instructorId:         f.instructor?.id,
                  liderId:              Number(fd.get('liderId')) || undefined,
                  fecha_inicio:         fd.get('fecha_inicio') as string,
                  fecha_fin:            fd.get('fecha_fin') as string,
                } as any);
              }}
              className="space-y-5 max-w-full bg-zinc-900 p-6 rounded-md"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Nombre del proyecto">
                  <input name="nombre" type="text" required placeholder="Ej: Sistema de control de inventario"
                    className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600" />
                </FormField>
                <FormField label="Líder técnico (Opcional)">
                  <select name="liderId"
                    className="w-full bg-zinc-900 border border-zinc-600 hover:bg-zinc-800 focus:bg-zinc-800 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors cursor-pointer">
                    <option value="">Asignar después</option>
                    {leaders.map((l: any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Descripción">
                <textarea name="descripcion" rows={2} placeholder="Descripción breve del proyecto..."
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors resize-none placeholder-zinc-600" />
              </FormField>

              <FormField label="Estructura inicial de trimestres">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setNumTrimestresNew(n => Math.max(1, n-1))} className="w-8 h-8 rounded-lg hover:bg-zinc-800 bg-zinc-950 border border-zinc-600 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-[13px] select-none transition-colors active:scale-95">-</button>
                  <span className="w-12 text-[13px] font-black text-zinc-200 text-center tabular-nums">{numTrimestresNew} trim.</span>
                  <button type="button" onClick={() => setNumTrimestresNew(n => Math.min(8, n+1))} className="w-8 h-8 rounded-lg hover:bg-zinc-800 bg-zinc-950 border border-zinc-600 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-[13px] select-none transition-colors active:scale-95">+</button>
                </div>
                <p className="text-[12px] text-zinc-400 mt-1 italic leading-tight">Cada bloque de trimestre se autogenerará con duración estándar de 3 meses correlativos.</p>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Competencia principal">
                  <textarea name="competencia" required rows={2} placeholder="Escriba la competencia asociada..."
                    className="w-full bg-zinc-900 border hover:bg-zinc-800 focus:bg-zinc-800 border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-600 transition-colors resize-none placeholder-zinc-600" />
                </FormField>
                <FormField label="Resultado de aprendizaje">
                  <textarea name="resultado_aprendizaje" required rows={2} placeholder="Escriba el resultado de aprendizaje..."
                    className="w-full bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-600 transition-colors resize-none placeholder-zinc-600" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Fecha de inicio de fase">
                  <input name="fecha_inicio" type="date" required className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" />
                </FormField>
                <FormField label="Fecha de finalización">
                  <input name="fecha_fin" type="date" required className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" />
                </FormField>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-600/60">
                <button type="button" onClick={() => goToTab('trimestres')} className="px-4 py-2 text-[14px] font-bold text-zinc-400 hover:text-white transition-colors bg-transparent hover:bg-zinc-800 rounded-lg">Cancelar</button>
                <button type="submit" disabled={createProyectoMutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-800 text-white text-[14px] font-black rounded-lg transition-all shadow-md active:scale-95">{createProyectoMutation.isPending ? 'Creando...' : 'Crear e Inicializar'}</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal: configurar trimestres */}
      <Modal isOpen={showTrimModal} onClose={() => setShowTrimModal(false)} title="Configurar trimestres" size="lg">
        <div className="space-y-5">
          {trimestresArr.length > 0 && <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"><AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" /><p className="text-xs text-amber-400">Los trimestres anteriores serán eliminados.</p></div>}
          <div className="space-y-2 bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-xl p-4">
            <div className="flex items-center justify-between"><label className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-[0.15em]">Número de trimestres</label><span className="text-2xl font-black text-[#3b82f6]">{numTrimFicha}</span></div>
            <input type="range" min={3} max={10} step={1} value={numTrimFicha} onChange={e => setNumTrimFicha(Number(e.target.value))} className="w-full accent-[#3b82f6] cursor-pointer" />
            <p className="text-[10px] text-zinc-500">Cada trimestre dura 3 meses · Total: {numTrimFicha*3} meses</p>
          </div>
          <button onClick={() => generateTrimMutation.mutate({ num: numTrimFicha })} disabled={generateTrimMutation.isPending} className="w-full py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">{generateTrimMutation.isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</> : `Generar ${numTrimFicha} trimestres →`}</button>
        </div>
      </Modal>
    </div>
  );
};

// ─── FichasPanel — Panel principal ────────────────────────────────────────────
export const FichasPanel = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>('todas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'con_proyectos' | 'sin_proyectos'>('todas');
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [solicitudError, setSolicitudError] = useState<string | null>(null);

  // ── Sub-navegación persistida en la URL ────────────────────────────────────
  // ?s=fichas            → lista de fichas
  // ?s=fichas&ficha=123  → detalle de la ficha 123
  // ?s=fichas&ficha=123&proyecto=456 → detalle del proyecto 456 dentro de la ficha
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFichaId    = searchParams.get('ficha')    ? Number(searchParams.get('ficha'))    : null;
  const selectedProyectoId = searchParams.get('proyecto') ? Number(searchParams.get('proyecto')) : null;

  const { data: fichas = [], isLoading } = useQuery({ queryKey: ['fichas'], queryFn: () => fichaService.getAll(), staleTime: 60000 });
  const { data: projects = [] } = useQuery({ queryKey: ['projects', 'for-role', user?.id], queryFn: () => projectService.getAll(), staleTime: 60000, enabled: !!user?.id });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });

  const instructors = (users as any[]).filter(u => u.rol === 'instructor');

  const createMutation = useMutation({
    mutationFn: fichaService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichas'] }); setMainTab('todas'); },
  });

  const deleteMutation = useMutation({
    mutationFn: fichaService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas'] }),
  });

  const solicitarMutation = useMutation({
    mutationFn: fichaService.solicitarCrear,
    onSuccess: () => { setSolicitudEnviada(true); setSolicitudError(null); },
    onError: (err: any) => { const msg = err?.response?.data?.message; setSolicitudError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al enviar la solicitud')); },
  });

  const isCoordinador = user?.rol === 'coordinador';
  const isInstructor  = user?.rol === 'instructor';

  const displayedFichas = useMemo(() => {
    if (!user) return [];
    const all = fichas as any[];
    return user.rol === 'instructor'
      ? all.filter(f => f.instructor_id === user.id || f.instructor?.id === user.id)
      : all;
  }, [fichas, user]);

  const projectsArr = projects as any[];

  const fichasConProyectos = useMemo(() => new Set(projectsArr.map(p => p.ficha?.id || p.fichaId).filter(Boolean)), [projectsArr]);

  const filteredFichas = useMemo(() => {
    let result = displayedFichas;
    if (statusFilter === 'con_proyectos')  result = result.filter(f => fichasConProyectos.has(f.id));
    if (statusFilter === 'sin_proyectos')  result = result.filter(f => !fichasConProyectos.has(f.id));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(f =>
        f.codigo?.toLowerCase().includes(q) ||
        f.programa?.toLowerCase().includes(q) ||
        f.instructor?.nombre?.toLowerCase().includes(q) ||
        projectsArr.some(p => (p.ficha?.id === f.id || p.fichaId === f.id) && p.nombre?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [displayedFichas, statusFilter, fichasConProyectos, search, projectsArr]);

  // Navegar a una ficha — empuja historial (el botón atrás del browser regresa aquí)
  const goToFicha = useCallback((id: number) => {
    setSearchParams({ s: 'fichas', ficha: String(id) });
  }, [setSearchParams]);

  // Navegar a un proyecto dentro de una ficha — empuja historial
  const goToProyecto = useCallback((id: number) => {
    setSearchParams({ s: 'fichas', ficha: String(selectedFichaId), proyecto: String(id) });
  }, [setSearchParams, selectedFichaId]);

  // Volver desde un proyecto → ficha (empuja historial)
  const backFromProyecto = useCallback(() => {
    setSearchParams({ s: 'fichas', ficha: String(selectedFichaId) });
  }, [setSearchParams, selectedFichaId]);

  // Volver desde una ficha → lista de fichas (empuja historial)
  const backFromFicha = useCallback(() => {
    setSearchParams({ s: 'fichas' });
  }, [setSearchParams]);

  // ProyectoDetalle — reemplaza el contenido del panel
  if (selectedProyectoId) {
    return <ProyectoDetalle proyectoId={selectedProyectoId} onBack={backFromProyecto} />;
  }

  return (
    <div className="w-full text-zinc-100 bg-zinc-900 min-h-screen">
      {/* ── Header principal (siempre visible) ── */}
      <div className="flex items-left bg-zinc-900 pt-10 pl-10 gap-4 flex-col border-b border-zinc-600/60">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            {isCoordinador ? 'Fichas de Formación' : 'Mis Fichas'}
          </h2>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <TabBtn active={mainTab === 'todas'} onClick={() => { setMainTab('todas'); }}>
            Todas las fichas
          </TabBtn>
          {isCoordinador && (
            <TabBtn active={mainTab === 'nueva'} onClick={() => { setMainTab('nueva'); backFromFicha(); }}>
              <Plus size={16} /> Nueva ficha
            </TabBtn>
          )}
          {isInstructor && (
            <TabBtn active={mainTab === 'solicitar'} onClick={() => { setMainTab('solicitar'); backFromFicha(); setSolicitudEnviada(false); setSolicitudError(null); }}>
              <Send size={14} /> Solicitar nueva ficha
            </TabBtn>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}

      {/* Nueva ficha (coordinador) */}
      {mainTab === 'nueva' && (
        <div className="px-6 py-6 bg-zinc-900 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="border-b border-zinc-600/80 pb-3">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2"><Plus className="text-[#3b82f6]" size={18} /> Registrar Nueva Ficha</h2>
            <p className="text-[13px] text-zinc-400 font-medium mt-0.5">Crea una ficha de formación y asigna el instructor encargado.</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMutation.mutate({ codigo: fd.get('codigo') as string, programa: fd.get('programa') as string, fecha_inicio: fd.get('fecha_inicio') as string, fecha_fin: fd.get('fecha_fin') as string, instructor_id: fd.get('instructor_id') ? Number(fd.get('instructor_id')) : undefined } as any); (e.target as HTMLFormElement).reset(); }} className="space-y-5 max-w-xl bg-zinc-900 p-6 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Código de la ficha"><input name="codigo" required placeholder="Ej: 2670687" className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600" /></FormField>
              <FormField label="Instructor encargado"><select name="instructor_id" required className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors cursor-pointer"><option value="">Selecciona un instructor</option>{instructors.map((ins:any) => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}</select></FormField>
            </div>
            <FormField label="Programa de formación"><input name="programa" required placeholder="Ej: Análisis y Desarrollo de Software" className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600" /></FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fecha de inicio"><input name="fecha_inicio" type="date" required className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" /></FormField>
              <FormField label="Fecha de fin"><input name="fecha_fin" type="date" required className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" /></FormField>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={createMutation.isPending} className="px-6 py-3 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#3b82f6]/20">{createMutation.isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</> : 'Guardar Ficha →'}</button>
              <button type="button" onClick={() => setMainTab('todas')} className="px-6 py-3 border border-zinc-600 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl transition-colors">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Solicitar nueva ficha (instructor) */}
      {mainTab === 'solicitar' && (
        <div className="px-6 md:px-10 py-8 max-w-lg animate-[fadeIn_0.2s_ease-out]">
          <div className="border-b border-zinc-600/80 pb-3 mb-6">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2"><Send size={18} className="text-blue-400" /> Solicitar permiso para crear una ficha</h2>
            <p className="text-[13px] text-zinc-400 font-medium mt-0.5">Al enviar la solicitud, el coordinador recibirá una notificación y podrá concederte acceso al formulario.</p>
          </div>

          {solicitudEnviada ? (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
              <p className="text-base font-black text-emerald-300">¡Solicitud enviada!</p>
              <p className="text-[13px] text-emerald-400/80">El coordinador recibirá tu solicitud y te notificará cuando sea aprobada. Mantente pendiente de tus notificaciones.</p>
              <button onClick={() => setSolicitudEnviada(false)} className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 font-bold hover:underline">Enviar otra solicitud</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0"><Clock size={18} className="text-blue-400" /></div>
                  <div><p className="text-sm font-black text-zinc-200">¿Cómo funciona?</p><p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">Tu solicitud llegará al coordinador como notificación. Una vez aprobada, podrás crear la ficha directamente desde aquí.</p></div>
                </div>
              </div>
              {solicitudError && <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2"><AlertTriangle size={14} className="text-rose-400" /><p className="text-xs text-rose-400 font-bold">{solicitudError}</p></div>}
              <button onClick={() => solicitarMutation.mutate()} disabled={solicitarMutation.isPending} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                {solicitarMutation.isPending ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Enviando...</> : <><Send size={15} /> Enviar solicitud al coordinador</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Todas las fichas */}
      {mainTab === 'todas' && (
        <>
          {/* Si hay ficha seleccionada → mostrar detalle inline */}
          {selectedFichaId ? (
            <FichaDetalleInline
              fichaId={selectedFichaId}
              onBack={backFromFicha}
              onSelectProyecto={goToProyecto}
            />
          ) : (
            <>
              {/* Barra de búsqueda y filtros (estilo ProjectsPanel) */}
              <div className="flex bg-zinc-900 flex-col pt-6 gap-4">
                <div className="relative mx-10">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar ficha o proyecto..."
                    className="w-full bg-zinc-900 border border-zinc-400 rounded-lg pl-10 py-3.5 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-[#3b82f6] transition-all"
                  />
                </div>
                <div className="flex mx-10 gap-6 p-1">
                  {([
                    { key: 'todas',          label: 'Todas' },
                    { key: 'con_proyectos',  label: 'Con proyectos' },
                    { key: 'sin_proyectos',  label: 'Sin proyectos' },
                  ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setStatusFilter(key)}
                      className={`px-3 py-1 rounded-md border border-zinc-600 font-bold transition-all ${statusFilter === key ? 'hover:bg-zinc-500 text-zinc-300 shadow-sm bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contador */}
              <div className="px-10 pt-8 pb-2.5 bg-zinc-900 flex items-center justify-between text-lg font-bold text-zinc-300 shrink-0">
                <span>Hay <strong>{filteredFichas.length}</strong> ficha{filteredFichas.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Tabla de fichas */}
              <div className="pb-12 mx-4">
                {isLoading ? (
                  <div className="space-y-1">{[1,2,3].map(n => <SkeletonRow key={n} />)}</div>
                ) : filteredFichas.length === 0 ? (
                  <div className="py-12 text-center text-[12px] font-medium text-zinc-500 italic bg-zinc-900 border border-zinc-600/60 rounded-md">
                    {search ? 'No se encontraron fichas ni proyectos que coincidan con la búsqueda.' : 'No hay fichas registradas.'}
                  </div>
                ) : (
                  <div className="bg-zinc-900/95 border border-zinc-600/80 rounded-md overflow-hidden shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-600 bg-zinc-950/40">
                          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Ficha</th>
                          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Instructor</th>
                          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Fechas</th>
                          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Proyectos</th>
                          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {filteredFichas.map((f: any) => {
                          const nProyectos = projectsArr.filter(p => p.ficha?.id === f.id || p.fichaId === f.id).length;
                          const matchedProjects = search.trim()
                            ? projectsArr.filter(p => (p.ficha?.id === f.id || p.fichaId === f.id) && p.nombre?.toLowerCase().includes(search.toLowerCase()))
                            : [];
                          return (
                            <tr key={f.id} onClick={() => goToFicha(f.id)} className="hover:bg-zinc-800/30 transition-colors cursor-pointer group border-b border-zinc-700/30">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center shrink-0"><Hash size={14} className="text-[#3b82f6]" /></div>
                                  <div>
                                    <p className="text-sm font-black text-white tracking-tight group-hover:text-[#3b82f6] transition-colors">{f.codigo}</p>
                                    <p className="text-[11px] text-zinc-400 font-medium line-clamp-1">{f.programa}</p>
                                    {matchedProjects.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {matchedProjects.map((p: any) => (
                                          <p key={p.id} className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                                            <ChevronRight size={10} /> {p.nombre}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {f.instructor
                                  ? <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"><User size={11} className="text-indigo-400" /></div><span className="text-[12px] font-semibold text-zinc-300">{f.instructor.nombre}</span></div>
                                  : <span className="text-[12px] text-zinc-600 italic">Sin instructor</span>}
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-[12px] font-medium text-zinc-400 tabular-nums">{f.fecha_inicio} <span className="text-zinc-600">→</span> {f.fecha_fin}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${nProyectos > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>{nProyectos} proyecto{nProyectos !== 1 ? 's' : ''}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={e => { e.stopPropagation(); goToFicha(f.id); }} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[12px] font-bold border border-zinc-600 transition-all active:scale-95">
                                    <LayoutGrid size={12} /> Ver ficha
                                  </button>
                                  {isCoordinador && (
                                    <button onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar esta ficha?')) deleteMutation.mutate(f.id); }} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 rounded-md transition-colors"><Trash2 size={13} /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
