/**
 * InstructorProyectos
 * El instructor ve solo sus proyectos (filtrado por backend via /projects/for-me).
 * Puede ver el equipo de cada proyecto, crear tickets, cambiar roles.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { ticketService } from '../../services/ticket.service';
import { useAuthStore } from '../../store/auth.store';
import { Modal } from '../../components/Modal';
import {
  FolderKanban, Users, Ticket, Plus, ExternalLink,
  ChevronDown, ChevronUp, Search, AlertCircle, ShieldCheck,
} from 'lucide-react';

const StatusBadge = ({ estado }: { estado: string }) => {
  const map: Record<string, string> = {
    activo:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pausado:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    finalizado: 'bg-dark-border/40 text-dark-muted border-dark-border',
  };
  const label: Record<string, string> = { activo:'Activo', pausado:'En pausa', finalizado:'Finalizado' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${map[estado] || map.finalizado}`}>
      {label[estado] || estado}
    </span>
  );
};

export const InstructorProyectos = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [ticketModal, setTicketModal] = useState<number | null>(null); // proyectoId

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });

  const p = (proyectos as any[]).filter(pr =>
    pr.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setTicketModal(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-dark-text">Mis proyectos</h2>
          <p className="text-sm text-dark-muted mt-0.5">{p.length} proyecto{p.length !== 1 ? 's' : ''} asignado{p.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proyecto..."
            className="input-dark pl-9 text-sm py-2 w-48"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(n => <div key={n} className="h-20 bg-dark-card border border-dark-border rounded-xl animate-pulse" />)}
        </div>
      ) : p.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
          <FolderKanban size={28} className="mx-auto text-dark-muted mb-3 opacity-40" />
          <p className="text-sm text-dark-muted">No tienes proyectos asignados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {p.map((pr: any) => {
            const expanded = expandedId === pr.id;
            return (
              <ProyectoRow
                key={pr.id}
                proyecto={pr}
                expanded={expanded}
                onToggle={() => setExpandedId(expanded ? null : pr.id)}
                onCreateTicket={() => setTicketModal(pr.id)}
              />
            );
          })}
        </div>
      )}

      {/* Modal crear ticket */}
      <Modal
        isOpen={ticketModal !== null}
        onClose={() => setTicketModal(null)}
        title="Nuevo ticket"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createTicketMutation.mutate({
              proyecto_id: ticketModal,
              titulo:       f.get('titulo'),
              descripcion:  f.get('descripcion'),
              prioridad:    f.get('prioridad'),
              creado_por_id: user?.id,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Título del ticket</label>
            <input name="titulo" required className="input-dark text-sm py-2.5" placeholder="Breve descripción de la tarea" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Descripción</label>
            <textarea name="descripcion" rows={3} className="input-dark text-sm resize-none" placeholder="Detalle del ticket..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dark-muted">Prioridad</label>
            <select name="prioridad" className="input-dark text-sm py-2.5" defaultValue="media">
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={createTicketMutation.isPending}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {createTicketMutation.isPending ? 'Creando...' : 'Crear ticket'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

// ── ProyectoRow ───────────────────────────────────────────────────────────────
const ProyectoRow = ({ proyecto: pr, expanded, onToggle, onCreateTicket }: any) => {
  const qc = useQueryClient();

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', pr.id, 'members'],
    queryFn: () => projectService.getMembers(pr.id),
    enabled: expanded,
    staleTime: 60_000,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', { proyectoId: pr.id }],
    queryFn: () => ticketService.getAll(pr.id),
    enabled: expanded,
    staleTime: 30_000,
  });

  const toggleLiderMutation = useMutation({
    mutationFn: ({ userId }: { userId: number }) =>
      userService.toggleLiderTecnico(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', pr.id, 'members'] }),
  });

  const m = miembros as any[];
  const t = tickets as any[];
  const aprendices = m.filter(u => u.rol === 'aprendiz');
  const lideres    = m.filter(u => u.rol === 'lider_tecnico');
  const done       = t.filter(tk => tk.estado === 'done').length;
  const progress   = t.length ? Math.round((done / t.length) * 100) : 0;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      {/* Cabecera */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-dark-border/20 transition-colors text-left"
      >
        <div className="w-8 h-8 bg-primary-500/10 rounded-lg flex items-center justify-center shrink-0">
          <FolderKanban size={15} className="text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-text truncate">{pr.nombre}</p>
          <p className="text-xs text-dark-muted">
            {pr.ficha?.codigo ?? 'Sin ficha'} · {pr.lider?.nombre ?? 'Sin líder'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge estado={pr.estado} />
          {expanded ? <ChevronUp size={14} className="text-dark-muted" /> : <ChevronDown size={14} className="text-dark-muted" />}
        </div>
      </button>

      {/* Expandido */}
      {expanded && (
        <div className="border-t border-dark-border px-4 py-4 space-y-5">
          {/* Progreso */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-dark-muted">Progreso del proyecto</span>
              <span className="text-xs font-semibold text-primary-400">{progress}%</span>
            </div>
            <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Equipo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-dark-muted flex items-center gap-1.5">
                  <Users size={12} /> Equipo ({m.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lideres.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-emerald-400">{u.nombre?.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-dark-text truncate">{u.nombre}</p>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck size={10} /> Líder
                    </span>
                  </div>
                ))}
                {aprendices.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5 group">
                    <div className="w-6 h-6 rounded-full bg-dark-border/40 border border-dark-border flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-dark-muted">{u.nombre?.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-dark-text truncate">{u.nombre}</p>
                    </div>
                    <button
                      onClick={() => {
                        const action = u.es_lider_tecnico ? 'Quitar sub-rol de Líder Técnico' : 'Asignar sub-rol de Líder Técnico';
                        if (confirm(`¿${action} a ${u.nombre}? El rol base de aprendiz no cambia.`)) {
                          toggleLiderMutation.mutate({ userId: u.id });
                        }
                      }}
                      className={`text-[10px] opacity-0 group-hover:opacity-100 transition-all border rounded px-1.5 py-0.5 ${
                        u.es_lider_tecnico
                          ? 'text-emerald-400 border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30'
                          : 'text-dark-muted hover:text-primary-400 border-dark-border hover:border-primary-500/30'
                      }`}
                    >
                      {u.es_lider_tecnico ? '★ Líder (quitar)' : '→ Líder'}
                    </button>
                  </div>
                ))}
                {m.length === 0 && <p className="text-xs text-dark-muted">Sin miembros</p>}
              </div>
            </div>

            {/* Tickets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-dark-muted flex items-center gap-1.5">
                  <Ticket size={12} /> Tickets ({t.length})
                </h4>
                <button
                  onClick={onCreateTicket}
                  className="text-[10px] text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                >
                  <Plus size={11} /> Nuevo
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {t.slice(0, 8).map((tk: any) => (
                  <a
                    key={tk.id}
                    href={`/tickets/${tk.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-border/30 transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      tk.estado === 'done' ? 'bg-emerald-500' :
                      tk.estado === 'in_progress' ? 'bg-blue-500' :
                      tk.estado === 'testing' ? 'bg-amber-500' : 'bg-dark-muted'
                    }`} />
                    <p className="text-xs text-dark-text truncate flex-1 group-hover:text-primary-400 transition-colors">
                      {tk.titulo}
                    </p>
                    <ExternalLink size={10} className="text-dark-muted opacity-0 group-hover:opacity-100 shrink-0" />
                  </a>
                ))}
                {t.length === 0 && <p className="text-xs text-dark-muted">Sin tickets</p>}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-2 border-t border-dark-border">
            <a
              href={`/projects/${pr.id}/kanban`}
              className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 border border-primary-500/20 hover:border-primary-500/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              <ExternalLink size={12} /> Ver tablero Kanban
            </a>
          </div>
        </div>
      )}
    </div>
  );
};