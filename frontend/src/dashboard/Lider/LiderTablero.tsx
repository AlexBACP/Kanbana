/**
 * LiderTablero — Tablero Kanban del Líder Técnico.
 *
 * Muestra el tablero del proyecto activo con módulo activo,
 * barra de estadísticas, buscador, crear tareas y cola de trabajo.
 */
import { useState } from 'react';
import { useNavigate }                           from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Layers, Clock, LayoutGrid, Plus, X, Save,
} from 'lucide-react';
import { projectService }       from '../../services/project.service';
import { ticketService }        from '../../services/ticket.service';
import { recursoService }       from '../../services/recurso.service';
import { KanbanBoard }          from '../../components/KanbanBoard';
import { GitHubWidget }         from '../../components/GitHubWidget';
import { SprintContextBanner }  from '../../components/SprintContextBanner';
import { ModuleDetailModal }    from '../../components/ModuleDetailModal';
import { TicketStatus }         from '../../types/ticket.types';

// ── Campos del formulario de nueva tarea ─────────────────────────────────────
const inCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 placeholder:text-zinc-600 transition-colors';

const FL = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

export const LiderTablero = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search,            setSearch]            = useState('');
  const [showModal,         setShowModal]         = useState(false);
  const [showModuleDetail,  setShowModuleDetail]  = useState(false);

  // ── Proyecto ───────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  // ── Módulo activo ──────────────────────────────────────────────────────────
  const { data: activeSprint, isLoading: loadingSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });

  // ── Tickets ────────────────────────────────────────────────────────────────
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', miProyecto?.id, activeSprint?.id],
    queryFn:  () => ticketService.getAll(miProyecto?.id, activeSprint?.id),
    enabled:  !!miProyecto?.id && !!activeSprint,
  });

  // ── Miembros del equipo para asignar tareas ────────────────────────────────
  const { data: members = [] } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn:  () => projectService.getMembers(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });

  // ── Recursos del proyecto (GitHub, Drive, etc.) ─────────────────────────
  const { data: recursos = [] } = useQuery({
    queryKey: ['recursos', miProyecto?.id],
    queryFn:  () => recursoService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });

  // GitHub resource si existe
  const githubResource = (recursos as any[]).find((r: any) => r.tipo === 'github');

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] }),
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'No se pudo actualizar'),
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({ ...dto, proyecto_id: miProyecto?.id }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
      setShowModal(false);
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Error al crear la tarea'),
  });

  // ── Guard: sin proyecto ────────────────────────────────────────────────────
  if (!miProyecto) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <LayoutGrid size={32} className="mb-3 opacity-30" />
        <p className="text-sm font-bold">No tienes un proyecto asignado.</p>
      </div>
    );
  }

  // ── Derivados ──────────────────────────────────────────────────────────────
  const ticketsArr      = tickets as any[];
  const filteredTickets = ticketsArr.filter(t =>
    t.titulo?.toLowerCase().includes(search.toLowerCase())
  );
  const done       = ticketsArr.filter(t => t.estado === 'done').length;
  const inProgress = ticketsArr.filter(t => t.estado === 'in_progress').length;
  const todo       = ticketsArr.filter(t => t.estado === 'to_do').length;
  const progress   = ticketsArr.length > 0 ? Math.round((done / ticketsArr.length) * 100) : 0;

  // Incluye al líder mismo (rol === 'aprendiz' con es_lider_tecnico) para auto-asignación
  const assignableUsers = (members as any[]).filter((m: any) => m.rol === 'aprendiz');

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden">

      {/* ── Barra de info del módulo ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 pb-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Módulo activo */}
          {loadingSprint ? (
            <div className="w-64 h-8 bg-zinc-800/60 rounded-xl animate-pulse" />
          ) : activeSprint ? (
            <SprintContextBanner
              sprint={activeSprint}
              ticketsDone={done}
              ticketsTotal={ticketsArr.length}
              onClick={() => setShowModuleDetail(true)}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <Clock size={11} className="text-amber-400" />
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Sin módulo activo</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {activeSprint && (
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar tareas..."
                className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-[11px] text-zinc-200 outline-none focus:border-blue-500/50 w-36 placeholder:text-zinc-600 transition-colors"
              />
            </div>
          )}

          {/* Nueva tarea — solo si hay módulo activo */}
          {activeSprint && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus size={12} /> Nueva tarea
            </button>
          )}

          <button
            onClick={() => navigate(`/projects/${miProyecto.id}/backlog`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <Layers size={12} /> Cola de trabajo
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {ticketsArr.length > 0 && activeSprint && (
        <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden mb-4 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* ── GitHub Widget — Prominente ────────────────────────────────────── */}
      {githubResource && miProyecto && (
        <div className="mb-4 shrink-0 px-1">
          <GitHubWidget
            recursoId={githubResource.id}
            proyectoId={miProyecto.id}
            canManage={false}
            defaultExpanded={true}
          />
        </div>
      )}

      {/* ── Tablero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loadingSprint ? (
          <div className="flex gap-5 h-full">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />
            ))}
          </div>
        ) : !activeSprint ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
            <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center mb-5">
              <LayoutGrid size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-black text-zinc-300 mb-2">El tablero está en espera</h3>
            <p className="text-[12px] text-zinc-500 mb-6 leading-relaxed">
              El instructor debe activar un módulo desde la cola de trabajo para iniciar el flujo de trabajo del equipo.
            </p>
            <button
              onClick={() => navigate(`/projects/${miProyecto.id}/backlog`)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black rounded-md transition-all"
            >
              Cola de Trabajo
            </button>
          </div>
        ) : loadingTickets ? (
          <div className="flex gap-5 h-full overflow-x-auto pb-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <KanbanBoard
              tickets={filteredTickets}
              onStatusChange={(ticketId, status) => updateStatusMutation.mutate({ ticketId, status })}
            />
          </div>
        )}
      </div>

      {/* ── Modal: Nueva tarea ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/60 rounded-md shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-black text-zinc-200 uppercase tracking-widest">Nueva tarea</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
              >
                <X size={15} />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createTicketMutation.mutate({
                  titulo:        f.get('titulo') as string,
                  descripcion:   (f.get('descripcion') as string) || '',
                  prioridad:     f.get('prioridad') as string,
                  asignado_a_id: Number(f.get('asignado_a_id')) || undefined,
                  sprint_id:     activeSprint?.id ?? undefined,
                  fecha_limite:  (f.get('fecha_limite') as string) || undefined,
                });
              }}
              className="p-5 space-y-4"
            >
              <FL label="Título *">
                <input name="titulo" required className={inCls} placeholder="Ej: Implementar login con JWT" />
              </FL>

              <FL label="Descripción">
                <textarea name="descripcion" rows={2} className={`${inCls} resize-none`} placeholder="Criterios de aceptación, detalles técnicos..." />
              </FL>

              <div className="grid grid-cols-2 gap-3">
                <FL label="Prioridad">
                  <select name="prioridad" className={inCls}>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="baja">Baja</option>
                  </select>
                </FL>
                <FL label="Asignar a">
                  <select name="asignado_a_id" className={inCls}>
                    <option value="">Sin asignar</option>
                    {assignableUsers.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </FL>
              </div>

              <FL label="Fecha límite">
                <input name="fecha_limite" type="date" className={inCls} />
              </FL>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-md text-[11px] font-black uppercase tracking-widest bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all"
                >
                  <Save size={12} />
                  {createTicketMutation.isPending ? 'Creando...' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle del módulo ─────────────────────────────────────── */}
      {showModuleDetail && activeSprint && (
        <ModuleDetailModal
          sprint={activeSprint}
          tickets={ticketsArr}
          onClose={() => setShowModuleDetail(false)}
          canEdit={true}
          onSave={async (desc) => {
            await projectService.updateSprint(activeSprint.id, { descripcion: desc });
            qc.invalidateQueries({ queryKey: ['projects', miProyecto?.id, 'sprint', 'active'] });
          }}
        />
      )}
    </div>
  );
};
