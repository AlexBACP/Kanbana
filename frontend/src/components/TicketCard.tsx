import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import {
  Clock, AlertCircle, Flag, GripVertical,
  CheckCheck, ThumbsUp, RotateCcw, Zap,
} from 'lucide-react';
import { Ticket } from '../types/ticket.types';
import { Avatar } from './Avatar';

// ── Acciones opcionales por tarjeta ──────────────────────────────────────────
export interface TicketCardActions {
  onClaim?:        () => void;  // Aprendiz: tomar tarea libre del pool
  onMarkComplete?: () => void;  // Aprendiz: marcar trabajo listo para revisión
  onApprove?:      () => void;  // Líder: aprobar → testing
  onReject?:       () => void;  // Líder: rechazar → devolver al pool
}

interface TicketCardProps {
  ticket:   Ticket;
  actions?: TicketCardActions;
}

export const TicketCard = ({ ticket, actions }: TicketCardProps) => {
  const navigate = useNavigate();

  const {
    attributes, listeners,
    setNodeRef, transform, transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex:  isDragging ? 999 : undefined,
  };

  const daysUntil = ticket.fecha_limite
    ? Math.ceil((new Date(ticket.fecha_limite).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = daysUntil !== null && daysUntil < 0;
  const isNear    = daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;

  const assigneeName       = (ticket as any).asignado_a?.nombre ?? ticket.asignado_a_rel?.nombre;
  const isCompletedByAprendiz = ticket.completado_por_aprendiz === true;

  const hasActions = actions && (
    actions.onClaim || actions.onMarkComplete || actions.onApprove || actions.onReject
  );

  // ── Priority left-bar colour ──────────────────────────────────────────────
  const accentBar = isCompletedByAprendiz
    ? 'bg-emerald-500/80'
    : ticket.prioridad === 'alta'  ? 'bg-rose-500/80'
    : ticket.prioridad === 'media' ? 'bg-amber-500/60'
    : 'bg-zinc-600/40';

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => navigate(`/tickets/${ticket.id}`)}
        className={`group relative rounded-md border cursor-pointer overflow-hidden transition-all duration-200 ${
          isCompletedByAprendiz
            ? 'bg-emerald-950/35 border-emerald-500/30 hover:border-emerald-400/50'
            : isDragging
              ? 'bg-zinc-800 border-zinc-500/60 shadow-2xl'
              : 'bg-zinc-900/80 border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800/70'
        }`}
      >
        {/* Priority accent bar */}
        <div className={`absolute inset-y-0 left-0 w-[3px] ${accentBar}`} />

        {/* Card body */}
        <div className="pl-3.5 pr-2.5 py-2.5">

          {/* Row 1 — meta: ID · badges · drag handle */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-black text-zinc-600 tracking-wider shrink-0">
                #{ticket.id}
              </span>
              {ticket.esta_bloqueado && (
                <Flag size={9} className="text-rose-400 shrink-0" fill="currentColor"
                  title={ticket.motivo_bloqueo ?? 'Bloqueado'} />
              )}
              {isCompletedByAprendiz && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-400 uppercase tracking-wider shrink-0">
                  <CheckCheck size={8} /> Listo
                </span>
              )}
            </div>
            {/* Drag handle — stops click propagation */}
            <div
              {...attributes}
              {...listeners}
              onClick={e => e.stopPropagation()}
              className="shrink-0 ml-1 p-0.5 rounded text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical size={10} />
            </div>
          </div>

          {/* Row 2 — Title */}
          <p className={`text-[12px] font-semibold leading-snug mb-2 line-clamp-2 ${
            isCompletedByAprendiz
              ? 'text-emerald-100/80'
              : 'text-zinc-200 group-hover:text-white'
          }`}>
            {ticket.titulo}
          </p>

          {/* Row 3 — Date + Assignee */}
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-1 text-[10px] font-medium shrink-0 ${
              isOverdue ? 'text-rose-400' : isNear ? 'text-amber-400' : 'text-zinc-600'
            }`}>
              {isOverdue ? <AlertCircle size={9} /> : <Clock size={9} />}
              {daysUntil !== null
                ? isOverdue
                  ? 'Vencido'
                  : `${daysUntil}d`
                : '—'
              }
            </span>
            {assigneeName && <Avatar nombre={assigneeName} size="xs" />}
          </div>
        </div>

        {/* Action buttons */}
        {hasActions && (
          <div
            className="px-3 py-2 border-t border-zinc-700/30 flex gap-1.5 flex-wrap"
            onClick={e => e.stopPropagation()}
          >
            {actions?.onClaim && (
              <button
                onClick={actions.onClaim}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600/10 hover:bg-blue-600/25 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 text-[10px] font-black rounded transition-all"
              >
                <Zap size={9} /> Tomar
              </button>
            )}
            {actions?.onMarkComplete && (
              <button
                onClick={actions.onMarkComplete}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded transition-all"
              >
                <CheckCheck size={9} /> Listo
              </button>
            )}
            {actions?.onApprove && (
              <button
                onClick={actions.onApprove}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded transition-all"
              >
                <ThumbsUp size={9} /> Aprobar
              </button>
            )}
            {actions?.onReject && (
              <button
                onClick={actions.onReject}
                className="flex items-center gap-1 px-2 py-1 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 text-[10px] font-black rounded transition-all"
              >
                <RotateCcw size={9} /> Devolver
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
