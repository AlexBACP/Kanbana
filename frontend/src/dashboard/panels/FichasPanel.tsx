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
  AlertTriangle, Layers, Ticket, Send, Clock, LayoutGrid, Loader2,
  Pencil, X, Save, Link2,
  Github, HardDrive, Figma, BookOpen, MailX,
} from 'lucide-react';
import { fichaService } from '../../services/ficha.service';
import { InstructorCrearFichaForm } from './InstructorCrearFichaForm';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { KanbanBoard } from '../../components/KanbanBoard';
import { RejectModal } from '../../components/RejectModal';
import { UserProfileModal } from '../../components/UserProfileModal';
import { RecursosPanel } from '../../components/RecursosPanel';
import { DateTimeInput } from '../../components/DateTimeInput';
import { SolicitudesPendientesPanel } from '../../components/SolicitudesPendientesPanel';
import { ExcelAprendicesPreview, parseExcelPreview, type ExcelPreview } from '../../components/ExcelAprendicesPreview';
import { recursoService } from '../../services/recurso.service';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = 'todas' | 'nueva' | 'solicitar';
type FichaTab = 'trimestres' | 'aprendices' | 'nuevo_proyecto';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  activo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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
  <div className={`w-${size} h-${size} rounded-md bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>
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
    className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${active
      ? 'text-blue-400 border-white'
      : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
      }`}
  >
    {children}
  </button>
);

// ─── ProyectoDetalle — diseño inline estilo ProjectsPanel ────────────────────
type ProyectoTab = 'tablero' | 'equipo' | 'nueva_tarea' | 'recursos';

const ProyectoDetalle = ({ proyectoId, onBack, trimestreId }: { proyectoId: number; onBack: () => void; trimestreId?: number }) => {
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
  const [rejectingTicket, setRejectingTicket] = useState<{ id: number; titulo?: string } | null>(null);

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
    queryFn: () => fichaService.getMembers(proyFichaId!),
    staleTime: 60_000,
    enabled: tab === 'equipo' && !!proyFichaId,
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
      proyecto_id: proyectoId,
      creado_por_id: user?.id,
      sprint_id: (activeSprint as any)?.id ?? undefined,
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
  // Bug 7 fix: usar fichaService para promover/demover dentro de la ficha del proyecto
  const promoteInProjectMutation = useMutation({
    mutationFn: ({ fichaId, userId }: { fichaId: number; userId: number }) =>
      fichaService.promoteToLider(fichaId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      qc.invalidateQueries({ queryKey: ['projects', proyectoId] });
      qc.invalidateQueries({ queryKey: ['projects', 'for-me'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al promover'));
    },
  });
  const demoteInProjectMutation = useMutation({
    mutationFn: ({ fichaId, userId }: { fichaId: number; userId: number }) =>
      fichaService.demoteToAprendiz(fichaId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      qc.invalidateQueries({ queryKey: ['projects', proyectoId] });
      qc.invalidateQueries({ queryKey: ['projects', 'for-me'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al demover'));
    },
  });

  // Bug 3 fix: approve/reject para líder técnico en el tablero
  const liderApproveMut = useMutation({
    mutationFn: (ticketId: number) => ticketService.approveCompletion(ticketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', proyectoId] }),
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo aprobar la tarea.'),
  });
  const liderRejectMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      ticketService.rejectCompletion(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', proyectoId] });
      setRejectingTicket(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo rechazar la tarea.'),
  });

  // ── Skeleton / guards ─────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col h-full">
      <div className="h-[200px] bg-zinc-800/40 rounded-none animate-pulse" />
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(n => <div key={n} className="h-16 bg-zinc-800/30 rounded-md animate-pulse" />)}
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
  const esInstructor = user?.rol === 'instructor' || user?.rol === 'coordinador';
  const esLider      = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const kanbanRole   = esInstructor ? user!.rol : esLider ? 'lider_tecnico' : 'aprendiz';

  const done = ticketsArr.filter((t: any) => t.estado === 'done').length;
  const inProgress = ticketsArr.filter((t: any) => t.estado === 'in_progress').length;
  const todo = ticketsArr.filter((t: any) => t.estado === 'to_do').length;
  const progress = ticketsArr.length > 0 ? Math.round((done / ticketsArr.length) * 100) : 0;

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
      className={`flex items-center gap-2 px-5 py-3 text-[13px] font-black border-b-2 transition-all duration-200 whitespace-nowrap ${tab === id
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
      className="flex flex-col h-full overflow-y-auto"
    >
      {/* ── Info del proyecto (se desplaza con el scroll) ───────────────────── */}
      <div className="bg-zinc-900 shrink-0">
        {/* Back + info row */}
        <div className="px-6 pt-5 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-black uppercase tracking-widest mb-4"
          >
            <ChevronLeft size={13} /> Volver a la ficha
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
                <div key={s.label} className="flex flex-col items-center px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-md min-w-[52px]">
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

      </div>{/* /info del proyecto */}

      {/* ── Techo pegajoso: recursos + tabs (siempre visibles al hacer scroll) ──
          z-20: por debajo del TopBar (z-40) para no tapar el menú de perfil ── */}
      <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 shrink-0 shadow-lg shadow-black/20">
        {/* ── Recursos strip — acceso rápido siempre visible ──────────────── */}
        {(recursosArr.length > 0 || canManage) && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-t border-zinc-800/60 overflow-x-auto scrollbar-none">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest shrink-0">Recursos</span>
            {recursosArr.map((r: any) => {
              const ICONS: Record<string, any> = {
                github: Github,
                drive: HardDrive,
                figma: Figma,
                notion: BookOpen,
                trello: LayoutGrid,
                jira: Ticket,
                link: Link2,
              };
              const COLORS: Record<string, string> = {
                github: 'text-white   bg-zinc-800     border-zinc-600',
                drive: 'text-blue-400  bg-blue-500/10  border-blue-500/25',
                figma: 'text-pink-400  bg-pink-500/10  border-pink-500/25',
                notion: 'text-zinc-300 bg-zinc-700/40  border-zinc-600/40',
                trello: 'text-blue-400  bg-blue-500/10  border-blue-500/25',
                jira: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
                link: 'text-zinc-400 bg-zinc-700/30  border-zinc-600/30',
              };
              const tipo = r.tipo || 'link';
              const RIcon = ICONS[tipo] || Link2;
              const cls = COLORS[tipo] || COLORS.link;
              const isGH = tipo === 'github';
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
          <PTab id="tablero" icon={LayoutGrid} label="Tablero" />
          <PTab id="equipo" icon={Users} label={`Equipo (${miembrosArr.length})`} />
          <PTab id="recursos" icon={Link2} label="Recursos" />
          {canManage && <PTab id="nueva_tarea" icon={Plus} label="Nueva tarea" />}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <AnimatePresence mode="wait">

          {/* ── TABLERO ─────────────────────────────────────────────────────── */}
          {tab === 'tablero' && (
            <motion.div
              key="tablero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col"
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
                    onClick={() => navigate(`/projects/${proyectoId}/backlog${trimestreId ? `?trimestreId=${trimestreId}` : ''}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    <Layers size={12} /> Cola de trabajo
                  </button>
                </div>
              </div>

              {/* Kanban board — altura acotada al viewport para que las columnas
                  tengan scroll interno; el header se desplaza con el scroll de la página */}
              <div className="h-[calc(100vh-15rem)] min-h-[420px] overflow-x-auto overflow-y-hidden p-5">
                {!sprint ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
                    <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center mb-5">
                      <LayoutGrid size={28} className="text-zinc-600" />
                    </div>
                    <h3 className="text-[15px] font-black text-zinc-300 mb-2">El tablero está en espera</h3>
                    <p className="text-[12px] text-zinc-500 mb-6 leading-relaxed">
                      Activa un módulo desde la cola de trabajo para visualizar el flujo de trabajo del equipo.
                    </p>
                    <button
                      onClick={() => navigate(`/projects/${proyectoId}/backlog${trimestreId ? `?trimestreId=${trimestreId}` : ''}`)}
                      className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white text-[12px] font-black rounded-md transition-all"
                    >
                      Cola de Trabajo
                    </button>
                  </div>
                ) : ticketsLoading ? (
                  <div className="flex gap-5 h-full">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <KanbanBoard
                    tickets={filteredTickets}
                    onStatusChange={(ticketId, newStatus) =>
                      updateStatusMutation.mutate({ ticketId, status: newStatus })
                    }
                    readonly={!canManage}
                    role={kanbanRole}
                    currentUserId={user?.id}
                    onApprove={esLider ? (id) => liderApproveMut.mutate(id) : undefined}
                    onReject={esLider ? (id) => {
                      const t = filteredTickets.find((x: any) => x.id === id);
                      setRejectingTicket({ id, titulo: (t as any)?.titulo });
                    } : undefined}
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
              className="p-6"
            >
              {/* ── Layout horizontal: equipo | añadir ──────────────────────── */}
              <div className="flex gap-5 items-stretch">

                {/* ── Columna izquierda: Equipo actual ────────────────────── */}
                <div className="flex-1 min-w-0 bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-5">
                  {/* Header + filtros */}
                  <div className="flex flex-col gap-3 mb-4">
                    <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Users size={13} /> Equipo actual ({miembrosArr.length})
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['todos', 'lideres', 'aprendices'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setEquipoFilter(f)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${equipoFilter === f
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
                    <p className="text-[12px] text-zinc-500 text-center py-6">Sin integrantes asignados</p>
                  ) : filteredMiembros.length === 0 ? (
                    <p className="text-[12px] text-zinc-500 text-center py-6">Sin resultados</p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredMiembros.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-700/20 transition-all group">
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
                                  onClick={() => proyFichaId && demoteInProjectMutation.mutate({ fichaId: proyFichaId, userId: m.id })}
                                  disabled={demoteInProjectMutation.isPending || promoteInProjectMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"
                                >
                                  <Crown size={11} /> Quitar líder
                                </button>
                              ) : (
                                <button
                                  onClick={() => proyFichaId && promoteInProjectMutation.mutate({ fichaId: proyFichaId, userId: m.id })}
                                  disabled={promoteInProjectMutation.isPending || demoteInProjectMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"
                                >
                                  <Crown size={11} /> Hacer líder
                                </button>
                              )}
                              <button
                                onClick={() => removeMemberMutation.mutate(m.id)}
                                disabled={removeMemberMutation.isPending}
                                className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-30"
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

                {/* ── Columna derecha: Añadir integrantes ─────────────────── */}
                {canManage && (
                  <div className="w-72 shrink-0 bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-5">
                    <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <UserPlus size={13} /> Añadir integrantes
                    </h3>

                    {memberAddOk && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[11px] font-bold mb-3">
                        <CheckCircle2 size={13} /> Añadido(s) correctamente
                      </div>
                    )}

                    <div className="relative mb-3">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Buscar aprendices..."
                        className="pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 outline-none focus:border-primary-500/50 w-full placeholder:text-zinc-600 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                      {loadingUsers ? (
                        [1, 2, 3].map(n => <div key={n} className="h-11 bg-zinc-700/30 rounded-lg animate-pulse" />)
                      ) : addableUsers.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 text-center py-6">
                          {memberSearch ? 'Sin resultados' : 'No hay aprendices disponibles'}
                        </p>
                      ) : addableUsers.map((u: any) => {
                        const isSel = selectedMemberIds.has(u.id);
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleSelect(u.id)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left ${isSel ? 'bg-primary-600/15 border-primary-500/30' : 'bg-zinc-700/20 border-zinc-700/40 hover:border-zinc-600'}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isSel ? 'bg-primary-600 border-primary-500' : 'border-zinc-600 bg-zinc-800'}`}>
                              {isSel && <Check size={10} className="text-white" />}
                            </div>
                            <AvatarBadge nombre={u.nombre} url={u.avatar_url} size={6} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-zinc-200 truncate">{u.nombre}</p>
                              <p className="text-[9px] text-zinc-500 truncate">{u.correo}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedMemberIds.size > 0 && (
                      <button
                        onClick={() => addMemberMutation.mutate([...selectedMemberIds])}
                        disabled={addMemberMutation.isPending}
                        className="mt-3 w-full py-2.5 bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/30 hover:border-primary-500/50 disabled:opacity-40 text-primary-400 text-[11px] font-black rounded-lg uppercase tracking-widest transition-all"
                      >
                        {addMemberMutation.isPending
                          ? 'Añadiendo...'
                          : `Añadir ${selectedMemberIds.size} integrante${selectedMemberIds.size > 1 ? 's' : ''}`}
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
              className="p-6"
            >
              <div className="max-w-lg">
                {/* Sprint activo info */}
                <div className={`flex items-center gap-2 p-3 rounded-md text-[11px] font-bold mb-6 ${sprint ? 'bg-emerald-500/8 border border-emerald-500/15 text-emerald-400' : 'bg-amber-500/8 border border-amber-500/15 text-amber-400'}`}>
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
                      titulo: f.get('titulo') as string,
                      descripcion: (f.get('descripcion') as string) || '',
                      tipo: f.get('tipo') as string,
                      prioridad: f.get('prioridad') as string,
                      asignado_a_id: asignadoRaw ? Number(asignadoRaw) : undefined,
                      fecha_limite: (f.get('fecha_limite') as string) || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <FormField label="Título *">
                    <input
                      name="titulo"
                      required
                      placeholder="Descripción breve de la tarea"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
                    />
                  </FormField>

                  <FormField label="Descripción">
                    <textarea
                      name="descripcion"
                      rows={3}
                      placeholder="Detalles, criterios de aceptación..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-zinc-600"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Tipo">
                      <select name="tipo" defaultValue="task"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="task">✅ Tarea</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="story">📖 Historia</option>
                      </select>
                    </FormField>
                    <FormField label="Prioridad">
                      <select name="prioridad" defaultValue="media"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Media</option>
                        <option value="baja">🟢 Baja</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Asignar a">
                    <select name="asignado_a_id"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50 transition-colors"
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
                    <DateTimeInput
                      name="fecha_limite"
                      withTime={true}
                      timeName="hora_limite"
                      min={(activeSprint as any)?.fecha_inicio?.toString().slice(0, 10)}
                      max={(activeSprint as any)?.fecha_fin?.toString().slice(0, 10)}
                      rangeLabel={(activeSprint as any)?.nombre ? `Dentro de "${(activeSprint as any).nombre}"` : undefined}
                    />
                  </FormField>

                  {ticketFormError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
                      <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                      <p className="text-xs text-rose-400">{ticketFormError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={createTicketMutation.isPending}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-md text-xs transition-all flex items-center justify-center gap-2"
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
              className="min-h-[60vh]"
            >
              <RecursosPanel proyectoId={proyectoId} canManage={canManage} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── RejectModal (líder técnico rechaza tarea en revisión) ───────── */}
      <RejectModal
        ticket={rejectingTicket}
        onClose={() => setRejectingTicket(null)}
        onReject={(id, motivo) => liderRejectMut.mutate({ id, motivo: motivo || undefined })}
        isPending={liderRejectMut.isPending}
      />

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
const MemberRow = ({ member, canManage, isLider, onPromote, onDemote, onRemove, onProfile, onResend, isLoading }: any) => {
  const pendingConfirm = !(member.cuenta_confirmada ?? true);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-zinc-800/40 transition-all group">
      <button onClick={onProfile} className="shrink-0 hover:opacity-80 transition-opacity">
        <AvatarBadge nombre={member.nombre} url={member.avatar_url} size={7} />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onProfile}>
        <p className="text-xs font-bold text-zinc-200 truncate hover:text-primary-400 transition-colors">{member.nombre}</p>
        <p className="text-[10px] text-zinc-500 truncate">{member.correo}</p>
        {pendingConfirm && member.correo_entrega_estado !== 'rebotado' && (
          <span className="text-[9px] font-black text-amber-400 flex items-center gap-0.5 mt-0.5">
            ● Cuenta pendiente de confirmación
          </span>
        )}
        {member.correo_entrega_estado === 'rebotado' && (
          <span className="text-[9px] font-black text-rose-400 flex items-center gap-1 mt-0.5">
            ✕ El correo rebotó — buzón inexistente
          </span>
        )}
      </div>
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border uppercase tracking-widest shrink-0 ${isLider ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{isLider ? 'Líder' : 'Aprendiz'}</span>
      {canManage && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {pendingConfirm && onResend && (
            <button onClick={onResend} disabled={isLoading} title="Reenviar correo de confirmación" className="flex items-center gap-1 px-2 py-1 rounded-md text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-40 text-[10px] font-bold">
              <Send size={11} /> Reenviar
            </button>
          )}
          {isLider
            ? <button onClick={onDemote} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded-md text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"><Crown size={11} /> Quitar líder</button>
            : <button onClick={onPromote} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 text-[10px] font-bold"><Crown size={11} /> Hacer líder</button>}
          <button onClick={onRemove} disabled={isLoading} className="p-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"><UserMinus size={12} /></button>
        </div>
      )}
    </div>
  );
};

// ─── AprendicesManager ────────────────────────────────────────────────────────
const AprendicesManager = ({ fichaId, fichaCode, canManage }: { fichaId: number; fichaCode?: string; canManage: boolean }) => {
  const qc = useQueryClient();
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [activeTab,      setActiveTab]      = useState<'invitar' | 'excel'>('invitar');
  const [inviteForm,     setInviteForm]     = useState({ nombre: '', correo: '', documento: '' });
  const [inviteSuccess,  setInviteSuccess]  = useState(false);
  const [inviteError,    setInviteError]    = useState<string | null>(null);
  const [excelFile,      setExcelFile]      = useState<File | null>(null);
  const [dragOver,       setDragOver]       = useState(false);
  const [importResult,   setImportResult]   = useState<{ created: number; linked: number; errors: { fila: number; correo: string; reason: string }[] } | null>(null);
  const [excelPreview,   setExcelPreview]   = useState<ExcelPreview | null>(null);
  const [excelParsing,   setExcelParsing]   = useState(false);
  const [filterRole,     setFilterRole]     = useState<'todos' | 'lideres' | 'aprendices'>('todos');
  const [mainSearch,     setMainSearch]     = useState('');
  const [profileUserId,  setProfileUserId]  = useState<number | null>(null);
  // ── Confirmación masiva ──────────────────────────────────────────────────────
  const [confirmMode,    setConfirmMode]    = useState(false);
  const [confirmSelIds,  setConfirmSelIds]  = useState<Set<number>>(new Set());

  const { data: members = [], isLoading: loadingMembers } = useQuery({ queryKey: ['fichas', fichaId, 'members'], queryFn: () => fichaService.getMembers(fichaId), staleTime: 30000 });
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
  const reenviarMutation = useMutation({
    mutationFn: (userId: number) => fichaService.reenviarInvitacion(fichaId, userId),
    onSuccess: () => alert('Correo de confirmación reenviado correctamente.'),
    onError: (err: any) => { const msg = err?.response?.data?.message; alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al reenviar')); },
  });
  const confirmBulkMutation = useMutation({
    mutationFn: (ids: number[]) => userService.confirmBulk(ids),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
      setConfirmMode(false);
      setConfirmSelIds(new Set());
      const n = result.confirmed.length;
      if (n > 0) alert(`✓ ${n} cuenta${n !== 1 ? 's' : ''} confirmada${n !== 1 ? 's' : ''} correctamente.`);
    },
    onError: (err: any) => { const msg = err?.response?.data?.message; alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al confirmar')); },
  });

  const revisarRebotesMutation = useMutation({
    mutationFn: () => userService.revisarRebotes(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
      if (r.rebotados > 0) {
        alert(`📭 Se detectaron ${r.rebotados} correo(s) rebotado(s):\n${r.correos.join('\n')}`);
      } else {
        alert('✓ No se encontraron rebotes nuevos.');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(msg || 'No se pudo revisar rebotes. Verifica que IMAP esté habilitado en la cuenta de correo.');
    },
  });

  const membersArr = members as any[];
  const rebotadosCount = membersArr.filter((m: any) => m.correo_entrega_estado === 'rebotado').length;

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

  const toggleConfirmSel  = (id: number) => setConfirmSelIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pendingMembers    = membersArr.filter((m: any) => m.rol === 'aprendiz' && !(m.cuenta_confirmada ?? true));
  const pendingCount      = pendingMembers.length;

  const handleFileDrop = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) return;
    setExcelFile(file);
    setImportResult(null);
    setExcelPreview(null);
    setExcelParsing(true);
    try {
      const p = await parseExcelPreview(file);
      setExcelPreview(p);
    } catch {
      setExcelPreview(null);
    } finally {
      setExcelParsing(false);
    }
  };

  const lideres = membersArr.filter(m => m.rol === 'aprendiz' && m.es_lider_tecnico);
  const aprendices = membersArr.filter(m => m.rol === 'aprendiz' && !m.es_lider_tecnico);

  return (
    <div className="space-y-4">
      {/* Solicitudes pendientes (aprendices auto-registrados) */}
      {canManage && fichaCode && (
        <SolicitudesPendientesPanel fichaId={fichaId} fichaCode={fichaCode} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <GraduationCap size={13} /> Aprendices de la Ficha ({membersArr.filter((m: any) => m.rol === 'aprendiz').length})
        </h3>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => revisarRebotesMutation.mutate()}
              disabled={revisarRebotesMutation.isPending}
              title="Revisa la bandeja de correo en busca de mensajes rebotados"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-md text-[10px] font-black uppercase tracking-widest hover:text-zinc-200 hover:border-zinc-600 transition-all disabled:opacity-50"
            >
              {revisarRebotesMutation.isPending
                ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full" /> Revisando...</>
                : <><MailX size={12} /> Revisar rebotes{rebotadosCount > 0 ? ` (${rebotadosCount})` : ''}</>}
            </button>
            <button
              onClick={() => { setShowAddModal(true); setImportResult(null); setExcelFile(null); setInviteForm({ nombre: '', correo: '', documento: '' }); setInviteSuccess(false); setInviteError(null); setActiveTab('invitar'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/10 border border-primary-500/20 text-primary-400 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/20 transition-all"
            >
              <UserPlus size={12} /> Agregar Aprendices
            </button>
          </div>
        )}
      </div>

      {/* ── Banner de confirmación masiva (aparece cuando hay pendientes) ───── */}
      {canManage && pendingCount > 0 && !confirmMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-md flex-wrap">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <p className="text-[12px] font-black text-amber-300 flex-1">
            {pendingCount} cuenta{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de confirmación
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => confirmBulkMutation.mutate(pendingMembers.map((m: any) => m.id))}
              disabled={confirmBulkMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-md text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {confirmBulkMutation.isPending
                ? <><span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" /> Confirmando...</>
                : <><CheckCircle2 size={11} /> Confirmar todas</>}
            </button>
            <button
              onClick={() => { setConfirmMode(true); setConfirmSelIds(new Set()); }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 rounded-md text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Seleccionar
            </button>
          </div>
        </div>
      )}

      {/* ── Barra de acción en modo selección ───────────────────────────────── */}
      {canManage && confirmMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/25 rounded-md flex-wrap">
          <p className="text-[12px] font-black text-blue-300 flex-1">
            {confirmSelIds.size > 0
              ? `${confirmSelIds.size} seleccionada${confirmSelIds.size !== 1 ? 's' : ''}`
              : 'Haz clic en las cuentas pendientes para seleccionarlas'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmSelIds(new Set(pendingMembers.map((m: any) => m.id)))}
              className="px-2.5 py-1.5 text-[10px] font-black text-blue-400 hover:underline uppercase tracking-widest"
            >
              Todas ({pendingCount})
            </button>
            <button
              onClick={() => confirmBulkMutation.mutate([...confirmSelIds])}
              disabled={confirmSelIds.size === 0 || confirmBulkMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all"
            >
              {confirmBulkMutation.isPending
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirmando...</>
                : <><CheckCircle2 size={11} /> Confirmar</>}
            </button>
            <button
              onClick={() => { setConfirmMode(false); setConfirmSelIds(new Set()); }}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Búsqueda — full width */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={mainSearch}
          onChange={e => setMainSearch(e.target.value)}
          placeholder="Buscar aprendiz por nombre o correo..."
          className="w-full pl-9 pr-3 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-lg text-[12px] text-zinc-300 outline-none focus:border-primary-500/50 placeholder:text-zinc-600 transition-colors"
        />
      </div>

      {/* Filtros — debajo del buscador */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['todos', 'lideres', 'aprendices'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterRole(f)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${filterRole === f
              ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
              : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
          >
            {f === 'todos' ? `Todos (${membersArr.filter((m: any) => m.rol === 'aprendiz').length})` : f === 'lideres' ? `Líderes (${lideres.length})` : `Aprendices (${aprendices.length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loadingMembers
        ? <div className="space-y-2">{[1, 2, 3].map(n => <div key={n} className="h-12 bg-zinc-800/40 rounded-md animate-pulse" />)}</div>
        : membersArr.filter((m: any) => m.rol === 'aprendiz').length === 0
          ? <div className="text-center py-8 bg-zinc-800/20 rounded-md border border-dashed border-zinc-700"><GraduationCap size={24} className="mx-auto text-zinc-600 mb-2 opacity-30" /><p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sin aprendices vinculados</p></div>
          : filteredMembers.length === 0
            ? <p className="text-[12px] text-zinc-500 text-center py-6">Sin resultados</p>
            : <div className="space-y-1">
              {filteredMembers.map((m: any) => {
                const isPending = !(m.cuenta_confirmada ?? true);
                const isConfirmSelected = confirmSelIds.has(m.id);
                return (
                  <div key={m.id} className="relative">
                    {/* Checkbox de selección (solo en modo confirmación y cuenta pendiente) */}
                    {confirmMode && isPending && (
                      <button
                        onClick={() => toggleConfirmSel(m.id)}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-5 h-5 rounded border flex items-center justify-center transition-all ${isConfirmSelected ? 'bg-blue-600 border-blue-500' : 'bg-zinc-800 border-zinc-600 hover:border-blue-500'}`}
                      >
                        {isConfirmSelected && <Check size={11} className="text-white" />}
                      </button>
                    )}
                    <div className={confirmMode && isPending ? 'ml-6 transition-all' : ''}>
                      <MemberRow
                        member={m}
                        canManage={canManage && !confirmMode}
                        isLider={m.es_lider_tecnico}
                        onProfile={() => !confirmMode && setProfileUserId(m.id)}
                        onPromote={() => { if (confirm(`¿Promover a ${m.nombre} como Líder Técnico?`)) promoteMutation.mutate(m.id); }}
                        onDemote={() => demoteMutation.mutate(m.id)}
                        onRemove={() => { if (confirm(`¿Desvincular a ${m.nombre}?`)) removeMemberMutation.mutate(m.id); }}
                        onResend={() => reenviarMutation.mutate(m.id)}
                        isLoading={promoteMutation.isPending || demoteMutation.isPending || removeMemberMutation.isPending || reenviarMutation.isPending}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
      }

      {/* UserProfileModal */}
      <AnimatePresence>
        {profileUserId && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>

      {/* ── Aside deslizante — Agregar Aprendices ─────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <>
            {/* Fondo oscuro */}
            <motion.div
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setImportResult(null); setExcelFile(null); }}
            />
            {/* Panel lateral */}
            <motion.aside
              className="fixed top-0 right-0 h-full w-full max-w-[440px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* Cabecera */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary-600/15 border border-primary-500/25 flex items-center justify-center">
                    <UserPlus size={15} className="text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-zinc-100">Agregar Aprendices</h2>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setImportResult(null); setExcelFile(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-5 pt-5 shrink-0">
                <div className="flex gap-1 p-1 bg-zinc-900/80 rounded-md border border-zinc-800">
                  {(['invitar', 'excel'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab
                          ? tab === 'invitar'
                            ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                            : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-zinc-500 hover:text-zinc-100'
                      }`}
                    >
                      {tab === 'invitar' ? <><UserPlus size={12} /> Invitar nuevo</> : <><FileSpreadsheet size={12} /> Excel masivo</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenido (scrollable) */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {activeTab === 'invitar' && (
                  <div className="space-y-4">
                    <div className="px-4 py-3 bg-primary-500/8 border border-primary-500/20 rounded-md">
                      <p className="text-[11px] font-black text-primary-400 uppercase tracking-widest">Crear cuenta y enviar invitación</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Se crea la cuenta con la cédula como contraseña inicial.</p>
                    </div>
                    {inviteSuccess && (
                      <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <p className="text-xs text-emerald-400 font-bold">¡Aprendiz invitado! Correo de confirmación enviado.</p>
                      </div>
                    )}
                    {inviteError && (
                      <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-md flex items-center gap-2">
                        <AlertTriangle size={14} className="text-rose-400" />
                        <p className="text-xs text-rose-400 font-bold">{inviteError}</p>
                      </div>
                    )}
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (!inviteForm.nombre.trim() || !inviteForm.correo.trim() || !inviteForm.documento.trim()) {
                          setInviteError('Todos los campos son obligatorios');
                          return;
                        }
                        setInviteError(null);
                        setInviteSuccess(false);
                        inviteMutation.mutate(inviteForm);
                      }}
                      className="space-y-3"
                    >
                      {([
                        { key: 'nombre' as const,    label: 'Nombre completo',    placeholder: 'Juan Pérez García', type: 'text'  },
                        { key: 'correo' as const,    label: 'Correo electrónico', placeholder: 'juan@sena.edu.co', type: 'email' },
                        { key: 'documento' as const, label: 'Cédula / documento', placeholder: '1234567890',       type: 'number'  },
                      ] as const).map(({ key, label, placeholder, type }) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
                          <input
                            type={type}
                            value={inviteForm[key]}
                            onChange={e => setInviteForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="input-dark w-full text-sm"
                          />
                          {/* Verificación de Gmail en vivo bajo el campo de correo */}
                          {key === 'correo' && inviteForm.correo.trim() && (() => {
                            const c = inviteForm.correo.trim().toLowerCase();
                            if (!/^\S+@\S+\.\S+$/.test(c)) return null;
                            const esGmail = /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i.test(c);
                            return esGmail
                              ? <p className="text-[10px] text-emerald-400 flex items-center gap-1 ml-1"><CheckCircle2 size={10} /> Correo Gmail válido</p>
                              : <p className="text-[10px] text-amber-400 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> No es un correo Gmail — no podrá iniciar sesión con Google.</p>;
                          })()}
                        </div>
                      ))}
                      <button
                        type="submit"
                        disabled={inviteMutation.isPending}
                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white font-black uppercase tracking-widest rounded-md text-xs transition-all flex items-center justify-center gap-2"
                      >
                        {inviteMutation.isPending
                          ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Enviando...</>
                          : <><UserPlus size={13} /> Crear cuenta y enviar correo</>}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'excel' && (
                  <div className="space-y-4">
                    <div className="px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-md space-y-1">
                      <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Importación masiva Excel</p>
                      <p className="text-[10px] text-zinc-500">Columnas: <strong className="text-zinc-100">nombre</strong>, <strong className="text-zinc-100">correo</strong>, <strong className="text-zinc-100">cedula</strong></p>
                      <p className="text-[10px] text-amber-400/70">⚠ Se envía correo de confirmación a cada aprendiz.</p>
                    </div>
                    <button
                      onClick={() => fichaService.downloadTemplate().catch(() => alert('Error al descargar'))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900/60 border border-zinc-800 hover:border-primary-500/30 text-zinc-500 hover:text-primary-400 rounded-md text-xs font-black uppercase tracking-widest transition-all"
                    >
                      <Download size={13} /> Descargar plantilla .xlsx
                    </button>
                    {!importResult && (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}
                        className={`relative border-2 border-dashed rounded-md p-8 text-center transition-all cursor-pointer ${dragOver ? 'border-emerald-500/60 bg-emerald-500/8' : excelFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 hover:border-primary-500/30 bg-zinc-900/30'}`}
                        onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv'; input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileDrop(f); }; input.click(); }}
                      >
                        {excelFile
                          ? <div className="space-y-2">
                              <div className="w-12 h-12 bg-emerald-500/10 rounded-md flex items-center justify-center mx-auto"><FileSpreadsheet size={22} className="text-emerald-400" /></div>
                              <p className="text-sm font-black text-emerald-400">{excelFile.name}</p>
                              <button onClick={e => { e.stopPropagation(); setExcelFile(null); setExcelPreview(null); }} className="text-[10px] text-rose-400 hover:underline font-bold">Cambiar archivo</button>
                            </div>
                          : <div className="space-y-3">
                              <div className="w-12 h-12 bg-zinc-700/50 rounded-md flex items-center justify-center mx-auto"><Upload size={20} className="text-zinc-500" /></div>
                              <div><p className="text-sm font-black text-zinc-100">Arrastra tu archivo aquí</p><p className="text-[10px] text-zinc-500 mt-1">o haz clic · .xlsx, .xls, .csv</p></div>
                            </div>}
                      </div>
                    )}

                    {/* Preview del Excel antes de importar */}
                    {!importResult && excelParsing && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-zinc-500">
                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-zinc-600/30 border-t-zinc-400 rounded-full" /> Analizando archivo…
                      </div>
                    )}
                    {!importResult && !excelParsing && excelPreview && (
                      <ExcelAprendicesPreview preview={excelPreview} />
                    )}
                    {importResult && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3 text-center">
                            <p className="text-2xl font-black text-emerald-400">{importResult.created}</p>
                            <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">Creados</p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-center">
                            <p className="text-2xl font-black text-blue-400">{importResult.linked}</p>
                            <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-wider">Vinculados</p>
                          </div>
                        </div>
                        {importResult.errors.length > 0 && (
                          <div className="bg-amber-500/8 border border-amber-500/20 rounded-md p-3">
                            <p className="text-[11px] font-black text-amber-400 flex items-center gap-1.5 mb-1.5"><AlertTriangle size={12} /> {importResult.errors.length} fila(s) con errores</p>
                            {importResult.errors.map((e, i) => <p key={i} className="text-[10px] text-amber-400/80">Fila {e.fila}: {e.reason}</p>)}
                          </div>
                        )}
                        <button onClick={() => { setImportResult(null); setExcelFile(null); setExcelPreview(null); }} className="w-full py-2.5 bg-zinc-900/60 border border-zinc-800 text-zinc-500 hover:text-zinc-100 rounded-md text-xs font-black uppercase tracking-widest transition-all">
                          Importar otro archivo
                        </button>
                      </div>
                    )}
                    {!importResult && (
                      <button
                        onClick={() => { if (excelFile) importExcelMutation.mutate(excelFile); }}
                        disabled={!excelFile || importExcelMutation.isPending || (excelPreview != null && excelPreview.total === 0)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black uppercase tracking-widest rounded-md text-xs transition-all flex items-center justify-center gap-2"
                      >
                        {importExcelMutation.isPending
                          ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Importando...</>
                          : excelPreview && excelPreview.total > 0
                            ? <><FileSpreadsheet size={14} /> Importar {excelPreview.total} aprendiz{excelPreview.total !== 1 ? 'es' : ''}</>
                            : <><FileSpreadsheet size={14} /> {excelFile ? 'Importar aprendices' : 'Selecciona un archivo primero'}</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── FichaDetalle (inline — sin header propio) ────────────────────────────────
const FichaDetalleInline = ({
  fichaId, onBack, onSelectProyecto,
}: { fichaId: number; onBack: () => void; onSelectProyecto: (id: number, trimestreId?: number) => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [fichaTab, setFichaTab] = useState<FichaTab>('trimestres');
  const [selectedTrimestre, setSelectedTrimestre] = useState<any | null>(null);
  // (showTrimModal/numTrimFicha eliminados — los trimestres se generan automáticamente desde la ficha)

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    codigo: '', programa: '', fecha_inicio: '', fecha_fin: '', instructor_id: '', jornada: 'mañana',
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', { fichaId }] });
      goToTab('trimestres');
    },
  });

  // (generateTrimMutation eliminado — los trimestres se generan automáticamente al crear la ficha)

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
      codigo: f.codigo ?? '',
      programa: f.programa ?? '',
      fecha_inicio: f.fecha_inicio ? f.fecha_inicio.slice(0, 10) : '',
      fecha_fin: f.fecha_fin ? f.fecha_fin.slice(0, 10) : '',
      instructor_id: f.instructor_id ? String(f.instructor_id) : '',
      jornada: f.jornada ?? 'mañana',
    });
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const dto: any = {
      codigo: editForm.codigo,
      programa: editForm.programa,
      jornada: editForm.jornada,
      fecha_inicio: editForm.fecha_inicio || undefined,
      fecha_fin: editForm.fecha_fin || undefined,
      // Solo el coordinador puede cambiar el instructor asignado
      ...(user?.rol === 'coordinador'
        ? { instructor_id: editForm.instructor_id ? Number(editForm.instructor_id) : null }
        : {}),
    };
    updateFichaMutation.mutate(dto);
  };

  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const canManageMembers = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const aprendicesCount = (fichaMembers as any[]).filter(u => u.rol === 'aprendiz').length;
  const proyectosArr = proyectos as any[];
  const trimestresArr = trimestres as any[];

  if (loadingFicha) return <div className="p-6 space-y-4">{[1, 2].map(n => <div key={n} className="h-36 bg-zinc-800/40 rounded-md animate-pulse" />)}</div>;
  if (!ficha) return null;
  const f = ficha as any;

  // instructores disponibles para el select (solo si canCreate)
  const instructores = (allUsers as any[]).filter((u: any) => u.rol === 'instructor');
  const inCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600 transition-colors';

  // ── Métricas de la ficha para el banner del coordinador ───────────────────
  const fichaActivos = proyectosArr.filter((p: any) => p.estado === 'activo').length;
  const fichaPausados = proyectosArr.filter((p: any) => p.estado === 'pausado').length;
  const fichaAvancePct = proyectosArr.length > 0
    ? Math.round(proyectosArr.reduce((sum: number, p: any) => sum + (p.avance ?? 0), 0) / proyectosArr.length)
    : 0;

  return (
    <div className="animate-[fadeIn_0.2s_ease-out] ">
      <div className="min-w-0 mt-3 flex justify-between gap-4 felx-col-2 mr-6 ml-5 rounded">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-bold uppercase tracking-widest mb-2"
          >
            <ChevronLeft size={19} /> Fichas
          </button>
        </div>
        <div>
          {canCreate && !isEditing && (
            <button
              onClick={() => openEdit(f)}
              title="Editar ficha"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-all text-[12px] font-black shrink-0"
            >
              <Pencil size={15} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* ── Banner de métricas (solo coordinador) ─────────────────────────── */}
      {user?.rol === 'coordinador' && (
        <div className="relative overflow-hidden mx-6 mt-1 mb-0 rounded-md p-5 text-white shadow-lg bg-gradient-to-br from-emerald-700 via-teal-800 to-teal-950">
          {/* SVG de fondo */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polygon points="100,16 128,32 128,64 100,80 72,64 72,32" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8" />
              <polygon points="150,56 178,72 178,104 150,120 122,104 122,72" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              <polygon points="50,56 78,72 78,104 50,120 22,104 22,72" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              <line x1="128" y1="48" x2="150" y2="72" stroke="currentColor" strokeWidth="1" opacity="0.5" />
              <line x1="72" y1="48" x2="50" y2="72" stroke="currentColor" strokeWidth="1" opacity="0.5" />
              <circle cx="100" cy="48" r="4" fill="currentColor" opacity="0.7" />
              <circle cx="150" cy="88" r="3" fill="currentColor" opacity="0.5" />
              <circle cx="50" cy="88" r="3" fill="currentColor" opacity="0.5" />
            </svg>

          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">
                Ficha de Formación
              </p>
              <h2 className="text-[22px] font-black leading-tight text-white">
                #{f.codigo} — {f.programa}
              </h2>
              {f.instructor && (
                <p className="text-[14px] text-emerald-100 mt-0.5">
                  <span className='font-bold text-white'>Instructor :</span> {f.instructor.nombre}
                </p>
              )}
              <div className='flex flew-col-2 gap-16'>
                {(f.fecha_inicio || f.fecha_fin) && (
                  <span className="text-[13px] text-zinc-500 flex items-center gap-1">
                    <Calendar size={10} />
                    {fmt(f.fecha_inicio)} → {fmt(f.fecha_fin)}
                  </span>
                )}
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  {/* Jornada */}
                  {f.jornada && (
                    <span className="text-[11px] font-bold flex items-center gap-1 capitalize text-amber-300">
                      {f.jornada === 'mañana' ? '🌅' : f.jornada === 'tarde' ? '☀️' : '🌙'} {f.jornada}
                    </span>
                  )}
                  <span className="text-[11px] text-blue-400 font-bold flex items-center gap-1">
                    <GraduationCap size={11} />
                    {aprendicesCount} aprendiz{aprendicesCount !== 1 ? 'ces' : ''}
                  </span>
                </div>
              </div>
            </div>
            {/* Métricas rápidas */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'Proyectos', value: proyectosArr.length, color: 'text-white' },
                { label: 'Activos', value: fichaActivos, color: 'text-emerald-300' },
                { label: 'En pausa', value: fichaPausados, color: 'text-amber-300' },
                { label: 'Aprendices', value: aprendicesCount, color: 'text-cyan-300' },
                { label: 'Avance', value: `${fichaAvancePct}%`, color: 'text-white' },
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

      {/* ── Sub-cabecera: título arriba, tabs abajo ─────────────────────── */}
      <div className="bg-zinc-900 border-b border-zinc-700/50 shrink-0">

        {/* Fila 1: Breadcrumb + título + detalles + botón editar */}


        {/* Fila 2: tabs en línea */}
        <div className="flex items-center px-4 md:px-6 border-t border-zinc-800/60 overflow-x-auto">
          {(['trimestres', ...(canManageMembers ? ['aprendices'] : []), ...(canCreate ? ['nuevo_proyecto'] : [])] as FichaTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => goToTab(tab)}
              className={`flex items-center gap-1.5 px-5 py-3 text-[13px] font-black border-b-2 transition-all duration-200 whitespace-nowrap ${fichaTab === tab
                ? 'text-blue-400 border-blue-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
                }`}
            >
              {tab === 'trimestres' && <><Layers size={19} /> Trimestres</>}
              {tab === 'aprendices' && <><GraduationCap size={19} /> Aprendices </>}
              {tab === 'nuevo_proyecto' && <><Plus size={19} /> Nuevo Proyecto</>}
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
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Jornada</label>
                  <select
                    value={editForm.jornada}
                    onChange={e => setEditForm(p => ({ ...p, jornada: e.target.value }))}
                    className={inCls}
                  >
                    <option value="mañana">🌅 Mañana</option>
                    <option value="tarde">☀️ Tarde</option>
                    <option value="noche">🌙 Noche</option>
                  </select>
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
                {/* Solo el coordinador puede reasignar el instructor de una ficha */}
                {user?.rol === 'coordinador' && instructores.length > 0 && (
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
                  className="px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-widest bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={updateFichaMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-widest bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-all"
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
            </div>
            {loadingTrim ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(n => <div key={n} className="h-36 bg-zinc-800/40 rounded-md animate-pulse" />)}</div>
              : trimestresArr.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-zinc-700/50 rounded-lg">
                  <Layers size={32} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-black uppercase tracking-widest text-sm">Los trimestres se generaron al crear la ficha</p>
                  <p className="text-zinc-600 text-[12px] mt-1">Si no aparecen, recarga la página</p>
                </div>
              ) : (
                /* 2 por fila */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trimestresArr.map((t: any) => {
                    const isDoc = t.tipo === 'documental';
                    return (
                      <motion.button key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedTrimestre(t)}
                        className={`text-left rounded-md border p-5 transition-all hover:scale-[1.01] hover:shadow-xl group cursor-pointer ${t.esta_finalizado ? 'border-zinc-700/50 bg-zinc-800/30 opacity-70' : isDoc ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50' : 'border-[#3b82f6]/30 bg-[#3b82f6]/5 hover:border-[#3b82f6]/50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${isDoc ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20'}`}>{isDoc ? 'Documental' : 'Desarrollo'}</span>
                          {t.esta_finalizado ? <CheckCircle2 size={14} className="text-zinc-600" /> : <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDoc ? 'text-amber-400' : 'text-[#3b82f6]'}`} />}
                        </div>
                        <p className="text-base font-black text-white mb-1">{t.nombre || `Trimestre ${t.numero}`}</p>
                        <p className="text-[11px] text-zinc-500">{fmt(t.fecha_inicio)} → {fmt(t.fecha_fin)}</p>
                        <p className={`text-[10px] font-bold mt-3 uppercase tracking-widest ${isDoc ? 'text-amber-400/60' : 'text-[#3b82f6]/60'}`}>Clic para ver proyectos →</p>
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
              <div className={`px-3 py-1.5 rounded-md border text-[10px] font-black uppercase tracking-widest ${selectedTrimestre.tipo === 'documental' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20'}`}>{selectedTrimestre.tipo === 'documental' ? 'Documental' : 'Desarrollo'}</div>
              <div><h3 className="text-xl font-black text-white">{selectedTrimestre.nombre || `Trimestre ${selectedTrimestre.numero}`}</h3><p className="text-[11px] text-zinc-500">{fmt(selectedTrimestre.fecha_inicio)} → {fmt(selectedTrimestre.fecha_fin)}</p></div>
            </div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2"><FolderKanban size={14} /> Proyectos de la Ficha ({proyectosArr.length})</h4>
              {canCreate && <button onClick={() => goToTab('nuevo_proyecto')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[#3b82f6] rounded-md text-[11px] font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"><Plus size={13} /> Nuevo Proyecto</button>}
            </div>
            {loadingProyectos ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3].map(n => <div key={n} className="h-40 bg-zinc-800/40 rounded-md animate-pulse" />)}</div>
              : proyectosArr.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-zinc-700/50 rounded-md">
                  <FolderKanban size={32} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-black uppercase tracking-widest text-sm">Sin proyectos en esta ficha</p>
                  {canCreate && <button onClick={() => goToTab('nuevo_proyecto')} className="mt-4 text-[#3b82f6] text-[12px] font-bold hover:underline">+ Crear primer proyecto</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proyectosArr.map((p: any, i: number) => (
                    <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onSelectProyecto(p.id, selectedTrimestre?.id)}
                      className="bg-zinc-800/50 border border-zinc-700/60 p-5 rounded-md hover:border-[#3b82f6]/40 hover:bg-zinc-800/80 transition-all text-left group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2.5 bg-[#3b82f6]/10 rounded-md text-[#3b82f6] group-hover:scale-110 transition-transform"><FolderKanban size={18} /></div>
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
        {fichaTab === 'aprendices' && <AprendicesManager fichaId={fichaId} fichaCode={ficha?.codigo} canManage={canManageMembers} />}

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
                const desc = (fd.get('descripcion') as string) || (fd.get('competencia') as string) || '';
                createProyectoMutation.mutate({
                  nombre:                fd.get('nombre') as string,
                  descripcion:           desc,
                  competencia:           fd.get('competencia') as string,
                  resultado_aprendizaje: fd.get('resultado_aprendizaje') as string,
                  fichaId,
                  instructorId: f.instructor?.id,
                  liderId: Number(fd.get('liderId')) || undefined,
                  // Las fechas las auto-deriva el backend de la ficha (fichaId)
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

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-600/60">
                <button type="button" onClick={() => goToTab('trimestres')} className="px-4 py-2 text-[14px] font-bold text-zinc-400 hover:text-white transition-colors bg-transparent hover:bg-zinc-800 rounded-lg">Cancelar</button>
                <button type="submit" disabled={createProyectoMutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-800 text-white text-[14px] font-black rounded-lg transition-all shadow-md active:scale-95">{createProyectoMutation.isPending ? 'Creando...' : 'Crear e Inicializar'}</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal de configuración de trimestres eliminado — se generan automáticamente al crear la ficha */}
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

  // ── Sub-navegación persistida en la URL ────────────────────────────────────
  // ?s=fichas            → lista de fichas
  // ?s=fichas&ficha=123  → detalle de la ficha 123
  // ?s=fichas&ficha=123&proyecto=456 → detalle del proyecto 456 dentro de la ficha
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFichaId    = searchParams.get('ficha')    ? Number(searchParams.get('ficha'))    : null;
  const selectedProyectoId = searchParams.get('proyecto') ? Number(searchParams.get('proyecto')) : null;
  const selectedTrimId     = searchParams.get('trimestre') ? Number(searchParams.get('trimestre')) : null;

  const { data: fichas = [], isLoading } = useQuery({ queryKey: ['fichas'], queryFn: () => fichaService.getAll(), staleTime: 60000 });
  const { data: projects = [] } = useQuery({ queryKey: ['projects', 'for-role', user?.id], queryFn: () => projectService.getAll(), staleTime: 60000, enabled: !!user?.id });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });

  const instructors = (users as any[]).filter(u => u.rol === 'instructor');

  const createMutation = useMutation({
    mutationFn: fichaService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fichas'] });
      setMainTab('todas');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fichaService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas'] }),
  });

  const isCoordinador = user?.rol === 'coordinador';
  const isInstructor = user?.rol === 'instructor';

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
    if (statusFilter === 'con_proyectos') result = result.filter(f => fichasConProyectos.has(f.id));
    if (statusFilter === 'sin_proyectos') result = result.filter(f => !fichasConProyectos.has(f.id));
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
  // trimestreId: contexto del trimestre desde el que se navega (para el backlog)
  const goToProyecto = useCallback((id: number, trimestreId?: number) => {
    const params: Record<string, string> = { s: 'fichas', ficha: String(selectedFichaId), proyecto: String(id) };
    if (trimestreId) params.trimestre = String(trimestreId);
    setSearchParams(params);
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
    return <ProyectoDetalle proyectoId={selectedProyectoId} onBack={backFromProyecto} trimestreId={selectedTrimId ?? undefined} />;
  }

  return (
    <div className="w-full text-zinc-100 bg-zinc-900 min-h-full overflow-y-auto">
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
            <TabBtn active={mainTab === 'solicitar'} onClick={() => { setMainTab('solicitar'); backFromFicha(); }}>
              <Plus size={14} /> Nueva ficha
            </TabBtn>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}

      {/* Nueva ficha (coordinador) */}
      {/* Nueva ficha (coordinador) — mismo componente que el instructor, con
          selector de instructor encargado adicional. */}
      {mainTab === 'nueva' && (
        <InstructorCrearFichaForm
          userId={user?.id}
          instructors={instructors.map((i: any) => ({ id: i.id, nombre: i.nombre }))}
          onCancel={() => setMainTab('todas')}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['fichas'] }); setMainTab('todas'); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          NUEVA FICHA (instructor) — el instructor crea directamente sin
          pedir permiso al coordinador. Selecciona tipo de formación
          (tecnólogo=7 trimestres / técnico=3 trimestres) y fecha de inicio
          (default: hoy). El backend genera automáticamente los trimestres
          de la etapa lectiva siguiendo la plantilla SDLC.
          ═══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'solicitar' && (
        <InstructorCrearFichaForm
          userId={user?.id}
          onCancel={() => setMainTab('todas')}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['fichas'] }); setMainTab('todas'); }}
        />
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
                    { key: 'todas', label: 'Todas' },
                    { key: 'con_proyectos', label: 'Con proyectos' },
                    { key: 'sin_proyectos', label: 'Sin proyectos' },
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
                  <div className="space-y-1">{[1, 2, 3].map(n => <SkeletonRow key={n} />)}</div>
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
