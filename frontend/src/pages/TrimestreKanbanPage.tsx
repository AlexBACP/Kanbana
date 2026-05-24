/**
 * TrimestreKanbanPage — ruta /projects/:id/trimestre/:trimestreId/kanban
 *
 * Kanban filtrado a los módulos de un trimestre específico.
 * Rediseñado con estilo zinc/moderno, unificado con el resto de la app.
 */
import { useState, useMemo }                     from 'react';
import { useParams, useNavigate }                from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Search, BookOpen, Code2,
  Calendar, CheckCircle2, Plus, AlertCircle, Layers,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { ticketService }  from '../services/ticket.service';
import { useAuthStore }   from '../store/auth.store';
import { KanbanBoard }    from '../components/KanbanBoard';
import { Modal }          from '../components/Modal';
import { TicketStatus }   from '../types/ticket.types';
import { Trimestre }      from '../types/trimestre.types';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600';

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

  const canManage  = user?.rol === 'coordinador' || user?.rol === 'instructor'
                     || (user?.rol === 'aprendiz' && (user as any).es_lider_tecnico);
  const esAprendiz = user?.rol === 'aprendiz' && !(user as any).es_lider_tecnico;

  const [search,          setSearch]          = useState('');
  const [showTicketModal, setShowTicketModal] = useState(false);

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

  const trim     = (trimestres as Trimestre[]).find(t => t.id === trimId);
  const modulos  = trim?.sprints ?? [];
  const sprintIds = modulos.map((m: any) => m.id);

  const { data: ticketData = [], isLoading } = useQuery({
    queryKey: ['tickets', 'trimestre', trimId, sprintIds],
    queryFn:  async () => {
      if (sprintIds.length === 0) return [];
      const all = await ticketService.getAll(proyectoId);
      return all.filter((t: any) => sprintIds.includes(t.sprint_id));
    },
    enabled:  !!proyectoId && sprintIds.length > 0,
    staleTime: 30_000,
  });

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
  const tickets         = ticketData as any[];
  const aprendices      = (members as any[]).filter((m: any) => m.rol === 'aprendiz');
  const filteredTickets = useMemo(() =>
    tickets.filter(t => t.titulo?.toLowerCase().includes(search.toLowerCase())),
    [tickets, search]
  );

  const isDoc    = trim?.tipo === 'documental';
  const done     = tickets.filter(t => t.estado === 'done').length;
  const progress = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 border border-zinc-700 transition-all"
          title="Volver"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 truncate">{project?.nombre}</span>
            <span className="text-zinc-700">›</span>
            <span className="text-xs font-black text-zinc-200 truncate">
              {trim?.nombre || `Trimestre ${trim?.numero}`}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              isDoc
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
            }`}>
              {isDoc ? <><BookOpen size={8} /> Documental</> : <><Code2 size={8} /> Desarrollo</>}
            </span>
            {trim && (
              <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                <Calendar size={9} />
                {fmt(trim.fecha_inicio?.toString())} → {fmt(trim.fecha_fin?.toString())}
              </span>
            )}
            {trim?.esta_finalizado && (
              <span className="text-[9px] font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={9} /> Finalizado
              </span>
            )}
            {/* Stats inline */}
            {tickets.length > 0 && (
              <span className="text-[9px] text-zinc-600">
                {done}/{tickets.length} tareas · {progress}%
              </span>
            )}
          </div>
        </div>

        {/* Progress bar compacta */}
        {tickets.length > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isDoc ? 'bg-amber-400' : 'bg-primary-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${isDoc ? 'text-amber-400' : 'text-primary-400'}`}>
              {progress}%
            </span>
          </div>
        )}

        {/* Buscador */}
        <div className="relative hidden md:block">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 outline-none focus:border-primary-500/50 w-40 placeholder:text-zinc-600 transition-colors"
          />
        </div>

        {/* Nueva tarea */}
        {canManage && modulos.length > 0 && !trim?.esta_finalizado && (
          <button
            onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-primary-900/30"
          >
            <Plus size={13} /> Tarea
          </button>
        )}
      </div>

      {/* ── Tablero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : sprintIds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Layers size={24} className="text-zinc-600" />
            </div>
            <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Este trimestre no tiene módulos</p>
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
          <div className="h-full overflow-x-auto overflow-y-hidden p-5">
            <KanbanBoard
              tickets={filteredTickets as any}
              onStatusChange={(ticketId, status) => updateStatusMut.mutate({ ticketId, status })}
              readonly={esAprendiz}
            />
          </div>
        )}
      </div>

      {/* ── Modal nueva tarea ──────────────────────────────────────────────── */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nueva Tarea">
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createTicketMut.mutate({
              titulo:        f.get('titulo') as string,
              descripcion:   f.get('descripcion') as string,
              prioridad:     f.get('prioridad') as string,
              asignado_a_id: Number(f.get('asignado_a_id')) || undefined,
              sprint_id:     Number(f.get('sprint_id'))     || undefined,
              fecha_limite:  f.get('fecha_limite') as string || undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Título">
            <input name="titulo" required className={inputCls} placeholder="Descripción breve de la tarea" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" rows={2} className={`${inputCls} resize-none`} placeholder="Detalles, criterios de aceptación..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prioridad">
              <select name="prioridad" className={inputCls}>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="baja">Baja</option>
              </select>
            </FormField>
            <FormField label="Módulo">
              <select name="sprint_id" className={inputCls}>
                <option value="">Sin módulo</option>
                {modulos.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Asignar a">
              <select name="asignado_a_id" className={inputCls}>
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha límite">
              <input name="fecha_limite" type="date" className={inputCls} />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={createTicketMut.isPending}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all"
          >
            {createTicketMut.isPending ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
