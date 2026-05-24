import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { TicketCard, TicketCardActions } from './TicketCard';

interface KanbanColumnProps {
  status:     TicketStatus;
  label:      string;
  desc:       string;
  tickets:    Ticket[];
  color:      string;
  getActions?: (ticket: Ticket) => TicketCardActions | undefined;
}

export const KanbanColumn = ({
  status, label, desc, tickets, color, getActions,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 h-full rounded-xl border transition-all duration-200 ${
        isOver
          ? 'bg-blue-950/20 border-blue-500/30 ring-1 ring-blue-500/20'
          : 'bg-zinc-900/50 border-zinc-700/40'
      }`}
    >
      {/* ── Column header ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-zinc-700/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${color}`} />
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate" title={desc}>
            {label}
          </h3>
        </div>
        <span className="shrink-0 text-[10px] font-black text-zinc-600 tabular-nums ml-2">
          {tickets.length}
        </span>
      </div>

      {/* ── Cards — independently scrollable ──────────────────────────── */}
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
          {tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              actions={getActions ? getActions(ticket) : undefined}
            />
          ))}

          {tickets.length === 0 && (
            <div className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-md min-h-16 transition-all ${
              isOver
                ? 'border-blue-500/40 bg-blue-500/5 text-blue-400'
                : 'border-zinc-700/30 text-zinc-700'
            }`}>
              <span className="text-[9px] font-black uppercase tracking-widest">
                {isOver ? 'Soltar aquí' : 'Vacía'}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};
