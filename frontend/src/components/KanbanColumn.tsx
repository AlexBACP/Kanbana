import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ticket, TicketStatus } from '../types/ticket.types';
import { TicketCard } from './TicketCard';

interface KanbanColumnProps {
  status: TicketStatus;
  label: string;
  // ▼ NUEVO: descripción corta que aparece bajo el título de la columna
  desc: string;
  tickets: Ticket[];
  color: string;
}

export const KanbanColumn = ({ status, label, desc, tickets, color }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-dark-card/50 rounded-[2.5rem] p-5 w-80 min-h-[600px] border transition-all duration-200 ${
        isOver
          ? 'bg-primary-500/5 ring-2 ring-primary-500/30 border-primary-500/40 scale-[1.01]'
          : 'border-dark-border'
      }`}
    >
      {/* ▼ CAMBIO: encabezado con label en español + descripción + contador */}
      <div className="flex items-start justify-between mb-6 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_8px_rgba(0,0,0,0.4)]`} />
            <h3 className="text-sm font-black text-dark-text uppercase tracking-widest">{label}</h3>
          </div>
          {/* ▼ NUEVO: subtítulo descriptivo de la columna */}
          <p className="text-[10px] text-dark-muted ml-5 leading-tight">{desc}</p>
        </div>
        <span className="text-[10px] font-black text-dark-muted bg-dark-bg border border-dark-border rounded-full px-3 py-1 shadow-inner shrink-0">
          {tickets.length}
        </span>
      </div>

      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-4 flex-1">
          {tickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
          {/* ▼ CAMBIO: zona de drop vacía más visible cuando la columna no tiene tickets */}
          {tickets.length === 0 && (
            <div className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] transition-all min-h-32 ${
              isOver
                ? 'border-primary-500/50 bg-primary-500/5'
                : 'border-dark-border opacity-30'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-dark-muted">
                {isOver ? 'Soltar aquí' : 'Sin tareas'}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};