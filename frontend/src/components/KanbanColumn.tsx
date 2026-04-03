import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { TicketCard } from './TicketCard';

interface KanbanColumnProps {
  status: TicketStatus;
  label: string;
  tickets: Ticket[];
  color: string;
}

export const KanbanColumn = ({ status, label, tickets, color }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-dark-card/50 rounded-[2.5rem] p-5 w-80 min-h-[600px] border border-dark-border transition-all duration-300
        ${isOver ? 'bg-primary-500/5 ring-2 ring-primary-500/20 border-primary-500/30' : ''}`}
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
          <h3 className="text-sm font-black text-dark-text uppercase tracking-widest opacity-80">{label}</h3>
        </div>
        <span className="text-[10px] font-black text-dark-muted bg-dark-bg border border-dark-border rounded-full px-3 py-1 shadow-inner">
          {tickets.length}
        </span>
      </div>

      <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-4 flex-1">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
          {tickets.length === 0 && !isOver && (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-dark-border rounded-[2rem] opacity-20">
               <span className="text-[10px] font-black uppercase tracking-widest">Vacío</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};