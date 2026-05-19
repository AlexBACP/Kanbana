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
import { arrayMove } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { KanbanColumn } from './KanbanColumn';
import { TicketCard } from './TicketCard';

interface KanbanBoardProps {
  tickets: Ticket[];
  onStatusChange: (ticketId: number, newStatus: TicketStatus) => void;
  readonly?: boolean;
}

// ▼ CAMBIO: estados en español adaptados al contexto SENA
const columns: { status: TicketStatus; label: string; color: string; desc: string }[] = [
  { status: 'to_do',       label: 'Por hacer',    color: 'bg-slate-400',  desc: 'Tareas pendientes de iniciar' },
  { status: 'in_progress', label: 'En desarrollo', color: 'bg-blue-400',   desc: 'Tareas en ejecución activa' },
  { status: 'testing',     label: 'En revisión',   color: 'bg-amber-400',  desc: 'Pendiente de validación' },
  { status: 'done',        label: 'Finalizado',    color: 'bg-emerald-400',desc: 'Tarea completada y aprobada' },
];

export const KanbanBoard = ({ tickets, onStatusChange, readonly = false }: KanbanBoardProps) => {
  // ▼ NUEVO: rastrear qué ticket se está arrastrando para mostrar el DragOverlay
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  // ▼ NUEVO: PointerSensor con distancia mínima de 8px para evitar drags accidentales al hacer click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Si readonly, distancia imposible → DnD desactivado para aprendiz normal
      activationConstraint: { distance: readonly ? 999999 : 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find(t => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // reservado para reordenamiento visual futuro dentro de la misma columna
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readonly) return; // aprendiz normal no puede mover tarjetas
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const ticketId = active.id as number;
    // over.id puede ser el status de una columna (string) o el id de otro ticket (number)
    // ▼ NUEVO: si cae sobre otro ticket, buscamos a qué columna pertenece ese ticket
    let newStatus: TicketStatus;
    const isColumn = columns.some(c => c.status === over.id);
    if (isColumn) {
      newStatus = over.id as TicketStatus;
    } else {
      const targetTicket = tickets.find(t => t.id === over.id);
      if (!targetTicket) return;
      newStatus = targetTicket.estado;
    }

    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket && ticket.estado !== newStatus) {
      onStatusChange(ticketId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      // ▼ CAMBIO: closestCorners funciona mejor para columnas separadas que closestCenter
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full min-w-max px-2">
        {columns.map(({ status, label, color, desc }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            desc={desc}
            color={color}
            tickets={tickets.filter(t => t.estado === status)}
          />
        ))}
      </div>

      {/* ▼ NUEVO: DragOverlay muestra una copia "flotante" de la tarjeta mientras se arrastra */}
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