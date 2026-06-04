import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { KanbanColumn } from './KanbanColumn';
import { TicketCard, TicketCardActions } from './TicketCard';

interface KanbanBoardProps {
  tickets:        Ticket[];
  onStatusChange: (ticketId: number, newStatus: TicketStatus) => void;
  readonly?:      boolean;
  // ── Role-aware actions ────────────────────────────────────────────────────
  // Si se proveen, el board muestra botones de acción contextuales en cada tarjeta.
  role?:           string;   // 'aprendiz' | 'lider_tecnico' | 'instructor' | 'coordinador'
  currentUserId?:  number;
  onClaim?:        (ticketId: number) => void;  // aprendiz: tomar tarea libre
  onMarkComplete?: (ticketId: number) => void;  // aprendiz: marcar listo para revisión
  onApprove?:      (ticketId: number) => void;  // líder: aprobar testing → done
  onReject?:       (ticketId: number) => void;  // líder: rechazar → in_progress + rojo
}

const columns: { status: TicketStatus; label: string; color: string; desc: string }[] = [
  { status: 'to_do',       label: 'Por hacer',    color: 'bg-slate-400',   desc: 'Tareas pendientes de iniciar' },
  { status: 'in_progress', label: 'En desarrollo', color: 'bg-blue-400',    desc: 'Tareas en ejecución activa' },
  { status: 'testing',     label: 'En revisión',   color: 'bg-amber-400',   desc: 'Pendiente de validación' },
  { status: 'done',        label: 'Finalizado',    color: 'bg-emerald-400', desc: 'Tarea completada y aprobada' },
];

export const KanbanBoard = ({
  tickets,
  onStatusChange,
  readonly = false,
  role,
  currentUserId,
  onClaim,
  onMarkComplete,
  onApprove,
  onReject,
}: KanbanBoardProps) => {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: readonly ? 999999 : 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find(t => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // reservado para reordenamiento visual futuro
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readonly) return;
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const ticketId = active.id as number;
    let newStatus: TicketStatus;
    const allStatuses = [...columns.map(c => c.status), 'finalizado_aprendiz'];
    const isColumn = allStatuses.includes(over.id as string);
    if (isColumn) {
      newStatus = over.id as TicketStatus;
    } else {
      const targetTicket = tickets.find(t => t.id === over.id);
      if (!targetTicket) return;
      // En el tablero del aprendiz, las tarjetas done están en la columna virtual
      newStatus = (role === 'aprendiz' && targetTicket.estado === 'done')
        ? 'finalizado_aprendiz' as TicketStatus
        : targetTicket.estado;
    }

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // ── Restricciones de arrastre por rol ───────────────────────────────────

    if (role === 'aprendiz') {
      // Aprendiz arrastra a "Finalizado" (columna virtual) → markCompleteByAprendiz
      if (newStatus === ('finalizado_aprendiz' as TicketStatus)) {
        // Solo desde in_progress, y solo si es su tarea
        if (ticket.estado !== 'in_progress') return;
        if (onMarkComplete) onMarkComplete(ticketId);
        return;
      }
      // Aprendiz no puede ir a done real ni a testing directamente
      if (newStatus === 'done' || newStatus === 'testing') return;
      // Si la tarea ya está en Finalizado (testing/done), no puede volver atrás por drag
      if (ticket.estado === 'testing' || ticket.estado === 'done') return;
    }

    // Líder técnico: puede mover hasta testing, NO a done
    if (role === 'lider_tecnico' && newStatus === 'done') return;

    if (ticket.estado === newStatus) return;

    // Instructor/coordinador: sin restricciones
    onStatusChange(ticketId, newStatus);
  };

  // ── Calcula las acciones disponibles para cada ticket según el rol ─────────
  const getActions = (ticket: Ticket): TicketCardActions | undefined => {
    const asignadoId = (ticket as any).asignado_a?.id ?? (ticket as any).asignado_a_id ?? ticket.asignado_a;

    if (role === 'aprendiz') {
      // Tomar tarea: to_do sin asignar y onClaim disponible
      if (ticket.estado === 'to_do' && !asignadoId && onClaim) {
        return { onClaim: () => onClaim(ticket.id) };
      }
      // Marcar listo: in_progress, asignada a mí, aún no marcada como completa
      if (
        ticket.estado === 'in_progress' &&
        asignadoId === currentUserId &&
        !ticket.completado_por_aprendiz &&
        onMarkComplete
      ) {
        return { onMarkComplete: () => onMarkComplete(ticket.id) };
      }
    }

    if (role === 'lider_tecnico') {
      // Aprobar / rechazar: tarea en revisión (aprendiz la marcó como lista)
      if (ticket.estado === 'testing') {
        return {
          ...(onApprove ? { onApprove: () => onApprove(ticket.id) } : {}),
          ...(onReject  ? { onReject:  () => onReject(ticket.id)  } : {}),
        };
      }
    }
    // Instructor y coordinador revisan el módulo completo, no tareas individuales.

    return undefined;
  };

  // ── Columnas según rol ────────────────────────────────────────────────────
  // Aprendiz: to_do | in_progress | Finalizado (virtual: agrupa testing + done)
  //   • "Finalizado" en vista aprendiz = ticket enviado a revisión o ya aprobado
  //   • El aprendiz arrastra a "Finalizado" → llama a markCompleteByAprendiz
  // Líder / Instructor: 4 columnas reales (to_do | in_progress | testing | done)
  const APRENDIZ_COLS: { status: TicketStatus; label: string; color: string; desc: string }[] = [
    { status: 'to_do',                    label: 'Por hacer',    color: 'bg-slate-400',   desc: 'Tareas pendientes de iniciar' },
    { status: 'in_progress',              label: 'En desarrollo', color: 'bg-blue-400',   desc: 'Tareas en ejecución activa' },
    { status: 'finalizado_aprendiz' as TicketStatus, label: 'Finalizado', color: 'bg-emerald-400', desc: 'Tarea terminada — esperando revisión del líder' },
  ];

  const visibleColumns = role === 'aprendiz' ? APRENDIZ_COLS : columns;

  // Para la columna virtual del aprendiz, mostrar tanto testing como done
  const getColumnTickets = (status: TicketStatus) => {
    if (role === 'aprendiz' && status === ('finalizado_aprendiz' as TicketStatus)) {
      return tickets.filter(t => t.estado === 'testing' || t.estado === 'done');
    }
    return tickets.filter(t => t.estado === status);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 h-full min-w-max px-1 snap-x snap-mandatory sm:snap-none">
        {visibleColumns.map(({ status, label, color, desc }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            desc={desc}
            color={color}
            tickets={getColumnTickets(status)}
            getActions={getActions}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTicket ? (
          <div className="rotate-2 scale-105 shadow-2xl shadow-primary-500/20 pointer-events-none">
            <TicketCard ticket={activeTicket} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
