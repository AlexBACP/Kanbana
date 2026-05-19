/**
 * TrimestreKanbanPage — ruta /projects/:id/trimestre/:trimestreId/kanban
 *
 * Kanban filtrado: muestra solo las tareas de los módulos (sprints)
 * que pertenecen al trimestre indicado.
 *
 * Se diseñó para abrirse en una nueva pestaña desde TrimestreDetailPage.
 * Por eso tiene su propio header completo con nombre del proyecto y trimestre.
 */
import { useState, useMemo }                     from 'react';
import { useParams, useNavigate }                from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Search, BookOpen, Code2,
  Calendar, CheckCircle2, Plus, AlertCircle,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { ticketService }  from '../services/ticket.service';
import { useAuthStore }   from '../store/auth.store';
import { KanbanBoard }    from '../components/KanbanBoard';
import { Modal }          from '../components/Modal';
import { Button }         from '../components/Button';
import { TicketStatus }   from '../types/ticket.types';
import { Trimestre }      from '../types/trimestre.types';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const TrimestreKanbanPage = () => {
  const { id, trimestreId } = useParams<{ id: string; trimestreId: string }>();
  const proyectoId  = Number(id);
  const trimId      = Number(trimestreId);
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const { user }    = useAuthStore();

  const canManage   = user?.rol === 'coordinador' || user?.rol === 'instructor'
                      || (user?.rol === 'aprendiz' && (user as any).es_lider_tecnico);
  const esAprendiz  = user?.rol === 'aprendiz' && !(user as any).es_lider_tecnico;

  const [search,          setSearch]          = useState('');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [sprintSelId,     setSprintSelId]     = useState<number | undefined>();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['projects', proyectoId],
    queryFn:  () => projectService.getById(proyectoId),
    enabled:  !!proyectoId,
  });

  const { data: trimestres = [] } = useQuery<Trimestre[]>({
    queryKey: ['trimestres', proyectoId],
    queryFn:  () => projectService.getTrimestres(proyectoId),
    enabled:  !!proyectoId,
  });

  const trim = (trimestres as Trimestre[]).find(t => t.id === trimId);
  const modulos = trim?.sprints ?? [];

  // Traer tickets de cada módulo del trimestre y unirlos
  const sprintIds = modulos.map((m: any) => m.id);

  const ticketQueries = useQuery({
    queryKey: ['tickets', 'trimestre', trimId, sprintIds],
    queryFn:  async () => {
      if (sprintIds.length === 0) return [];
      // Traemos tickets por proyecto y filtramos por sprint en cliente
      const all = await ticketService.getAll(proyectoId);
      return all.filter((t: any) => sprintIds.includes(t.sprint_id));
    },
    enabled: !!proyectoId && sprintIds.length > 0,
    staleTime: 30_000,
  });

  const tickets     = ticketQueries.data ?? [];
  const isLoading   = ticketQueries.isLoading;

  const { data: members = [] } = useQuery({
    queryKey: ['projects', proyectoId, 'members'],
    queryFn:  () => projectService.getMembers(proyectoId),
    enabled:  !!proyectoId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateStatusMut = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', 'trimestre', trimId] }),
    onError:   (e: any) => alert(e?.response?.data?.message ?? 'No se pudo actualizar'),
  });

  const createTicketMut = useMutation({
    mutationFn: (dto: any) => ticketService.create({ ...dto, proyecto_id: proyectoId }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tickets', 'trimestre', trimId] });
      setShowTicketModal(false);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al crear tarea'),
  });

  // ── Derivados ──────────────────────────────────────────────────────────────
  const filteredTickets = useMemo(() =>
    tickets.filter((t: any) => t.titulo?.toLowerCase().includes(search.toLowerCase())),
    [tickets, search]
  );

  const aprendices = (members as any[]).filter((m: any) => m.rol === 'aprendiz');
  const isDoc      = trim?.tipo === 'documental';

  const done       = tickets.filter((t: any) => t.estado === 'done').length;
  const progress   = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-dark-bg overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-dark-border bg-dark-card shrink-0">
        <button
          onClick={() => window.close()}
          className="p-2 rounded-xl hover:bg-dark-bg/60 text-dark-muted hover:text-dark-text transition-all"
          title="Cerrar pestaña"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted truncate">{project?.nombre}</span>
            <span className="text-dark-border">›</span>
            <span className="text-xs font-bold text-dark-text truncate">
              {trim?.nombre || `Trimestre ${trim?.numero}`}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              isDoc
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
            }`}>
              {isDoc ? <><BookOpen size={8} /> Documental</> : <><Code2 size={8} /> Desarrollo</>}
            </span>
            {trim && (
              <span className="text-[9px] text-dark-muted flex items-center gap-1">
                <Calendar size={9} />
                {fmt(trim.fecha_inicio?.toString())} → {fmt(trim.fecha_fin?.toString())}
              </span>
            )}
            {trim?.esta_finalizado && (
              <span className="text-[9px] font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={9} /> Finalizado
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso compacta */}
        <div className="hidden md:flex items-center gap-3">
          <div className="w-28 h-1.5 bg-dark-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-bold text-primary-400">{progress}%</span>
        </div>

        {/* Buscador */}
        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="pl-9 pr-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-dark-text outline-none focus:border-primary-500/50 w-44"
          />
        </div>

        {/* Nueva tarea */}
        {canManage && modulos.length > 0 && !trim?.esta_finalizado && (
          <button
            onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/20"
          >
            <Plus size={13} /> Nueva tarea
          </button>
        )}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : sprintIds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <AlertCircle size={32} className="text-dark-muted opacity-30" />
            <p className="text-sm text-dark-muted">Este trimestre no tiene módulos aún</p>
            {canManage && (
              <button
                onClick={() => navigate(`/projects/${proyectoId}/trimestre/${trimId}`)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                ← Ir al detalle del trimestre para crear módulos
              </button>
            )}
          </div>
        ) : (
          <KanbanBoard
            tickets={filteredTickets as any}
            onStatusChange={(ticketId, status) => updateStatusMut.mutate({ ticketId, status })}
            readonly={esAprendiz}
          />
        )}
      </div>

      {/* Modal nueva tarea */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nueva Tarea">
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createTicketMut.mutate({
              titulo:         f.get('titulo') as string,
              descripcion:    f.get('descripcion') as string,
              prioridad:      f.get('prioridad') as string,
              asignado_a_id:  Number(f.get('asignado_a_id')) || undefined,
              sprint_id:      Number(f.get('sprint_id')) || undefined,
              fecha_limite:   f.get('fecha_limite') as string || undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Título">
            <input
              name="titulo" required
              placeholder="Descripción breve de la tarea"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50"
            />
          </FormField>
          <FormField label="Descripción">
            <textarea
              name="descripcion" rows={2}
              placeholder="Detalles, criterios de aceptación..."
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 resize-none"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prioridad">
              <select name="prioridad" className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none">
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="baja">Baja</option>
              </select>
            </FormField>
            <FormField label="Módulo">
              <select name="sprint_id" className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none">
                <option value="">Sin módulo</option>
                {modulos.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Asignar a">
              <select name="asignado_a_id" className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none">
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha límite">
              <input
                name="fecha_limite" type="date"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50"
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={createTicketMut.isPending}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all"
          >
            {createTicketMut.isPending ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>
      </Modal>
    </div>
  );
};