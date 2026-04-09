import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { useAuthStore } from '../../store/auth.store';
import { useState } from 'react';
import { Search, Plus, MoreHorizontal, X, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Modal } from '../../components/Modal';

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  to_do:       { label: 'Por hacer',   color: 'bg-dark-border/60 text-dark-muted' },
  in_progress: { label: 'En progreso', color: 'bg-blue-500/15 text-blue-400' },
  testing:     { label: 'En pruebas',  color: 'bg-amber-500/15 text-amber-400' },
  done:        { label: 'Completado',  color: 'bg-emerald-500/15 text-emerald-400' },
};

const PRIORIDAD_COLOR: Record<string, string> = {
  alta:  'text-rose-400',
  media: 'text-amber-400',
  baja:  'text-emerald-400',
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  // Load project members to populate the assignee selector
  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(miProyecto?.id),
    enabled: !!miProyecto?.id && isModalOpen,
    staleTime: 1000 * 60,
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || 'Error al crear el ticket. Verifica los datos.');
    },
  });

  const filtered = (tickets as any[]).filter(t =>
    t.titulo.toLowerCase().includes(search.toLowerCase())
  );

  const aprendicesYLideres = (miembros as any[]).filter(
    (m: any) => m.rol === 'aprendiz' || m.rol === 'lider_tecnico'
  );

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
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-widest">
          Tickets del Proyecto
          {miProyecto && (
            <span className="ml-2 text-[10px] font-bold text-dark-muted normal-case tracking-normal">
              · {miProyecto.nombre}
            </span>
          )}
        </h2>
        <button
          onClick={() => { setIsModalOpen(true); setFormError(null); }}
          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
        >
          <Plus size={14} /> Nuevo Ticket
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
      </div>

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
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted animate-pulse">Cargando tickets...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted">No se encontraron tickets</td></tr>
            ) : filtered.map((t) => {
              const estadoCfg = ESTADO_CONFIG[t.estado] ?? { label: t.estado, color: 'bg-dark-border/40 text-dark-muted' };
              return (
                <tr key={t.id} className="hover:bg-dark-border/10 transition-colors">
                  <td className="px-4 py-3 text-dark-text font-medium">{t.titulo}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${estadoCfg.color}`}>
                      {estadoCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold capitalize ${PRIORIDAD_COLOR[t.prioridad] ?? 'text-dark-muted'}`}>
                      {t.prioridad}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-muted text-xs">{t.asignado_a?.nombre || 'Sin asignar'}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 hover:bg-dark-border/50 rounded transition-colors text-dark-muted">
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Crear ticket ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Ticket">
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
              placeholder="Detalles del ticket, criterios de aceptación..."
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors resize-none placeholder:text-dark-muted/50"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <select
                name="tipo"
                defaultValue="task"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
              >
                <option value="task">Tarea</option>
                <option value="bug">Bug</option>
                <option value="story">Historia</option>
              </select>
            </FormField>
            <FormField label="Prioridad">
              <select
                name="prioridad"
                defaultValue="media"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
              >
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </FormField>
          </div>

          {/* Assignee — populated from project members */}
          <FormField label="Asignar a (aprendiz del proyecto)">
            <select
              name="asignado_a_id"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="">Sin asignar</option>
              {aprendicesYLideres.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.rol === 'lider_tecnico' ? 'Líder Técnico' : 'Aprendiz'})
                </option>
              ))}
            </select>
            {isModalOpen && aprendicesYLideres.length === 0 && miProyecto && (
              <p className="text-[10px] text-dark-muted mt-1 ml-1">No hay aprendices en este proyecto aún</p>
            )}
          </FormField>

          <FormField label="Fecha límite">
            <input
              name="fecha_limite"
              type="date"
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
            {createTicketMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Creando ticket...</>
            ) : (
              <><Plus size={14} /> Crear Ticket</>
            )}
          </button>
        </form>
      </Modal>
    </div>
  );
};
