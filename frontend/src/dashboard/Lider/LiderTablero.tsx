import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { KanbanBoard } from '../../components/KanbanBoard';
import { TicketStatus } from '../../types/ticket.types';

export const LiderTablero = () => {
  const qc = useQueryClient();

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: activeSprint } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'sprint', 'active'],
    queryFn: () => projectService.getActiveSprint(miProyecto?.id),
    enabled: !!miProyecto?.id,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', miProyecto?.id, activeSprint?.id],
    queryFn: () => ticketService.getAll(miProyecto?.id, activeSprint?.id),
    enabled: !!miProyecto?.id && !!activeSprint,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', miProyecto?.id] });
    },
  });

  const handleStatusChange = (ticketId: number, newStatus: TicketStatus) => {
    updateStatusMutation.mutate({ ticketId, status: newStatus });
  };

  if (!miProyecto) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-dark-muted">
        <p>No tienes un proyecto asignado.</p>
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-dark-muted border border-dashed border-dark-border rounded-xl">
        <p className="font-medium">No hay un modulo activo.</p>
        <p className="text-xs mt-1">Crea o inicia un modulo desde la sección de Tareas.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-widest">
          Tablero: {activeSprint.nombre}
        </h2>
      </div>
      
      {isLoading ? (
        <div className="flex-1 bg-dark-card/20 animate-pulse rounded-xl" />
      ) : (
        <KanbanBoard tickets={tickets} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
};
