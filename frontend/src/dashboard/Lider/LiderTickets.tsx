/**
 * LiderTickets — Tickets del proyecto del líder técnico.
 * ✅ Cambio de estado inline (dropdown por ticket).
 * ✅ Reasignación a compañero del proyecto.
 * ✅ Crear tickets con asignación.
 * ✅ Eliminar tickets.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/auth.store';
import { useState, useRef } from 'react';
import {
  Search, Plus, Trash2, AlertCircle, Loader2,
  ChevronDown, UserCheck, Clock, CheckCircle2, AlertTriangle, Circle,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { UserProfileModal } from '../../components/UserProfileModal';

const ESTADOS = [
  { key: 'to_do',       label: 'Por hacer',   color: 'bg-dark-border/60 text-dark-muted',        dot: 'bg-slate-400',    icon: Circle },
  { key: 'in_progress', label: 'En progreso',  color: 'bg-blue-500/15 text-blue-400',             dot: 'bg-blue-400',     icon: Clock },
  { key: 'testing',     label: 'En pruebas',   color: 'bg-amber-500/15 text-amber-400',           dot: 'bg-amber-400',    icon: AlertTriangle },
  { key: 'done',        label: 'Completado',   color: 'bg-emerald-500/15 text-emerald-400',       dot: 'bg-emerald-400',  icon: CheckCircle2 },
];

const PRIORIDAD_COLOR: Record<string, string> = {
  alta:  'text-rose-400',
  media: 'text-amber-400',
  baja:  'text-emerald-400',
};

const estadoByKey = (key: string) =>
  ESTADOS.find(e => e.key === key) ?? ESTADOS[0];

// ── Dropdown de estado inline ─────────────────────────────────────────────────
const EstadoDropdown = ({ ticket, onUpdate }: { ticket: any; onUpdate: (estado: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = estadoByKey(ticket.estado);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer hover:opacity-80 transition-opacity select-none ${cfg.color}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
            {ESTADOS.map(e => (
              <button
                key={e.key}
                onClick={() => { onUpdate(e.key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-bg/50 transition-colors text-left ${ticket.estado === e.key ? 'bg-dark-bg/30' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} />
                <span className={e.color.split(' ')[1]}>{e.label}</span>
                {ticket.estado === e.key && (
                  <span className="ml-auto text-[9px] text-dark-muted">actual</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Dropdown de reasignación inline ──────────────────────────────────────────
const AsigneeDropdown = ({
  ticket, miembros, onUpdate,
}: {
  ticket: any;
  miembros: any[];
  onUpdate: (userId: number | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const asignado = ticket.asignado_a;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-dark-muted hover:text-dark-text transition-colors group"
      >
        {asignado ? (
          <>
            <div className="w-5 h-5 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {asignado.avatar_url
                ? <img src={userService.getAvatarUrl(asignado.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                : <span className="text-[8px] font-semibold text-primary-400">{asignado.nombre?.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <span className="truncate max-w-[100px]">{asignado.nombre}</span>
          </>
        ) : (
          <>
            <UserCheck size={12} className="text-dark-muted/60" />
            <span className="text-dark-muted/60 italic">Sin asignar</span>
          </>
        )}
        <ChevronDown size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
            <button
              onClick={() => { onUpdate(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dark-muted hover:bg-dark-bg/50 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-dark-border/60 flex items-center justify-center shrink-0">
                <UserCheck size={10} />
              </div>
              Sin asignar
            </button>
            {miembros.map((m: any) => (
              <button
                key={m.id}
                onClick={() => { onUpdate(m.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-bg/50 transition-colors ${ticket.asignado_a?.id === m.id ? 'bg-dark-bg/30' : ''}`}
              >
                <div className="w-5 h-5 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar_url
                    ? <img src={userService.getAvatarUrl(m.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                    : <span className="text-[8px] font-semibold text-primary-400">{m.nombre?.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <span className="text-dark-text truncate">{m.nombre}</span>
                <span className={`ml-auto text-[9px] shrink-0 ${m.rol === 'lider_tecnico' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {m.rol === 'lider_tecnico' ? 'Líder' : 'Aprendiz'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

export const LiderTickets = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileUserId, setProfileUserId]   = useState<number | null>(null);
  const [solicitarOpen, setSolicitarOpen]   = useState(false);
  const [solicitarForm, setSolicitarForm]   = useState({ nombre: '', justificacion: '' });
  const [solicitarLoading, setSolicitarLoading] = useState(false);
  const [solicitarOk, setSolicitarOk]       = useState(false);

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', miProyecto?.id],
    queryFn: () => ticketService.getAll(miProyecto?.id),
    enabled: !!miProyecto?.id,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(miProyecto?.id),
    enabled: !!miProyecto?.id,
    staleTime: 60_000,
  });

 const miembrosArr = (miembros as any[]).filter(
    (m: any) => m.rol === 'aprendiz' || m.rol === 'lider_tecnico'
  );

  // Módulos (sprints) del proyecto para asignar la tarea
  const { data: sprints = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprints'],
    queryFn:  () => projectService.getSprints(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });
  const sprintsArr = sprints as any[];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      ticketService.updateStatus(id, { estado: estado as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: any }) =>
      ticketService.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const deleteTicketMutation = useMutation({
    mutationFn: (id: number) => ticketService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || 'Error al crear la tarea.');
    },
  });

  const ticketsArr = tickets as any[];

  const filtered = ticketsArr.filter(t => {
    const matchSearch = t.titulo.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === 'all' || t.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!miProyecto?.id) return;
    const f = new FormData(e.currentTarget);
    const asignadoRaw = f.get('asignado_a_id');
    createTicketMutation.mutate({
      titulo:        f.get('titulo') as string,
      descripcion:   (f.get('descripcion') as string) || '',
      prioridad:     f.get('prioridad') as string,
      tipo:          f.get('tipo') as string,
      proyecto_id:   miProyecto.id,
      creado_por_id: user?.id,
      asignado_a_id: asignadoRaw ? Number(asignadoRaw) : undefined,
      fecha_limite:  (f.get('fecha_limite') as string) || undefined,
      sprint_id:     f.get('sprint_id') ? Number(f.get('sprint_id')) : undefined,
    });
  };

  // Contadores por estado
  const counts = ESTADOS.reduce((acc, e) => {
    acc[e.key] = ticketsArr.filter(t => t.estado === e.key).length;
    return acc;
  }, {} as Record<string, number>);

  const handleSolicitarModulo = async () => {
    if (!miProyecto?.id || !solicitarForm.nombre.trim()) return;
    setSolicitarLoading(true);
    try {
      await projectService.solicitarSprint(miProyecto.id, {
        nombre: solicitarForm.nombre,
        justificacion: solicitarForm.justificacion,
      });
      setSolicitarOk(true);
      setTimeout(() => {
        setSolicitarOpen(false);
        setSolicitarOk(false);
        setSolicitarForm({ nombre: '', justificacion: '' });
      }, 2000);
    } catch {
      // el error lo mostramos simple
    } finally {
      setSolicitarLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-widest">
          Tareas del Proyecto
          {miProyecto && (
            <span className="ml-2 text-[10px] font-bold text-dark-muted normal-case tracking-normal">
              · {miProyecto.nombre}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSolicitarOpen(true)}
            className="py-1.5 px-3 text-xs flex items-center gap-2 border border-dark-border rounded-xl text-dark-muted hover:text-dark-text hover:border-primary-500/40 transition-all"
          >
            <Plus size={14} /> Solicitar módulo
          </button>
          <button
            onClick={() => { setIsModalOpen(true); setFormError(null); }}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
          >
            <Plus size={14} /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* Contadores de estado */}
      <div className="grid grid-cols-4 gap-2">
        {ESTADOS.map(e => {
          const active = filterEstado === e.key;
          return (
            <button
              key={e.key}
              onClick={() => setFilterEstado(active ? 'all' : e.key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                active
                  ? 'border-primary-500/40 bg-primary-500/5'
                  : 'border-dark-border bg-dark-card hover:border-dark-border/80'
              }`}
            >
              <p className="text-lg font-bold text-dark-text">{counts[e.key] ?? 0}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${e.color.split(' ')[1]}`}>{e.label}</p>
            </button>
          );
        })}
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
        {filterEstado !== 'all' && (
          <button
            onClick={() => setFilterEstado('all')}
            className="px-3 py-2 text-xs text-dark-muted hover:text-dark-text border border-dark-border rounded-lg transition-colors"
          >
            Ver todos
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-dark-border bg-dark-bg/50">
              <th className="px-4 py-3 font-medium text-dark-muted">Título</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Estado</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Prioridad</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Asignado a</th>
              <th className="px-4 py-3 font-medium text-dark-muted text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted animate-pulse">Cargando tarea...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted">
                {ticketsArr.length === 0 ? 'No hay tareas en este proyecto' : 'Sin coincidencias'}
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="hover:bg-dark-border/10 transition-colors group">
                <td className="px-4 py-3 text-dark-text font-medium max-w-xs">
                  <p className="truncate" title={t.titulo}>{t.titulo}</p>
                  {t.tipo && (
                    <span className="text-[10px] text-dark-muted capitalize">{t.tipo}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <EstadoDropdown
                    ticket={t}
                    onUpdate={(estado) => updateStatusMutation.mutate({ id: t.id, estado })}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold capitalize ${PRIORIDAD_COLOR[t.prioridad] ?? 'text-dark-muted'}`}>
                    {t.prioridad}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <AsigneeDropdown
                    ticket={t}
                    miembros={miembrosArr}
                    onUpdate={(userId) => updateTicketMutation.mutate({
                      id: t.id,
                      dto: { asignado_a_id: userId },
                    })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => confirm(`¿Eliminar la tarea "${t.titulo}"?`) &&
                      deleteTicketMutation.mutate(t.id)}
                    disabled={deleteTicketMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-dark-muted transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Crear ticket */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nueva Tarea">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Título *">
            <input
              name="titulo"
              required
              placeholder="Descripción breve de la tarea"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors placeholder:text-dark-muted/50"
            />
          </FormField>
          <FormField label="Descripción">
            <textarea
              name="descripcion"
              rows={3}
              placeholder="Detalles de la tarea, criterios de aceptación..."
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors resize-none placeholder:text-dark-muted/50"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <select name="tipo" defaultValue="task"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
              >
                <option value="task">Tarea</option>
                <option value="bug">Bug</option>
                <option value="story">Historia</option>
              </select>
            </FormField>
            <FormField label="Prioridad">
              <select name="prioridad" defaultValue="media"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
              >
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </FormField>
          </div>
          <FormField label="Asignar a (miembro del proyecto)">
            <select name="asignado_a_id"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="">Sin asignar</option>
              {miembrosArr.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.rol === 'lider_tecnico' ? 'Líder Técnico' : 'Aprendiz'})
                </option>
              ))}
            </select>
            {miembrosArr.length === 0 && miProyecto && (
              <p className="text-[10px] text-dark-muted mt-1 ml-1">No hay miembros en este proyecto aún</p>
            )}
          </FormField>
          <FormField label="Módulo (opcional)">
            <select name="sprint_id"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="">Sin módulo asignado</option>
              {sprintsArr.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {sprintsArr.length === 0 && miProyecto && (
              <p className="text-[10px] text-amber-400 mt-1 ml-1">
                No hay módulos activos. Solicita uno a tu instructor.
              </p>
            )}
          </FormField>
          <FormField label="Fecha límite">
            <input name="fecha_limite" type="date"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
            />
          </FormField>
          {formError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertCircle size={13} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{formError}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={createTicketMutation.isPending}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            {createTicketMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Creando tarea...</>
              : <><Plus size={14} /> Crear Tarea</>
            }
          </button>
        </form>
      </Modal>

      {profileUserId !== null && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
      {/* Modal: Solicitar módulo al instructor */}
      <Modal isOpen={solicitarOpen} onClose={() => setSolicitarOpen(false)} title="Solicitar módulo al instructor">
        <div className="space-y-4">
          {solicitarOk ? (
            <div className="text-center py-6">
              <p className="text-emerald-400 font-bold text-sm">✓ Solicitud enviada al instructor</p>
              <p className="text-dark-muted text-xs mt-1">Recibirás una notificación cuando el módulo sea creado.</p>
            </div>
          ) : (
            <>
              <FormField label="Nombre del módulo *">
                <input
                  value={solicitarForm.nombre}
                  onChange={e => setSolicitarForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Módulo 2 — Desarrollo backend"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors placeholder:text-dark-muted/50"
                />
              </FormField>
              <FormField label="Justificación (opcional)">
                <textarea
                  value={solicitarForm.justificacion}
                  onChange={e => setSolicitarForm(f => ({ ...f, justificacion: e.target.value }))}
                  rows={3}
                  placeholder="¿Por qué necesitas este módulo?"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors resize-none placeholder:text-dark-muted/50"
                />
              </FormField>
              <button
                onClick={handleSolicitarModulo}
                disabled={solicitarLoading || !solicitarForm.nombre.trim()}
                className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                {solicitarLoading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};