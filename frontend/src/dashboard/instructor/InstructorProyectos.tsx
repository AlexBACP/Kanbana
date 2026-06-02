/**
 * InstructorProyectos
 *
 * Muestra los proyectos asignados al instructor como tarjetas navegables.
 * Al hacer clic en una tarjeta navega a /projects/:id (vista de trimestres).
 * Botones rápidos: Kanban · Backlog · asignar Líder técnico.
 */
import { useState }                          from 'react';
import { useNavigate }                       from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService }                    from '../../services/project.service';
import { ticketService }                     from '../../services/ticket.service';
import { useAuthStore }                      from '../../store/auth.store';
import { Modal }                             from '../../components/Modal';
import {
  FolderKanban, Search, AlertCircle, Loader2,
  Plus, Kanban, Layers, Ticket, Crown,
  ChevronRight, Users, Calendar,
} from 'lucide-react';
import { SprintContextBanner } from '../../components/SprintContextBanner';
import { DateTimeInput }       from '../../components/DateTimeInput';

// ── Helpers ───────────────────────────────────────────────────────────────────
const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

const statusColors: Record<string, string> = {
  activo:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado:    'bg-amber-500/10  text-amber-400  border-amber-500/20',
  finalizado: 'bg-zinc-800/60   text-zinc-500   border-zinc-700',
};
const statusLabel: Record<string, string> = {
  activo: 'Activo', pausado: 'En pausa', finalizado: 'Finalizado',
};

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Componente principal ──────────────────────────────────────────────────────
export const InstructorProyectos = () => {
  const { user }   = useAuthStore();
  const qc         = useQueryClient();
  const [search, setSearch] = useState('');
  const [ticketModal, setTicketModal] = useState<number | null>(null);
  const [formError,   setFormError]   = useState<string | null>(null);

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  projectService.getForMe,
    staleTime: 60_000,
  });

  const filtered = (proyectos as any[]).filter(pr =>
    pr.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  // Datos para el modal de ticket
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
  const { data: modalTrimestres = [] } = useQuery({
    queryKey: ['trimestres', ticketModal],
    queryFn:  () => projectService.getTrimestres(ticketModal!),
    enabled:  ticketModal !== null,
    staleTime: 60_000,
  });
  const modalAprendices  = (modalMembers as any[]).filter((m: any) => m.rol === 'aprendiz');
  const modalSprintsArr  = modalSprints as any[];
  const modalTrimArr     = modalTrimestres as any[];

  // Agrupar sprints por trimestre para el select del modal
  // Cada grupo: { trim, sprints[] } — solo trimestres que tengan al menos 1 sprint
  const sprintsPorTrimestre = modalTrimArr
    .map((t: any) => ({
      trim:    t,
      sprints: modalSprintsArr.filter((s: any) => s.trimestre_id === t.id),
    }))
    .filter(g => g.sprints.length > 0);
  // Sprints sin trimestre asignado (cola de trabajo / backlog)
  const sprintsSinTrimestre = modalSprintsArr.filter((s: any) => !s.trimestre_id);

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setTicketModal(null);
      setFormError(null);
    },
    onError: (err: any) => setFormError(err?.response?.data?.message || 'Error al crear la tarea.'),
  });

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Mis proyectos</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isLoading ? '...' : `${filtered.length} proyecto${filtered.length !== 1 ? 's' : ''} asignado${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proyecto..."
            className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 w-52"
          />
        </div>
      </div>

      {/* ── Grid de tarjetas ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-52 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-14 text-center">
          <FolderKanban size={30} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No tienes proyectos asignados aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pr: any) => (
            <ProyectoCard
              key={pr.id}
              proyecto={pr}
              onCreateTicket={() => setTicketModal(pr.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal crear tarea rápida ── */}
      <Modal
        isOpen={ticketModal !== null}
        onClose={() => { setTicketModal(null); setFormError(null); }}
        title="Crear tarea"
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
              tipo:          'task',
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
            <input name="titulo" required placeholder="Descripción breve de la tarea"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600" />
          </FormField>

          <FormField label="Descripción">
            <textarea name="descripcion" rows={3} placeholder="Criterios de aceptación..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors resize-none placeholder:text-zinc-600" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prioridad">
              <select name="prioridad" defaultValue="media"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors">
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </FormField>
            <FormField label="Asignar a">
              <select name="asignado_a_id"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors">
                <option value="">Sin asignar</option>
                {modalAprendices.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Módulo">
              <select name="sprint_id"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors">
                <option value="">Sin módulo (cola de trabajo)</option>
                {/* Módulos agrupados por trimestre */}
                {sprintsPorTrimestre.map(({ trim, sprints }) => (
                  <optgroup key={trim.id} label={trim.nombre ?? `Trimestre ${trim.numero}`}>
                    {sprints.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}{s.esta_activo ? ' ★' : s.esta_finalizado ? ' ✓' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {/* Sprints sin trimestre */}
                {sprintsSinTrimestre.length > 0 && (
                  <optgroup label="Sin trimestre asignado">
                    {sprintsSinTrimestre.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FormField>
            <FormField label="Fecha límite">
              <DateTimeInput
                name="fecha_limite"
                withTime={true}
                timeName="hora_limite"
              />
            </FormField>
          </div>

          {formError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertCircle size={13} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{formError}</p>
            </div>
          )}

          <button type="submit" disabled={createTicketMutation.isPending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2">
            {createTicketMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Creando...</>
              : <><Plus size={14} /> Crear tarea</>}
          </button>
        </form>
      </Modal>
    </div>
  );
};

// ── ProyectoCard ──────────────────────────────────────────────────────────────
const ProyectoCard = ({ proyecto: pr, onCreateTicket }: { proyecto: any; onCreateTicket: () => void }) => {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const { data: activeSprint } = useQuery({
    queryKey: ['projects', pr.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(pr.id),
    staleTime: 60_000,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', pr.id, 'members'],
    queryFn:  () => projectService.getMembers(pr.id),
    staleTime: 60_000,
  });

  const { data: trimestres = [] } = useQuery({
    queryKey: ['trimestres', pr.id],
    queryFn:  () => projectService.getTrimestres(pr.id),
    staleTime: 60_000,
  });

  const assignLiderMutation = useMutation({
    mutationFn: ({ liderId }: { liderId: number | null }) =>
      projectService.assignLider(pr.id, liderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', pr.id, 'members'] });
      qc.invalidateQueries({ queryKey: ['projects', 'for-me'] });
    },
  });

  const m          = miembros as any[];
  const t          = trimestres as any[];
  const lider      = m.find((u: any) => u.id === pr.liderId);
  const aprendices = m.filter((u: any) => u.rol === 'aprendiz');

  // Progreso global calculado desde los trimestres
  const allTickets = t.flatMap((tr: any) =>
    (tr.sprints ?? []).flatMap((s: any) => s.tickets ?? [])
  );
  const done     = allTickets.filter((tk: any) => tk.estado === 'done').length;
  const progress = allTickets.length > 0 ? Math.round((done / allTickets.length) * 100) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all group">

      {/* ── Zona clickeable → navega a /projects/:id ── */}
      <button
        onClick={() => navigate(`/projects/${pr.id}`)}
        className="w-full text-left px-5 pt-5 pb-4 block"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <FolderKanban size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
              {pr.nombre}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {pr.ficha?.codigo ?? 'Sin ficha'} · {pr.ficha?.programa ?? ''}
            </p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${statusColors[pr.estado] ?? statusColors.finalizado}`}>
            {statusLabel[pr.estado] ?? pr.estado}
          </span>
        </div>

        {/* Sprint activo */}
        {activeSprint && (
          <div className="mb-3">
            <SprintContextBanner sprint={activeSprint} compact />
          </div>
        )}

        {/* Trimestres: resumen */}
        {t.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {t.map((tr: any) => (
              <span
                key={tr.id}
                className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${
                  tr.esta_finalizado
                    ? 'bg-zinc-800 text-zinc-600 border-zinc-700'
                    : tr.tipo === 'documental'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}
              >
                T{tr.numero}
              </span>
            ))}
            <span className="text-[10px] text-zinc-600 ml-1">
              {t.length} trimestre{t.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Fechas */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mb-3">
          <Calendar size={10} />
          {fmt(pr.fecha_inicio)} → {fmt(pr.fecha_fin)}
        </div>

        {/* Progreso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-600">{allTickets.length} tareas totales</span>
            <span className="text-blue-400 font-bold">{progress}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </button>

      {/* ── Separador ── */}
      <div className="border-t border-zinc-800 mx-5" />

      {/* ── Equipo + acciones rápidas ── */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">

        {/* Avatares del equipo */}
        <div className="flex items-center -space-x-2 mr-1">
          {aprendices.slice(0, 4).map((u: any) => (
            <div
              key={u.id}
              title={u.nombre}
              className={`w-6 h-6 rounded-full border-2 border-zinc-900 flex items-center justify-center text-[8px] font-bold shrink-0 ${
                u.es_lider_tecnico
                  ? 'bg-blue-500/30 text-blue-300'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {u.nombre?.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {aprendices.length === 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Users size={11} /> Sin aprendices
            </div>
          )}
          {aprendices.length > 4 && (
            <div className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
              +{aprendices.length - 4}
            </div>
          )}
        </div>

        {/* Líder actual o selector */}
        {lider ? (
          <button
            onClick={e => {
              e.stopPropagation();
              if (confirm(`¿Quitar a ${lider.nombre} como Líder Técnico?`)) {
                assignLiderMutation.mutate({ liderId: null });
              }
            }}
            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 rounded-lg px-2 py-1 transition-all"
            title="Clic para quitar como líder"
          >
            <Crown size={9} /> {lider.nombre}
          </button>
        ) : (
          <LiderSelector
            aprendices={aprendices}
            onAssign={id => assignLiderMutation.mutate({ liderId: id })}
            isPending={assignLiderMutation.isPending}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Acciones rápidas */}
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onCreateTicket(); }}
            title="Nueva tarea"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/projects/${pr.id}/kanban`); }}
            title="Tablero Kanban"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <Kanban size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/projects/${pr.id}/backlog`); }}
            title="Backlog"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/40 transition-all"
          >
            <Ticket size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/projects/${pr.id}`); }}
            title="Ver trimestres"
            className="flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-lg text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all ml-1"
          >
            <Layers size={11} /> Trimestres <ChevronRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── LiderSelector ─────────────────────────────────────────────────────────────
const LiderSelector = ({
  aprendices, onAssign, isPending,
}: {
  aprendices: any[];
  onAssign: (id: number) => void;
  isPending: boolean;
}) => {
  const [open, setOpen] = useState(false);

  if (aprendices.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={isPending}
        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-400 border border-zinc-700 hover:border-blue-500/30 rounded-lg px-2 py-1 transition-all disabled:opacity-50"
      >
        <Crown size={9} /> Asignar líder
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl min-w-[160px] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {aprendices.map((u: any) => (
            <button
              key={u.id}
              onClick={() => { onAssign(u.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-blue-400 hover:bg-blue-500/10 transition-colors text-left"
            >
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] font-bold shrink-0">
                {u.nombre?.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate">{u.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
