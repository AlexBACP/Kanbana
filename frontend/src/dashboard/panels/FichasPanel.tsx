/**
 * FichasPanel — 3-level hierarchical navigation:
 *   Level 1: Fichas list
 *   Level 2: Ficha detail (instructor + aprendices + projects)
 *   Level 3: Project detail (lider + aprendices + tickets + kanban)
 *
 * CAMBIOS v3:
 * - FichaDetalle: nueva sección "Aprendices de la Ficha" con:
 *   · Selección múltiple de aprendices en un solo paso (sin click por click)
 *   · Búsqueda con filtro de texto
 *   · Un único botón "Vincular seleccionados" para añadir todos a la vez
 *   · Botón por aprendiz para promover a Líder Técnico (y revertir)
 *   · Botón para desvincular aprendiz de la ficha
 * - ProyectoDetalle: validación de aprendices ya asignados a otro proyecto
 *   (el backend rechaza con error claro, el frontend lo muestra)
 */
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, ChevronLeft, Hash, Calendar,
  GraduationCap, FolderKanban, Users, User,
  Ticket, LayoutGrid, CheckCircle2, Clock, AlertCircle,
  BookOpen, ExternalLink, UserPlus, ShieldCheck, Search,
  Crown, UserMinus, X, Check, FileSpreadsheet, Upload, Download, AlertTriangle,
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
  activo:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  finalizado: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const Chip = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${color}`}>{label}</span>
);

const AvatarBadge = ({ nombre, url, size = 8 }: { nombre?: string; url?: string; size?: number }) => (
  <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>
    {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : (
      <span className="text-white font-black text-xs">{nombre?.slice(0, 2).toUpperCase() || 'KA'}</span>
    )}
  </div>
);

const SkeletonCard = () => (
  <div className="h-40 bg-dark-card/50 rounded-[2rem] animate-pulse border border-dark-border" />
);

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

// ─── Level 3: Project Detail ──────────────────────────────────────────────────
const ProyectoDetalle = ({ proyectoId, onBack }: { proyectoId: number; onBack: () => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

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
    queryFn: () => userService.getAll(),
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
      setMemberError(null);
      setShowMemberModal(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Error al añadir el integrante';
      setMemberError(msg);
    },
  });

  const ticketsArr = tickets as any[];
  const aprendices  = (miembros as any[]).filter((m: any) => m.rol === 'aprendiz');
  const lideres     = (miembros as any[]).filter((m: any) => m.rol === 'lider_tecnico');
  const todoElEquipo = [...aprendices, ...lideres];
  const done        = ticketsArr.filter(t => t.estado === 'done').length;
  const progress    = ticketsArr.length ? Math.round((done / ticketsArr.length) * 100) : 0;
  const canManage   = user?.rol === 'coordinador' || user?.rol === 'instructor' || user?.rol === 'lider_tecnico';

  const addableMemberIds = new Set((miembros as any[]).map((m: any) => m.id));
  const addableUsers = (allUsers as any[]).filter(u =>
    (u.rol === 'aprendiz' || u.rol === 'lider_tecnico') && !addableMemberIds.has(u.id)
  );

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(n => <SkeletonCard key={n} />)}</div>;
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

        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Progreso general</span>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { icon: CheckCircle2, label: 'Completados',  value: done,                                               color: 'emerald' },
            { icon: Clock,        label: 'En Progreso',  value: ticketsArr.filter(t=>t.estado==='in_progress').length, color: 'blue' },
            { icon: AlertCircle,  label: 'Bloqueados',   value: ticketsArr.filter(t=>t.esta_bloqueado).length,      color: 'rose' },
            { icon: Users,        label: 'Integrantes',  value: todoElEquipo.length,                                color: 'amber' },
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
        {/* Responsables */}
        <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
          <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={13} /> Responsables
          </h3>
          {proyecto.instructor && (
            <div className="flex items-center gap-3">
              <AvatarBadge nombre={proyecto.instructor.nombre} url={proyecto.instructor.avatar_url} />
              <div>
                <p className="text-sm font-black text-dark-text">{proyecto.instructor.nombre}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Instructor</p>
              </div>
            </div>
          )}
          {lideres.map((l: any) => (
            <div key={l.id} className="flex items-center gap-3">
              <AvatarBadge nombre={l.nombre} url={l.avatar_url} />
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

        {/* Integrantes del equipo */}
        <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
              <Users size={13} /> Equipo ({todoElEquipo.length})
            </h3>
            {canManage && (
              <button
                onClick={() => { setMemberError(null); setShowMemberModal(true); }}
                className="p-1.5 rounded-xl text-primary-400 hover:bg-primary-600/10 transition-all"
              >
                <UserPlus size={15} />
              </button>
            )}
          </div>
          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {todoElEquipo.length === 0 ? (
              <p className="text-xs text-dark-muted italic">Sin integrantes asignados</p>
            ) : todoElEquipo.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3">
                <AvatarBadge nombre={a.nombre} url={a.avatar_url} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-dark-text truncate">{a.nombre}</p>
                  <p className="text-[10px] text-dark-muted truncate capitalize">{a.rol === 'lider_tecnico' ? 'Líder Técnico' : 'Aprendiz'}</p>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${a.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

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
            {ticketsArr.slice(0, 30).map((t: any) => (
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
                  <p className="text-[10px] text-dark-muted capitalize">{t.prioridad} · {t.estado?.replace('_',' ')}</p>
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

      {/* Modal: Crear ticket */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nuevo Ticket">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createTicketMutation.mutate({
            titulo:       f.get('titulo') as string,
            descripcion:  f.get('descripcion') as string,
            prioridad:    f.get('prioridad') as string,
            asignado_a:   f.get('asignado_a') ? Number(f.get('asignado_a')) : undefined,
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
                {todoElEquipo.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Fecha límite">
            <input name="fecha_limite" type="date" className="input-dark" />
          </FormField>
          <Button type="submit" isLoading={createTicketMutation.isPending} className="w-full py-4">
            {createTicketMutation.isPending ? 'Creando...' : 'Crear Ticket'}
          </Button>
          {createTicketMutation.isError && (
            <p className="text-xs text-rose-400 text-center">Error al crear el ticket. Verifica los datos.</p>
          )}
        </form>
      </Modal>

      {/* Modal: Añadir miembro al proyecto */}
      <Modal isOpen={showMemberModal} onClose={() => { setShowMemberModal(false); setMemberError(null); }} title="Añadir Integrante al Proyecto">
        {memberError && (
          <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/25 rounded-2xl">
            <p className="text-xs text-rose-400 font-bold">{memberError}</p>
            <p className="text-[10px] text-rose-400/70 mt-0.5">Un aprendiz solo puede pertenecer a un proyecto a la vez.</p>
          </div>
        )}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {addableUsers.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-6">No hay usuarios disponibles para añadir</p>
          ) : addableUsers.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-2xl border border-dark-border">
              <AvatarBadge nombre={u.nombre} url={u.avatar_url} size={8} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-dark-text truncate">{u.nombre}</p>
                <p className="text-xs text-dark-muted truncate capitalize">{u.rol === 'lider_tecnico' ? 'Líder Técnico' : 'Aprendiz'}</p>
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

/**
 * Panel de gestión de aprendices de la ficha.
 * Permite seleccionar VARIOS aprendices a la vez y vincularlos en un solo clic.
 * También permite promover/degradar y desvincular.
 */
const AprendicesManager = ({ fichaId, canManage }: { fichaId: number; canManage: boolean }) => {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');
  // Manual tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addResult, setAddResult] = useState<{ added: number[]; errors: { id: number; reason: string }[] } | null>(null);
  // Excel tab state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; linked: number; errors: { fila: number; correo: string; reason: string }[] } | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['fichas', fichaId, 'members'],
    queryFn: () => fichaService.getMembers(fichaId),
    staleTime: 1000 * 30,
  });

  const { data: available = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['fichas', 'available-users'],
    queryFn: () => fichaService.getAvailableUsers(),
    staleTime: 1000 * 30,
    enabled: showAddModal && activeTab === 'manual',
  });

  const addMembersMutation = useMutation({
    mutationFn: (userIds: number[]) => fichaService.addMembers(fichaId, userIds),
    onSuccess: (result) => {
      setAddResult(result);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
      qc.invalidateQueries({ queryKey: ['fichas', 'available-users'] });
      if (result.errors.length === 0) {
        setTimeout(() => { setShowAddModal(false); setAddResult(null); }, 1200);
      }
    },
  });

  const importExcelMutation = useMutation({
    mutationFn: (file: File) => fichaService.importFromExcel(fichaId, file),
    onSuccess: (result) => {
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
      qc.invalidateQueries({ queryKey: ['fichas', 'available-users'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => fichaService.removeMember(fichaId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
      qc.invalidateQueries({ queryKey: ['fichas', 'available-users'] });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (userId: number) => fichaService.promoteToLider(fichaId, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }); },
  });

  const demoteMutation = useMutation({
    mutationFn: (userId: number) => fichaService.demoteToAprendiz(fichaId, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] }); },
  });

  const membersArr = members as any[];
  const availableArr = available as any[];

  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return availableArr;
    const q = searchQuery.toLowerCase();
    return availableArr.filter((u: any) =>
      u.nombre?.toLowerCase().includes(q) || u.correo?.toLowerCase().includes(q)
    );
  }, [availableArr, searchQuery]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredAvailable.map((u: any) => u.id)));
  const clearAll  = () => setSelectedIds(new Set());

  const handleAddSelected = () => {
    if (selectedIds.size === 0) return;
    setAddResult(null);
    addMembersMutation.mutate([...selectedIds]);
  };

  const handleFileDrop = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) return;
    setExcelFile(file);
    setImportResult(null);
  };

  const downloadTemplate = () => {
    // Build a minimal CSV-like template as a downloadable .csv
    // (no xlsx lib on frontend; CSV works fine with Excel)
    const header = 'nombre,correo,telefono,bio';
    const example = 'Juan Pérez,juan.perez@example.com,3001234567,Aprendiz ADSO';
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_aprendices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openModal = () => {
    setShowAddModal(true);
    setAddResult(null);
    setImportResult(null);
    setSelectedIds(new Set());
    setSearchQuery('');
    setExcelFile(null);
    setActiveTab('manual');
  };

  const aprendices = membersArr.filter(m => m.rol === 'aprendiz');
  const lideres    = membersArr.filter(m => m.rol === 'lider_tecnico');

  return (
    <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
          <GraduationCap size={13} /> Aprendices de la Ficha ({membersArr.length})
        </h3>
        {canManage && (
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/10 border border-primary-500/20 text-primary-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/20 transition-all"
          >
            <UserPlus size={12} /> Agregar Aprendices
          </button>
        )}
      </div>

      {/* Lista de miembros actuales */}
      {loadingMembers ? (
        <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-12 bg-dark-bg/50 rounded-2xl animate-pulse" />)}</div>
      ) : membersArr.length === 0 ? (
        <div className="text-center py-8 bg-dark-bg/20 rounded-2xl border border-dashed border-dark-border">
          <GraduationCap size={24} className="mx-auto text-dark-muted mb-2 opacity-30" />
          <p className="text-xs text-dark-muted font-bold uppercase tracking-widest">Sin aprendices vinculados</p>
          {canManage && <p className="text-[10px] text-dark-muted mt-1">Usa el botón "Agregar Aprendices" para añadir</p>}
        </div>
      ) : (
        <div className="space-y-1">
          {lideres.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Crown size={10} /> Líderes Técnicos ({lideres.length})
              </p>
              {lideres.map((m: any) => (
                <MemberRow
                  key={m.id} member={m} canManage={canManage} isLider={true}
                  onPromote={() => promoteMutation.mutate(m.id)}
                  onDemote={() => demoteMutation.mutate(m.id)}
                  onRemove={() => { if (confirm(`¿Desvincular a ${m.nombre} de esta ficha?`)) removeMemberMutation.mutate(m.id); }}
                  isLoading={promoteMutation.isPending || demoteMutation.isPending || removeMemberMutation.isPending}
                />
              ))}
            </div>
          )}
          {aprendices.length > 0 && (
            <div className="space-y-1 mt-2">
              {lideres.length > 0 && (
                <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Users size={10} /> Aprendices ({aprendices.length})
                </p>
              )}
              {aprendices.map((m: any) => (
                <MemberRow
                  key={m.id} member={m} canManage={canManage} isLider={false}
                  onPromote={() => { if (confirm(`¿Promover a ${m.nombre} como Líder Técnico?`)) promoteMutation.mutate(m.id); }}
                  onDemote={() => demoteMutation.mutate(m.id)}
                  onRemove={() => { if (confirm(`¿Desvincular a ${m.nombre} de esta ficha?`)) removeMemberMutation.mutate(m.id); }}
                  isLoading={promoteMutation.isPending || demoteMutation.isPending || removeMemberMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Agregar aprendices ── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddResult(null); setImportResult(null); setExcelFile(null); setSelectedIds(new Set()); }}
        title="Agregar Aprendices a la Ficha"
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-dark-bg/60 rounded-2xl border border-dark-border">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'manual'
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <UserPlus size={12} /> Buscar usuarios
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'excel'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <FileSpreadsheet size={12} /> Subir Excel
            </button>
          </div>

          {/* ── TAB MANUAL ── */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {addResult && (
                <div className="space-y-2">
                  {addResult.added.length > 0 && (
                    <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-400 font-bold">{addResult.added.length} aprendiz(ces) vinculados correctamente</p>
                    </div>
                  )}
                  {addResult.errors.length > 0 && (
                    <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                      <p className="text-xs text-amber-400 font-black">No se pudieron vincular {addResult.errors.length} usuario(s):</p>
                      {addResult.errors.map(e => (
                        <p key={e.id} className="text-[10px] text-amber-400/80">· {e.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className="input-dark pl-9 text-sm"
                />
              </div>

              {filteredAvailable.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest">
                    {selectedIds.size > 0 ? `${selectedIds.size} seleccionado(s)` : 'Selecciona aprendices'}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[10px] text-primary-400 font-bold hover:underline">Seleccionar todos</button>
                    {selectedIds.size > 0 && <button onClick={clearAll} className="text-[10px] text-dark-muted font-bold hover:underline">Limpiar</button>}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {loadingAvailable ? (
                  [1,2,3].map(n => <div key={n} className="h-14 bg-dark-bg/50 rounded-2xl animate-pulse" />)
                ) : filteredAvailable.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-dark-muted">
                      {searchQuery ? 'Sin resultados para esa búsqueda' : 'No hay aprendices disponibles sin ficha asignada'}
                    </p>
                  </div>
                ) : filteredAvailable.map((u: any) => {
                  const isSelected = selectedIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelect(u.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        isSelected ? 'bg-primary-600/15 border-primary-500/40' : 'bg-dark-bg/50 border-dark-border hover:border-dark-border/80'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'bg-primary-600 border-primary-500' : 'border-dark-border bg-dark-bg'
                      }`}>
                        {isSelected && <Check size={11} className="text-white" />}
                      </div>
                      <AvatarBadge nombre={u.nombre} url={u.avatar_url} size={8} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-dark-text truncate">{u.nombre}</p>
                        <p className="text-[10px] text-dark-muted truncate">{u.correo}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border capitalize ${
                        u.rol === 'lider_tecnico'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {u.rol === 'lider_tecnico' ? 'Líder' : 'Aprendiz'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleAddSelected}
                disabled={selectedIds.size === 0 || addMembersMutation.isPending}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all"
              >
                {addMembersMutation.isPending ? 'Vinculando...' : selectedIds.size === 0 ? 'Selecciona aprendices para vincular' : `Vincular ${selectedIds.size} aprendiz${selectedIds.size > 1 ? 'ces' : ''}`}
              </button>
            </div>
          )}

          {/* ── TAB EXCEL ── */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              {/* Info box */}
              <div className="px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl space-y-1">
                <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Importación masiva desde Excel</p>
                <p className="text-[10px] text-dark-muted leading-relaxed">
                  El archivo debe tener columnas: <span className="text-dark-text font-bold">nombre</span>, <span className="text-dark-text font-bold">correo</span>, telefono (opc.), bio (opc.)
                </p>
                <p className="text-[10px] text-emerald-400/80">
                  Los aprendices nuevos se crearán con contraseña: <span className="font-black">Sena2025*</span>
                </p>
              </div>

              {/* Download template */}
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-dark-bg/60 border border-dark-border hover:border-primary-500/30 text-dark-muted hover:text-primary-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <Download size={13} /> Descargar plantilla .csv
              </button>

              {/* Dropzone */}
              {!importResult && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileDrop(f);
                  }}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-emerald-500/60 bg-emerald-500/8'
                      : excelFile
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-dark-border hover:border-primary-500/30 bg-dark-bg/30'
                  }`}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.xlsx,.xls,.csv';
                    input.onchange = e => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleFileDrop(f);
                    };
                    input.click();
                  }}
                >
                  {excelFile ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                        <FileSpreadsheet size={22} className="text-emerald-400" />
                      </div>
                      <p className="text-sm font-black text-emerald-400">{excelFile.name}</p>
                      <p className="text-[10px] text-dark-muted">{(excelFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        onClick={e => { e.stopPropagation(); setExcelFile(null); }}
                        className="text-[10px] text-rose-400 hover:underline font-bold"
                      >
                        Cambiar archivo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-dark-border/50 rounded-2xl flex items-center justify-center mx-auto">
                        <Upload size={20} className="text-dark-muted" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-dark-text">Arrastra tu archivo aquí</p>
                        <p className="text-[10px] text-dark-muted mt-1">o haz clic para seleccionar · .xlsx, .xls, .csv</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado de la importación */}
              {importResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-emerald-400">{importResult.created}</p>
                      <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">Creados</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-blue-400">{importResult.linked}</p>
                      <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-wider">Vinculados</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-3 space-y-2">
                      <p className="text-[11px] font-black text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {importResult.errors.length} fila(s) con errores
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((e, i) => (
                          <p key={i} className="text-[10px] text-amber-400/80">
                            Fila {e.fila} · {e.correo || 'sin correo'}: {e.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { setImportResult(null); setExcelFile(null); }}
                    className="w-full py-2.5 bg-dark-bg/60 border border-dark-border text-dark-muted hover:text-dark-text rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Importar otro archivo
                  </button>
                </div>
              )}

              {/* Botón importar */}
              {!importResult && (
                <button
                  onClick={() => { if (excelFile) importExcelMutation.mutate(excelFile); }}
                  disabled={!excelFile || importExcelMutation.isPending}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2"
                >
                  {importExcelMutation.isPending ? (
                    <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Importando...</>
                  ) : (
                    <><FileSpreadsheet size={14} /> {excelFile ? 'Importar aprendices' : 'Selecciona un archivo primero'}</>
                  )}
                </button>
              )}

              {importExcelMutation.isError && (
                <p className="text-xs text-rose-400 text-center">
                  {(importExcelMutation.error as any)?.response?.data?.message || 'Error al importar el archivo'}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

/** Fila de un miembro de la ficha con acciones de promover/degradar/desvincular */
const MemberRow = ({
  member, canManage, isLider,
  onPromote, onDemote, onRemove, isLoading,
}: {
  member: any;
  canManage: boolean;
  isLider: boolean;
  onPromote: () => void;
  onDemote: () => void;
  onRemove: () => void;
  isLoading: boolean;
}) => (
  <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-dark-bg/40 transition-all group">
    <AvatarBadge nombre={member.nombre} url={member.avatar_url} size={7} />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-dark-text truncate">{member.nombre}</p>
      <p className="text-[10px] text-dark-muted truncate">{member.correo}</p>
    </div>

    {/* Badge de rol */}
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border uppercase tracking-widest shrink-0 ${
      isLider
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
    }`}>
      {isLider ? 'Líder' : 'Aprendiz'}
    </span>

    {/* Acciones — visibles al hacer hover si el usuario puede gestionar */}
    {canManage && (
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isLider ? (
          <button
            onClick={onDemote}
            disabled={isLoading}
            title="Quitar rol de Líder Técnico"
            className="p-1.5 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40"
          >
            <Crown size={12} />
          </button>
        ) : (
          <button
            onClick={onPromote}
            disabled={isLoading}
            title="Promover a Líder Técnico"
            className="p-1.5 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40"
          >
            <Crown size={12} />
          </button>
        )}
        <button
          onClick={onRemove}
          disabled={isLoading}
          title="Desvincular de la ficha"
          className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
        >
          <UserMinus size={12} />
        </button>
      </div>
    )}
  </div>
);

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

  const { data: fichaMembers = [] } = useQuery({
    queryKey: ['fichas', fichaId, 'members'],
    queryFn: () => fichaService.getMembers(fichaId),
    staleTime: 1000 * 30,
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
  const canManageMembers = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const aprendicesCount = (fichaMembers as any[]).filter(u =>
    u.rol === 'aprendiz' || u.rol === 'lider_tecnico'
  ).length;

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
            {(ficha as any).instructor && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <User size={12} className="text-indigo-400" />
                <span className="text-xs font-bold text-indigo-300">{(ficha as any).instructor.nombre}</span>
                <span className="text-[10px] text-dark-muted uppercase tracking-wider font-bold">· Instructor</span>
              </div>
            )}
            <div className="flex gap-4 mt-2 text-xs text-dark-muted font-bold">
              <span className="flex items-center gap-1.5"><Calendar size={12}/> Inicio: {ficha.fecha_inicio}</span>
              <span className="flex items-center gap-1.5"><Calendar size={12}/> Fin: {ficha.fecha_fin}</span>
            </div>
          </div>
          {canCreate && (
            <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 shrink-0">
              <Plus size={14} /> Nuevo Proyecto
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Proyectos',   value: proyectosArr.length },
            { label: 'Activos',     value: proyectosArr.filter(p=>p.estado==='activo').length },
            { label: 'Finalizados', value: proyectosArr.filter(p=>p.estado==='finalizado').length },
            { label: 'Aprendices',  value: aprendicesCount },
          ].map(s => (
            <div key={s.label} className="bg-dark-bg/50 rounded-2xl p-3 border border-dark-border text-center">
              <p className="text-xl font-black text-dark-text">{s.value}</p>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Aprendices manager — nueva sección */}
      <AprendicesManager fichaId={fichaId} canManage={canManageMembers} />

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
                {p.lider && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <ShieldCheck size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400">{p.lider.nombre}</span>
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
            nombre:       f.get('nombre'),
            descripcion:  f.get('descripcion'),
            fichaId,
            fecha_inicio: f.get('fecha_inicio'),
            fecha_fin:    f.get('fecha_fin'),
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

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  });

  const instructors = (users as any[]).filter(u => u.rol === 'instructor');

  const displayedFichas = useMemo(() => {
    if (!user) return [];
    const all = fichas as any[];
    if (user.rol === 'instructor') {
      return all.filter(f => f.instructor_id === user.id || (f as any).instructor?.id === user.id);
    }
    return all;
  }, [fichas, user]);

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
    return <ProyectoDetalle proyectoId={selectedProyectoId} onBack={() => setLevel('ficha')} />;
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
            {isCoordinador
              ? `${displayedFichas.length} fichas registradas — gestión de grupos ADSO`
              : 'Fichas vinculadas a tu gestión pedagógica'}
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
        ) : displayedFichas.length === 0 ? (
          <div className="col-span-3 text-center py-16 bg-dark-card/20 rounded-[2.5rem] border border-dashed border-dark-border">
            <GraduationCap size={32} className="mx-auto text-dark-muted mb-3 opacity-30" />
            <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin fichas registradas</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayedFichas.map((f: any, i: number) => (
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

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-primary-400 text-xs font-bold bg-primary-500/5 py-1 px-2 rounded-lg border border-primary-500/15">
                      <Hash size={11} /> {f.codigo}
                    </div>
                    {f.instructor && (
                      <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold bg-indigo-500/5 py-1 px-2 rounded-lg border border-indigo-500/15">
                        <User size={10} />
                        {f.instructor.nombre.split(' ')[0]}
                      </div>
                    )}
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

      {/* Modal nueva ficha */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Ficha de Formación">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createMutation.mutate({
            codigo:       f.get('codigo') as string,
            programa:     f.get('programa') as string,
            fecha_inicio: f.get('fecha_inicio') as string,
            fecha_fin:    f.get('fecha_fin') as string,
            instructorId: f.get('instructor_id') ? Number(f.get('instructor_id')) : null,
          });
          (e.target as HTMLFormElement).reset();
        }} className="space-y-5">
          <FormField label="Código de la Ficha">
            <input name="codigo" required className="input-dark" placeholder="Ej: 2670687" />
          </FormField>
          <FormField label="Programa de Formación">
            <input name="programa" required className="input-dark" placeholder="Ej: Análisis y Desarrollo de Software" />
          </FormField>
          <FormField label="Instructor Encargado">
            <select name="instructor_id" required className="input-dark cursor-pointer">
              <option value="">Selecciona un instructor</option>
              {instructors.map((ins: any) => (
                <option key={ins.id} value={ins.id}>{ins.nombre}</option>
              ))}
            </select>
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
