/**
 * FichasPanel — 3-level hierarchical navigation:
 *   Level 1: Fichas list
 *   Level 2: Ficha detail (instructor + projects)
 *   Level 3: Project detail (lider + aprendices + tickets + kanban)
 *
 * All state-driven — no URL changes. AnimatePresence handles transitions.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, ChevronLeft, Hash, Calendar,
  GraduationCap, FolderKanban, Users, User, ShieldCheck,
  Ticket, LayoutGrid, CheckCircle2, Clock, AlertCircle,
  BookOpen, TrendingUp, ExternalLink, UserPlus, Settings
} from 'lucide-react';
import { fichaService } from '../../services/ficha.service';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuthStore } from '../../store/auth.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Level = 'fichas' | 'ficha' | 'proyecto';

const STATUS_COLORS: Record<string, string> = {
  activo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  finalizado: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const Chip = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${color}`}>{label}</span>
);

const Avatar = ({ nombre, url, size = 8 }: { nombre?: string; url?: string; size?: number }) => (
  <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>
    {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : (
      <span className="text-white font-black text-xs">{nombre?.slice(0, 2).toUpperCase() || 'KA'}</span>
    )}
  </div>
);

const SkeletonCard = () => (
  <div className="h-40 bg-dark-card/50 rounded-[2rem] animate-pulse border border-dark-border" />
);

const slideVariants = {
  enterRight: { opacity: 0, x: 40 },
  enterLeft:  { opacity: 0, x: -40 },
  center:     { opacity: 1, x: 0 },
  exitLeft:   { opacity: 0, x: -40 },
  exitRight:  { opacity: 0, x: 40 },
};

// ─── Level 3: Project Detail ──────────────────────────────────────────────────
const ProyectoDetalle = ({
  proyectoId, onBack,
}: { proyectoId: number; onBack: () => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['projects', proyectoId],
    queryFn: () => projectService.getById(proyectoId),
    staleTime: 1000 * 60,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', proyectoId, 'members'],
    queryFn: () => projectService.getMembers(proyectoId),
    staleTime: 1000 * 60,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    staleTime: 1000 * 60,
    enabled: showMemberModal,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', { proyectoId }],
    queryFn: () => ticketService.getAll(proyectoId),
    staleTime: 1000 * 30,
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({ ...dto, proyecto_id: proyectoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', { proyectoId }] });
      setShowTicketModal(false);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => projectService.addMember(proyectoId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      setShowMemberModal(false);
    },
  });

  const ticketsArr = tickets as any[];
  const aprendices = (miembros as any[]).filter((m: any) => m.rol === 'aprendiz');
  const lideres    = (miembros as any[]).filter((m: any) => m.rol === 'lider_tecnico');
  const done       = ticketsArr.filter(t => t.estado === 'done').length;
  const progress   = ticketsArr.length ? Math.round((done / ticketsArr.length) * 100) : 0;
  const canManage  = user?.rol === 'coordinador' || user?.rol === 'instructor' || user?.rol === 'lider_tecnico';

  const addableMemberIds = new Set((miembros as any[]).map((m: any) => m.id));
  const addableUsers = (allUsers as any[]).filter(u => u.rol === 'aprendiz' && !addableMemberIds.has(u.id));

  if (isLoading) return (
    <div className="space-y-4">{[1,2,3].map(n => <SkeletonCard key={n} />)}</div>
  );
  if (!proyecto) return null;

  return (
    <motion.div
      key="proyecto"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-2 text-dark-muted hover:text-primary-400 transition-colors text-xs font-black uppercase tracking-widest">
        <ChevronLeft size={14} /> Volver a la Ficha
      </button>

      {/* Header */}
      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Chip label={proyecto.estado} color={STATUS_COLORS[proyecto.estado] || STATUS_COLORS.activo} />
              <span className="text-[10px] text-dark-muted font-bold uppercase tracking-widest">Proyecto Formativo</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight line-clamp-2">{proyecto.nombre}</h2>
            <p className="text-dark-muted text-sm mt-1 line-clamp-2">{proyecto.descripcion}</p>
          </div>
          <a
            href={`/projects/${proyecto.id}/kanban`}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600/15 border border-primary-500/25 text-primary-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-600/25 transition-all"
          >
            <LayoutGrid size={14} /> Ver Kanban
          </a>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Progreso</span>
            <span className="text-xs font-black text-primary-400">{progress}%</span>
          </div>
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full"
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { icon: CheckCircle2, label: 'Completados', value: done,                                     color: 'emerald' },
            { icon: Clock,        label: 'En Progreso',  value: ticketsArr.filter(t=>t.estado==='in_progress').length, color: 'blue' },
            { icon: AlertCircle,  label: 'Bloqueados',   value: ticketsArr.filter(t=>t.esta_bloqueado).length,    color: 'rose' },
            { icon: Users,        label: 'Aprendices',   value: aprendices.length,                        color: 'amber' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-dark-bg/50 rounded-2xl p-3 flex items-center gap-3 border border-dark-border">
              <div className={`p-2 rounded-xl bg-${color}-500/10`}>
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-base font-black text-dark-text">{value}</p>
                <p className="text-[10px] text-dark-muted uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructor + Líder */}
        <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
          <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={13} /> Responsables
          </h3>
          {proyecto.instructor && (
            <div className="flex items-center gap-3">
              <Avatar nombre={proyecto.instructor.nombre} url={proyecto.instructor.avatar_url} />
              <div>
                <p className="text-sm font-black text-dark-text">{proyecto.instructor.nombre}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Instructor</p>
              </div>
            </div>
          )}
          {lideres.map((l: any) => (
            <div key={l.id} className="flex items-center gap-3">
              <Avatar nombre={l.nombre} url={l.avatar_url} />
              <div>
                <p className="text-sm font-black text-dark-text">{l.nombre}</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Líder Técnico</p>
              </div>
            </div>
          ))}
          {!proyecto.instructor && lideres.length === 0 && (
            <p className="text-xs text-dark-muted italic">Sin responsables asignados</p>
          )}
        </div>

        {/* Aprendices */}
        <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
              <Users size={13} /> Equipo ({aprendices.length})
            </h3>
            {canManage && (
              <button onClick={() => setShowMemberModal(true)} className="p-1.5 rounded-xl text-primary-400 hover:bg-primary-600/10 transition-all">
                <UserPlus size={15} />
              </button>
            )}
          </div>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {aprendices.length === 0 ? (
              <p className="text-xs text-dark-muted italic">Sin aprendices asignados</p>
            ) : aprendices.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3">
                <Avatar nombre={a.nombre} url={a.avatar_url} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-dark-text truncate">{a.nombre}</p>
                  <p className="text-[10px] text-dark-muted truncate">{a.correo}</p>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${a.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RAP */}
      {(proyecto.competencia || proyecto.resultado_aprendizaje) && (
        <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-3">
          <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
            <BookOpen size={13} /> Resultado de Aprendizaje
          </h3>
          {proyecto.competencia && (
            <div>
              <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest mb-1">Competencia</p>
              <p className="text-sm text-dark-text">{proyecto.competencia}</p>
            </div>
          )}
          {proyecto.resultado_aprendizaje && (
            <div>
              <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest mb-1">RAP</p>
              <p className="text-sm text-dark-text">{proyecto.resultado_aprendizaje}</p>
            </div>
          )}
        </div>
      )}

      {/* Tickets */}
      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
            <Ticket size={13} /> Tickets ({ticketsArr.length})
          </h3>
          {canManage && (
            <Button onClick={() => setShowTicketModal(true)} size="sm" className="flex items-center gap-1.5">
              <Plus size={13} /> Nuevo Ticket
            </Button>
          )}
        </div>

        {ticketsArr.length === 0 ? (
          <p className="text-xs text-dark-muted italic text-center py-6">Sin tickets en este proyecto</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {ticketsArr.slice(0, 20).map((t: any) => (
              <a key={t.id} href={`/tickets/${t.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-dark-bg/60 border border-dark-border/50 hover:border-primary-500/30 transition-all group"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  t.estado === 'done' ? 'bg-emerald-500' :
                  t.estado === 'in_progress' ? 'bg-blue-500' :
                  t.estado === 'testing' ? 'bg-amber-500' : 'bg-dark-muted'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-dark-text truncate group-hover:text-primary-400 transition-colors">{t.titulo}</p>
                  <p className="text-[10px] text-dark-muted capitalize">{t.prioridad} · {t.estado.replace('_',' ')}</p>
                </div>
                {t.asignado_a_rel && (
                  <span className="text-[10px] text-dark-muted truncate max-w-[80px]">{t.asignado_a_rel.nombre}</span>
                )}
                <ExternalLink size={11} className="text-dark-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create ticket */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nuevo Ticket">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createTicketMutation.mutate({
            titulo: f.get('titulo'),
            descripcion: f.get('descripcion'),
            prioridad: f.get('prioridad'),
            asignado_a: Number(f.get('asignado_a')) || undefined,
            fecha_limite: f.get('fecha_limite') || undefined,
          });
        }} className="space-y-5">
          <FormField label="Título">
            <input name="titulo" required className="input-dark" placeholder="Descripción breve de la tarea" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" className="input-dark resize-none" rows={3} placeholder="Detalles del ticket..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prioridad">
              <select name="prioridad" className="input-dark" defaultValue="media">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </FormField>
            <FormField label="Asignar a">
              <select name="asignado_a" className="input-dark">
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Fecha límite">
            <input name="fecha_limite" type="date" className="input-dark" />
          </FormField>
          <Button type="submit" isLoading={createTicketMutation.isPending} className="w-full py-4">Crear Ticket</Button>
        </form>
      </Modal>

      {/* Modal: Add member */}
      <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title="Añadir Aprendiz al Proyecto">
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {addableUsers.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-6">No hay aprendices disponibles para añadir</p>
          ) : addableUsers.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-2xl border border-dark-border">
              <Avatar nombre={u.nombre} url={u.avatar_url} size={8} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-dark-text truncate">{u.nombre}</p>
                <p className="text-xs text-dark-muted truncate">{u.correo}</p>
              </div>
              <Button size="sm" onClick={() => addMemberMutation.mutate(u.id)} isLoading={addMemberMutation.isPending}>
                Añadir
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </motion.div>
  );
};

// ─── Level 2: Ficha Detail ────────────────────────────────────────────────────
const FichaDetalle = ({
  fichaId, onBack, onSelectProyecto,
}: { fichaId: number; onBack: () => void; onSelectProyecto: (id: number) => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: ficha, isLoading: loadingFicha } = useQuery({
    queryKey: ['fichas', fichaId],
    queryFn: () => fichaService.getById(fichaId),
    staleTime: 1000 * 60,
  });

  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['projects', { fichaId }],
    queryFn: () => projectService.getAll({ fichaId }),
    staleTime: 1000 * 60,
  });

  const { data: instructores = [] } = useQuery({
    queryKey: ['users', { rol: 'instructor' }],
    queryFn: userService.getAll,
    staleTime: 1000 * 60,
    select: (data: any) => (data as any[]).filter(u => u.rol === 'instructor'),
    enabled: showModal,
  });

  const createProyectoMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', { fichaId }] });
      setShowModal(false);
    },
  });

  const proyectosArr = proyectos as any[];
  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';

  if (loadingFicha) return <div className="space-y-4">{[1,2].map(n=><SkeletonCard key={n}/>)}</div>;
  if (!ficha) return null;

  return (
    <motion.div
      key="ficha"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-dark-muted hover:text-primary-400 transition-colors text-xs font-black uppercase tracking-widest">
        <ChevronLeft size={14} /> Todas las Fichas
      </button>

      {/* Ficha header */}
      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-primary-400 text-xs font-bold mb-2">
              <Hash size={12} /> Ficha {ficha.codigo}
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">{ficha.programa}</h2>
            <div className="flex gap-4 mt-2 text-xs text-dark-muted font-bold">
              <span className="flex items-center gap-1.5"><Calendar size={12}/> {ficha.fecha_inicio}</span>
              <span className="flex items-center gap-1.5"><Calendar size={12}/> {ficha.fecha_fin}</span>
            </div>
          </div>
          {canCreate && (
            <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 shrink-0">
              <Plus size={14} /> Nuevo Proyecto
            </Button>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Proyectos',  value: proyectosArr.length },
            { label: 'Activos',    value: proyectosArr.filter(p=>p.estado==='activo').length },
            { label: 'Finalizados',value: proyectosArr.filter(p=>p.estado==='finalizado').length },
          ].map(s => (
            <div key={s.label} className="bg-dark-bg/50 rounded-2xl p-3 border border-dark-border text-center">
              <p className="text-xl font-black text-dark-text">{s.value}</p>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projects list */}
      <div>
        <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <FolderKanban size={12} /> Proyectos ({proyectosArr.length})
        </h3>

        {loadingProyectos ? (
          <div className="space-y-3">{[1,2,3].map(n=><SkeletonCard key={n}/>)}</div>
        ) : proyectosArr.length === 0 ? (
          <div className="text-center py-12 bg-dark-card/20 rounded-[2rem] border border-dashed border-dark-border">
            <FolderKanban size={30} className="mx-auto text-dark-muted mb-3 opacity-30" />
            <p className="text-dark-muted text-xs font-black uppercase tracking-widest">Sin proyectos en esta ficha</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proyectosArr.map((p: any, i: number) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectProyecto(p.id)}
                className="bg-dark-card p-5 rounded-[2rem] border border-dark-border hover:border-primary-500/40 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-400 group-hover:scale-110 transition-transform">
                    <FolderKanban size={18} />
                  </div>
                  <Chip label={p.estado} color={STATUS_COLORS[p.estado] || STATUS_COLORS.activo} />
                </div>
                <h4 className="font-black text-base text-white group-hover:text-primary-400 transition-colors uppercase tracking-tight line-clamp-1">
                  {p.nombre}
                </h4>
                <p className="text-xs text-dark-muted mt-1 line-clamp-2">{p.descripcion}</p>
                {p.instructor && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <User size={11} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400">{p.instructor.nombre}</span>
                  </div>
                )}
                <div className="flex items-center justify-end mt-3">
                  <span className="text-[10px] font-black text-primary-400 flex items-center gap-1 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver detalle <ChevronRight size={11} />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Create project modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Proyecto Formativo">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createProyectoMutation.mutate({
            nombre: f.get('nombre'),
            descripcion: f.get('descripcion'),
            fichaId,
            instructorId: Number(f.get('instructorId')) || undefined,
            fecha_inicio: f.get('fecha_inicio'),
            fecha_fin: f.get('fecha_fin'),
          } as any);
        }} className="space-y-5">
          <FormField label="Nombre del Proyecto">
            <input name="nombre" required className="input-dark" placeholder="Ej: Sistema de Inventarios SENA" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" className="input-dark resize-none" rows={3} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha Inicio">
              <input name="fecha_inicio" type="date" required className="input-dark" />
            </FormField>
            <FormField label="Fecha Fin">
              <input name="fecha_fin" type="date" required className="input-dark" />
            </FormField>
          </div>
          <FormField label="Instructor Responsable">
            <select name="instructorId" className="input-dark">
              <option value="">Sin asignar</option>
              {(instructores as any[]).map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </FormField>
          <Button type="submit" isLoading={createProyectoMutation.isPending} className="w-full py-4">
            Crear Proyecto
          </Button>
        </form>
      </Modal>
    </motion.div>
  );
};

// ─── Level 1: Fichas List ─────────────────────────────────────────────────────
export const FichasPanel = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [level, setLevel] = useState<Level>('fichas');
  const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);
  const [selectedProyectoId, setSelectedProyectoId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ['fichas'],
    queryFn: fichaService.getAll,
    staleTime: 1000 * 60,
  });

  const createMutation = useMutation({
    mutationFn: fichaService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fichas'] });
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fichaService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas'] }),
  });

  const goToFicha = useCallback((id: number) => {
    setSelectedFichaId(id);
    setLevel('ficha');
  }, []);

  const goToProyecto = useCallback((id: number) => {
    setSelectedProyectoId(id);
    setLevel('proyecto');
  }, []);

  const isCoordinador = user?.rol === 'coordinador';

  if (level === 'proyecto' && selectedProyectoId) {
    return (
      <ProyectoDetalle
        proyectoId={selectedProyectoId}
        onBack={() => setLevel('ficha')}
      />
    );
  }

  if (level === 'ficha' && selectedFichaId) {
    return (
      <FichaDetalle
        fichaId={selectedFichaId}
        onBack={() => setLevel('fichas')}
        onSelectProyecto={goToProyecto}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-card/30 p-6 rounded-[2rem] border border-dark-border">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            {isCoordinador ? 'Fichas de Formación' : 'Mis Fichas Asignadas'}
          </h2>
          <p className="text-dark-muted text-sm font-bold mt-1">
            {isCoordinador ? 'Gestión de grupos ADSO — haz clic en una ficha para explorar' : 'Fichas vinculadas a tu gestión pedagógica'}
          </p>
        </div>
        {isCoordinador && (
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 shrink-0">
            <Plus size={15} /> Nueva Ficha
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          [1,2,3].map(n=><SkeletonCard key={n}/>)
        ) : (fichas as any[]).length === 0 ? (
          <div className="col-span-3 text-center py-16 bg-dark-card/20 rounded-[2.5rem] border border-dashed border-dark-border">
            <GraduationCap size={32} className="mx-auto text-dark-muted mb-3 opacity-30" />
            <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin fichas registradas</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {(fichas as any[]).map((f: any, i: number) => (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => goToFicha(f.id)}
                className="bg-dark-card rounded-[2.5rem] border border-dark-border hover:border-primary-500/40 transition-all group cursor-pointer overflow-hidden"
              >
                <div className="h-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 opacity-60" />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-400 group-hover:scale-110 transition-transform">
                      <GraduationCap size={20} />
                    </div>
                    {isCoordinador && (
                      <button onClick={e => {
                        e.stopPropagation();
                        if (confirm('¿Eliminar esta ficha?')) deleteMutation.mutate(f.id);
                      }} className="p-2 text-dark-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <h3 className="font-black text-base text-white uppercase tracking-tight group-hover:text-primary-400 transition-colors mb-2 line-clamp-2">
                    {f.programa}
                  </h3>
                  <div className="flex items-center gap-1.5 text-primary-400 text-xs font-bold bg-primary-500/5 py-1 px-2 rounded-lg w-fit border border-primary-500/15 mb-4">
                    <Hash size={11} /> {f.codigo}
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-dark-muted pt-3 border-t border-dark-border/50">
                    <span className="flex items-center gap-1"><Calendar size={10}/> {f.fecha_inicio}</span>
                    <span className="flex items-center gap-1 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Explorar <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Ficha de Formación">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createMutation.mutate({
            codigo: f.get('codigo') as string,
            programa: f.get('programa') as string,
            fecha_inicio: f.get('fecha_inicio') as string,
            fecha_fin: f.get('fecha_fin') as string,
          });
          (e.target as HTMLFormElement).reset();
        }} className="space-y-5">
          <FormField label="Código de la Ficha">
            <input name="codigo" required className="input-dark" placeholder="Ej: 2670687" />
          </FormField>
          <FormField label="Programa de Formación">
            <input name="programa" required className="input-dark" placeholder="Ej: Análisis y Desarrollo de Software" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha Inicio">
              <input name="fecha_inicio" type="date" required className="input-dark" />
            </FormField>
            <FormField label="Fecha Fin">
              <input name="fecha_fin" type="date" required className="input-dark" />
            </FormField>
          </div>
          <Button type="submit" isLoading={createMutation.isPending} className="w-full py-4 font-black uppercase tracking-widest">
            {createMutation.isPending ? 'Guardando...' : 'Guardar Ficha'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);
