/**
 * Vistas del Líder Técnico
 * Todos los componentes reciben `proyecto` como prop para saber qué cargar.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/auth.store';
import { Modal } from '../../components/Modal';
import { KanbanBoard } from '../../components/KanbanBoard';
import {
  CheckCircle2, Clock, AlertCircle, Ticket,
  Plus, Search, ExternalLink, Users, FolderKanban, ArrowRight,
} from 'lucide-react';
import { TicketStatus } from '../../types/ticket.types';

// ── LiderOverview ─────────────────────────────────────────────────────────────
export const LiderOverview = ({ proyecto, onNavigate }: { proyecto: any; onNavigate: (s: any) => void }) => {
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', { proyectoId: proyecto?.id }],
    queryFn: () => ticketService.getAll(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 30_000,
  });
  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', proyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 60_000,
  });

  const t = tickets as any[];
  const m = miembros as any[];
  const done       = t.filter(tk => tk.estado === 'done').length;
  const inProgress = t.filter(tk => tk.estado === 'in_progress').length;
  const blocked    = t.filter(tk => tk.esta_bloqueado).length;
  const progress   = t.length ? Math.round((done / t.length) * 100) : 0;

  if (!proyecto) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
        <FolderKanban size={28} className="mx-auto text-dark-muted mb-3 opacity-40" />
        <p className="text-sm text-dark-muted">No tienes un proyecto asignado aún</p>
        <p className="text-xs text-dark-muted mt-1">El coordinador o instructor te asignará uno</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-dark-text">{proyecto.nombre}</h1>
        <p className="text-sm text-dark-muted mt-0.5">{proyecto.descripcion}</p>
      </div>

      {/* Progreso */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-dark-muted">Progreso general</span>
          <span className="text-sm font-semibold text-primary-400">{progress}%</span>
        </div>
        <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-dark-muted mt-2">{done} de {t.length} tareas completadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Completados',  value: done,       color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
          { label: 'En progreso',  value: inProgress, color: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: Clock },
          { label: 'Bloqueados',   value: blocked,    color: 'text-rose-400',    bg: 'bg-rose-500/10',    icon: AlertCircle },
          { label: 'Equipo',       value: m.length,   color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Users },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-muted">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={14} className={color} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-dark-text">{value}</p>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('tablero')}
          className="bg-dark-card border border-dark-border rounded-xl p-4 text-left hover:border-primary-500/30 transition-colors group"
        >
          <p className="text-sm font-medium text-dark-text group-hover:text-primary-400 transition-colors">Ver tablero Kanban</p>
          <p className="text-xs text-dark-muted mt-1">Gestiona el flujo de trabajo</p>
        </button>
        <button
          onClick={() => onNavigate('tickets')}
          className="bg-dark-card border border-dark-border rounded-xl p-4 text-left hover:border-primary-500/30 transition-colors group"
        >
          <p className="text-sm font-medium text-dark-text group-hover:text-primary-400 transition-colors">Gestionar tareas</p>
          <p className="text-xs text-dark-muted mt-1">Crear y asignar tareas</p>
        </button>
      </div>
    </div>
  );
};

// ── LiderTablero ──────────────────────────────────────────────────────────────
export const LiderTablero = ({ proyecto }: { proyecto: any }) => {
  const qc = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', { proyectoId: proyecto?.id }],
    queryFn: () => ticketService.getAll(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: TicketStatus }) =>
      ticketService.updateStatus(id, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', { proyectoId: proyecto?.id }] }),
  });

  if (!proyecto) return <p className="text-sm text-dark-muted">Sin proyecto asignado</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Tablero — {proyecto.nombre}</h2>
        <p className="text-sm text-dark-muted mt-0.5">{(tickets as any[]).length} tareas</p>
      </div>
      {isLoading ? (
        <div className="h-64 bg-dark-card border border-dark-border rounded-xl animate-pulse" />
      ) : (
        <div className="overflow-x-auto pb-4">
          <KanbanBoard
            tickets={tickets as any[]}
            onStatusChange={(ticketId, newStatus) =>
              updateStatus.mutate({ id: ticketId, estado: newStatus })
            }
          />
        </div>
      )}
    </div>
  );
};

// ── LiderTickets ──────────────────────────────────────────────────────────────
export const LiderTickets = ({ proyecto }: { proyecto: any }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', { proyectoId: proyecto?.id }],
    queryFn: () => ticketService.getAll(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 30_000,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', proyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 60_000,
  });

  const createTicket = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', { proyectoId: proyecto?.id }] });
      setShowModal(false);
    },
  });

  const t = tickets as any[];
  const aprendices = (miembros as any[]).filter(m => m.rol === 'aprendiz');

  const STATUS_MAP: Record<string, string> = {
    to_do: 'Por hacer', in_progress: 'En progreso', testing: 'Testing', done: 'Completado',
  };

  const filtered = t.filter(tk => {
    const matchSearch = tk.titulo?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || tk.estado === filterStatus;
    return matchSearch && matchStatus;
  });

  if (!proyecto) return <p className="text-sm text-dark-muted">Sin proyecto asignado</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-dark-text">Tareas — {proyecto.nombre}</h2>
          <p className="text-sm text-dark-muted mt-0.5">{t.length} tareas en total</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={14} /> Nueva Tarea
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="input-dark pl-9 text-sm py-2 w-48"
          />
        </div>
        <div className="flex gap-1 bg-dark-bg border border-dark-border rounded-lg p-1">
          {[
            { k: 'all', l: 'Todos' },
            { k: 'to_do', l: 'Por hacer' },
            { k: 'in_progress', l: 'En progreso' },
            { k: 'testing', l: 'Testing' },
            { k: 'done', l: 'Hecho' },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === k ? 'bg-dark-card text-dark-text' : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Tarea</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Prioridad</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Asignado</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Vence</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((tk: any) => {
              const daysLeft = tk.fecha_limite
                ? Math.ceil((new Date(tk.fecha_limite).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <tr key={tk.id} className="border-b border-dark-border/50 last:border-0 hover:bg-dark-bg/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        tk.prioridad === 'alta' ? 'bg-rose-500' :
                        tk.prioridad === 'media' ? 'bg-amber-500' : 'bg-dark-muted'
                      }`} />
                      <p className="font-medium text-dark-text truncate max-w-[180px]">{tk.titulo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${
                      tk.estado === 'done'        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      tk.estado === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      tk.estado === 'testing'     ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-dark-border/40 text-dark-muted border-dark-border'
                    }`}>
                      {STATUS_MAP[tk.estado] || tk.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-dark-muted capitalize">{tk.prioridad}</td>
                  <td className="px-4 py-3 text-xs text-dark-muted">
                    {tk.asignado_a?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {daysLeft === null ? <span className="text-xs text-dark-muted">—</span> : (
                      <span className={`text-xs font-medium ${
                        daysLeft < 0 ? 'text-rose-400' : daysLeft <= 2 ? 'text-amber-400' : 'text-dark-muted'
                      }`}>
                        {daysLeft < 0 ? 'Vencido' : daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <a href={`/tickets/${tk.id}`} className="text-dark-muted hover:text-primary-400 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-sm text-dark-muted">Sin tareas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo ticket */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva tarea">
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createTicket.mutate({
              proyecto_id:   proyecto.id,
              titulo:        f.get('titulo'),
              descripcion:   f.get('descripcion'),
              prioridad:     f.get('prioridad'),
              asignado_a_id: Number(f.get('asignado_a')) || undefined,
              fecha_limite:  f.get('fecha_limite') || undefined,
              creado_por_id: user?.id,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Título</label>
            <input name="titulo" required className="input-dark text-sm py-2.5" placeholder="Descripción breve de la tarea" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Descripción</label>
            <textarea name="descripcion" rows={3} className="input-dark text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dark-muted">Prioridad</label>
              <select name="prioridad" className="input-dark text-sm py-2.5" defaultValue="media">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dark-muted">Asignar a</label>
              <select name="asignado_a" className="input-dark text-sm py-2.5">
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Fecha límite</label>
            <input name="fecha_limite" type="date" className="input-dark text-sm py-2.5" />
          </div>
          <button
            type="submit"
            disabled={createTicket.isPending}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {createTicket.isPending ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

// ── LiderEquipo ───────────────────────────────────────────────────────────────
export const LiderEquipo = ({ proyecto }: { proyecto: any }) => {
  const { data: miembros = [], isLoading } = useQuery({
    queryKey: ['projects', proyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(proyecto?.id),
    enabled: !!proyecto?.id,
    staleTime: 60_000,
  });

  const m = miembros as any[];
  const aprendices = m.filter(u => u.rol === 'aprendiz' && !u.es_lider_tecnico);
  const lideres    = m.filter(u => u.rol === 'aprendiz' && u.es_lider_tecnico);

  if (!proyecto) return <p className="text-sm text-dark-muted">Sin proyecto asignado</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Mi equipo</h2>
        <p className="text-sm text-dark-muted mt-0.5">
          {aprendices.length} aprendiz{aprendices.length !== 1 ? 'ces' : ''} en {proyecto.nombre}
        </p>
      </div>

      {/* Instructor de referencia */}
      {proyecto.instructor && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-blue-400">{proyecto.instructor.nombre?.slice(0,2).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-dark-text">{proyecto.instructor.nombre}</p>
            <p className="text-xs text-blue-400">Instructor supervisor</p>
          </div>
        </div>
      )}

      {/* Equipo */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(n => <div key={n} className="h-14 bg-dark-card border border-dark-border rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Aprendiz</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Correo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {aprendices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-sm text-dark-muted">
                    Sin aprendices en este proyecto
                  </td>
                </tr>
              ) : aprendices.map((u: any) => (
                <tr key={u.id} className="border-b border-dark-border/50 last:border-0 hover:bg-dark-bg/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-semibold text-amber-400">{u.nombre?.slice(0,2).toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-dark-text text-sm">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-dark-muted">{u.correo}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${
                      u.activo
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
