import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, Flag, GripVertical } from 'lucide-react';
import { Ticket } from '../types/ticket.types';
import { Avatar } from './Avatar';

export const TicketCard = ({ ticket }: { ticket: Ticket }) => {
  const navigate = useNavigate();

  // ▼ NUEVO: conectar la tarjeta como elemento arrastrable con useSortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ▼ NUEVO: mientras se arrastra, la tarjeta se vuelve semi-transparente
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const daysUntil = ticket.fecha_limite
    ? Math.ceil((new Date(ticket.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = daysUntil !== null && daysUntil < 0;
  const isNear    = daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;

  const assigneeName = ticket.asignado_a_rel?.nombre;

  return (
    // ▼ NUEVO: ref + style del sortable aplicados al contenedor
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => navigate(`/tickets/${ticket.id}`)}
        className={`group bg-dark-bg border border-dark-border p-5 rounded-2xl shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/40 transition-all duration-300 cursor-pointer relative overflow-hidden ${
          isDragging ? 'shadow-2xl border-primary-500/60' : ''
        }`}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest bg-primary-500/5 px-2 py-0.5 rounded-md border border-primary-500/10">
            OKAF-{ticket.id}
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)] ${
              ticket.prioridad === 'alta'  ? 'bg-rose-500 shadow-rose-500/50' :
              ticket.prioridad === 'media' ? 'bg-indigo-500 shadow-indigo-500/50' :
              'bg-slate-500'
            }`} />
            {/* ▼ NUEVO: handle de arrastre — detiene el click de navegación para no abrir el ticket al arrastrar */}
            <div
              {...attributes}
              {...listeners}
              onClick={e => e.stopPropagation()}
              className="p-1 rounded-lg text-dark-muted/40 hover:text-dark-muted hover:bg-dark-card cursor-grab active:cursor-grabbing transition-colors"
              title="Arrastrar"
            >
              <GripVertical size={13} />
            </div>
          </div>
        </div>

        <h4 className="text-sm font-bold text-dark-text leading-snug mb-4 group-hover:text-primary-400 transition-colors">
          {ticket.titulo}
        </h4>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-dark-border/50">
          <div className="flex items-center gap-2">
            {ticket.esta_bloqueado && (
              <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/20" title={ticket.motivo_bloqueo}>
                <Flag size={12} fill="currentColor" />
              </div>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 bg-dark-card rounded-lg border border-dark-border shadow-sm ${
              isOverdue ? 'text-rose-500' : isNear ? 'text-amber-500' : 'text-dark-muted'
            }`}>
              {isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {daysUntil !== null ? (isOverdue ? 'Vencido' : isNear ? 'Vence hoy' : `${daysUntil}d`) : 'Sin fecha'}
              </span>
            </div>
          </div>

          <div className="flex -space-x-2">
            {assigneeName && <Avatar nombre={assigneeName} size="sm" />}
          </div>
        </div>
      </div>
    </div>
  );
};