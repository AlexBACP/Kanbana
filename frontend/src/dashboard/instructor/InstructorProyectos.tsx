/**
 * InstructorProyectos
 * El instructor ve solo sus proyectos (filtrado por backend via /projects/for-me).
 * Puede ver el equipo de cada proyecto, crear tickets, cambiar roles.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { useAuthStore } from '../../store/auth.store';
import { Modal } from '../../components/Modal';
import {
  FolderKanban, Users, Ticket, Plus, ExternalLink,
  ChevronDown, ChevronUp, Search, AlertCircle, ShieldCheck, Loader2, Crown,
} from 'lucide-react';
import { SprintContextBanner } from '../../components/SprintContextBanner';

// ── Helpers de formulario (mismo estilo que LiderTickets) ─────────────────────
const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

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
  const [formError, setFormError]     = useState<string | null>(null);

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });

  const p = (proyectos as any[]).filter(pr =>
    pr.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  // Miembros y módulos del proyecto seleccionado para el modal de tickets
  const { data: modalMembers = [] } = useQuery({
    queryKey: ['projects', ticketModal, 'members'],
    queryFn:  () => projectService.getMembers(ticketModal!),
    enabled:  ticketModal !== null,
    staleTime: 60_000,
  });
  const { data: modalSprints = [] } = useQuery({
    queryKey: ['projects', ticketModal, 'sprints'],
    queryFn:  () => projectService.getSprints(ticketModal!),
    enabled:  ticketModal !== null,
    staleTime: 60_000,
  });
  const modalMembersArr = (modalMembers as any[]).filter((m: any) => m.rol === 'aprendiz');
  const modalSprintsArr = modalSprints as any[];

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setTicketModal(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || 'Error al crear la tarea.');
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

      {/* Modal crear ticket — diseño unificado con LiderTickets */}
      <Modal
        isOpen={ticketModal !== null}
        onClose={() => { setTicketModal(null); setFormError(null); }}
        title="Crear Nueva Tarea"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            setFormError(null);
            const f = new FormData(e.currentTarget);
            const asignadoRaw = f.get('asignado_a_id');
            createTicketMutation.mutate({
              proyecto_id:   ticketModal,
              titulo:        f.get('titulo') as string,
              descripcion:   (f.get('descripcion') as string) || '',
              tipo:          f.get('tipo') as string,
              prioridad:     f.get('prioridad') as string,
              asignado_a_id: asignadoRaw ? Number(asignadoRaw) : undefined,
              fecha_limite:  (f.get('fecha_limite') as string) || undefined,
              sprint_id:     f.get('sprint_id') ? Number(f.get('sprint_id')) : undefined,
              creado_por_id: user?.id,
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

          <FormField label="Asignar a (miembro del proyecto)">
            <select name="asignado_a_id"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="">Sin asignar</option>
              {modalMembersArr.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.es_lider_tecnico ? 'Líder Técnico' : 'Aprendiz'})
                </option>
              ))}
            </select>
            {modalMembersArr.length === 0 && ticketModal && (
              <p className="text-[10px] text-dark-muted mt-1 ml-1">No hay miembros aprendices en este proyecto</p>
            )}
          </FormField>

          <FormField label="Módulo (opcional)">
            <select name="sprint_id"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="">Sin módulo asignado</option>
              {modalSprintsArr.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Fecha límite">
            <input name="fecha_limite" type="date"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-blue-500/50 transition-colors"
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            {createTicketMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Creando tarea...</>
              : <><Plus size={14} /> Crear Tarea</>
            }
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

  // Sprint activo — se carga siempre (no solo expandido) para mostrarlo en la cabecera
  const { data: activeSprint } = useQuery({
    queryKey: ['projects', pr.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(pr.id),
    staleTime: 60_000,
  });

  // Usa el endpoint correcto: setea project.liderId + es_lider_tecnico + envía notificación/email
  const assignLiderMutation = useMutation({
    mutationFn: ({ liderId }: { liderId: number | null }) =>
      projectService.assignLider(pr.id, liderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', pr.id, 'members'] });
      // Refresca la cabecera del proyecto (pr.lider?.nombre)
      qc.invalidateQueries({ queryKey: ['projects', 'for-me'] });
    },
  });

  const m = miembros as any[];
  const t = tickets as any[];
  // Separar por el liderId del PROYECTO, no por el flag global
  const liderDelProyecto = m.find((u: any) => u.id === pr.liderId);
  const aprendices       = m.filter((u: any) => u.rol === 'aprendiz' && u.id !== pr.liderId);
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
          {/* Sprint activo visible sin expandir */}
          {activeSprint && (
            <div className="mt-1.5">
              <SprintContextBanner sprint={activeSprint} compact />
            </div>
          )}
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

                {/* ── Líder técnico del proyecto ── */}
                {liderDelProyecto ? (
                  <div className="flex items-center gap-2.5 group">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-violet-400">{liderDelProyecto.nombre?.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-dark-text truncate">{liderDelProyecto.nombre}</p>
                    </div>
                    <span className="text-[10px] text-violet-400 font-medium flex items-center gap-1 mr-1">
                      <Crown size={10} /> Líder
                    </span>
                    <button
                      disabled={assignLiderMutation.isPending}
                      onClick={() => {
                        if (confirm(`¿Quitar a ${liderDelProyecto.nombre} como Líder Técnico de este proyecto?`)) {
                          assignLiderMutation.mutate({ liderId: null });
                        }
                      }}
                      className="text-[10px] opacity-0 group-hover:opacity-100 transition-all border rounded px-1.5 py-0.5 text-dark-muted hover:text-rose-400 border-dark-border hover:border-rose-500/30 disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-dark-border/60 bg-dark-bg/40">
                    <ShieldCheck size={12} className="text-dark-muted/50 shrink-0" />
                    <p className="text-[11px] text-dark-muted/60 italic">Sin líder técnico asignado</p>
                  </div>
                )}

                {/* ── Aprendices (no líder) ── */}
                {aprendices.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5 group">
                    <div className="w-6 h-6 rounded-full bg-dark-border/40 border border-dark-border flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-dark-muted">{u.nombre?.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-dark-text truncate">{u.nombre}</p>
                    </div>
                    <button
                      disabled={assignLiderMutation.isPending}
                      onClick={() => {
                        if (confirm(`¿Asignar a ${u.nombre} como Líder Técnico de "${pr.nombre}"?\n\nEl aprendiz recibirá un correo y accederá al dashboard de gestión.`)) {
                          assignLiderMutation.mutate({ liderId: u.id });
                        }
                      }}
                      className="text-[10px] opacity-0 group-hover:opacity-100 transition-all border rounded px-1.5 py-0.5 text-dark-muted hover:text-violet-400 border-dark-border hover:border-violet-500/30 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Crown size={9} /> Líder
                    </button>
                  </div>
                ))}

                {m.length === 0 && (
                  <p className="text-xs text-dark-muted">Sin miembros en el proyecto</p>
                )}
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