import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tickets: Ticket[];
  onStatusChange: (ticketId: number, newStatus: TicketStatus) => void;
}

const columns: { status: TicketStatus; label: string; color: string }[] = [
  { status: 'to_do', label: 'To Do', color: 'bg-gray-400' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-blue-400' },
  { status: 'testing', label: 'Testing', color: 'bg-yellow-400' },
  { status: 'done', label: 'Done', color: 'bg-green-400' },
];

export const KanbanBoard = ({ tickets, onStatusChange }: KanbanBoardProps) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const ticketId = active.id as number;
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && ticket.estado !== newStatus) {
      onStatusChange(ticketId, newStatus);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-8 h-full min-w-max px-2">
        {columns.map(({ status, label, color }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            color={color}
            tickets={tickets.filter((t) => t.estado === status)}
          />
        ))}
      </div>
    </DndContext>
  );
};