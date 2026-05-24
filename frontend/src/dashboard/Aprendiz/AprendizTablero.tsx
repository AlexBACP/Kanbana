/**
 * AprendizTablero — Tablero Kanban del proyecto visto por el aprendiz.
 *
 * El aprendiz puede:
 *   - Ver todas las tareas del módulo activo de su proyecto
 *   - Tomar tareas disponibles del pool (to_do, sin asignar) → claim
 *   - Marcar como lista para revisión sus tareas en progreso → mark-complete
 *   - Arrastrar sus propias tareas entre columnas
 *
 * NO puede:
 *   - Crear nuevas tareas (eso es exclusivo del líder)
 *   - Aprobar / rechazar tareas
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Clock } from 'lucide-react';
import { useAuthStore }          from '../../store/auth.store';
import { projectService }        from '../../services/project.service';
import { ticketService }         from '../../services/ticket.service';
import { recursoService }        from '../../services/recurso.service';
import { KanbanBoard }           from '../../components/KanbanBoard';
import { GitHubWidget }          from '../../components/GitHubWidget';
import { SprintContextBanner }   from '../../components/SprintContextBanner';
import { ModuleDetailModal }     from '../../components/ModuleDetailModal';
import { TicketStatus }          from '../../types/ticket.types';

export const AprendizTablero = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showModuleDetail, setShowModuleDetail] = useState(false);

  // ── Proyecto del aprendiz ───────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  // ── Módulo activo ───────────────────────────────────────────────────────────
  const { data: activeSprint, isLoading: loadingSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(miProyecto?.id),
    enabled:  !!miProyecto?.id,
  });

  // ── Tickets del módulo ──────────────────────────────────────────────────────
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', miProyecto?.id, activeSprint?.id],
    queryFn:  () => ticketService.getAll(miProyecto?.id, activeSprint?.id),
    enabled:  !!miProyecto?.id && !!activeSprint,
  });

  // ── Recursos (para el widget de GitHub) ────────────────────────────────────
  const { data: recursos = [] } = useQuery({
    queryKey: ['recursos', miProyecto?.id],
    queryFn:  () => recursoService.getAll(miProyecto?.id),
    enabled:  !!miProyecto?.id,
    staleTime: 60_000,
  });
  const githubResource = (recursos as any[]).find((r: any) => r.tipo === 'github');

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: invalidate,
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'No se pudo actualizar'),
  });

  const claimMutation = useMutation({
    mutationFn: (ticketId: number) => ticketService.claimTicket(ticketId),
    onSuccess:  invalidate,
    onError:    (err: any) => alert(err?.response?.data?.message ?? 'No se pudo tomar la tarea'),
  });

  const markCompleteMutation = useMutation({
    mutationFn: (ticketId: number) => ticketService.markCompleteByAprendiz(ticketId),
    onSuccess:  invalidate,
    onError:    (err: any) => alert(err?.response?.data?.message ?? 'No se pudo marcar como lista'),
  });

  // ── Guard: sin proyecto ─────────────────────────────────────────────────────
  if (!miProyecto) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <LayoutGrid size={32} className="mb-3 opacity-30" />
        <p className="text-sm font-bold">No tienes un proyecto asignado.</p>
        <p className="text-xs mt-1 text-zinc-600">Pide al instructor que te asigne a un proyecto.</p>
      </div>
    );
  }

  // ── Derivados ───────────────────────────────────────────────────────────────
  const ticketsArr = tickets as any[];
  const done       = ticketsArr.filter(t => t.estado === 'done').length;
  const inProgress = ticketsArr.filter(t => t.estado === 'in_progress').length;
  const todo       = ticketsArr.filter(t => t.estado === 'to_do').length;
  const progress   = ticketsArr.length > 0 ? Math.round((done / ticketsArr.length) * 100) : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden">

      {/* ── Cabecera: módulo activo + stats ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1 pb-4 shrink-0 flex-wrap">
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
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
              Sin módulo activo
            </span>
          </div>
        )}
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

      {/* ── GitHub Widget ────────────────────────────────────────────────────── */}
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

      {/* ── Tablero ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loadingSprint ? (
          <div className="flex gap-5 h-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />
            ))}
          </div>
        ) : !activeSprint ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
            <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center mb-5">
              <LayoutGrid size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-black text-zinc-300 mb-2">El tablero está en espera</h3>
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              El instructor debe activar un módulo para iniciar el flujo de trabajo del equipo.
            </p>
          </div>
        ) : loadingTickets ? (
          <div className="flex gap-5 h-full overflow-x-auto pb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-zinc-800/40 rounded-md border border-zinc-700/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <KanbanBoard
              tickets={ticketsArr}
              role="aprendiz"
              currentUserId={user?.id}
              onStatusChange={(ticketId, status) =>
                updateStatusMutation.mutate({ ticketId, status })
              }
              onClaim={(ticketId) => claimMutation.mutate(ticketId)}
              onMarkComplete={(ticketId) => markCompleteMutation.mutate(ticketId)}
            />
          </div>
        )}
      </div>

      {/* ── Modal: Detalle del módulo (solo lectura para aprendiz) ───────── */}
      {showModuleDetail && activeSprint && (
        <ModuleDetailModal
          sprint={activeSprint}
          tickets={ticketsArr}
          onClose={() => setShowModuleDetail(false)}
          canEdit={false}
        />
      )}
    </div>
  );
};
