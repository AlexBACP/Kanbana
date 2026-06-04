import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import {
  Clock, AlertCircle, Flag, GripVertical,
  CheckCheck, ThumbsUp, RotateCcw, Zap, XCircle,
  Paperclip, Bug, Layers, BookOpen, Zap as ZapIcon,
} from 'lucide-react';
import { Ticket } from '../types/ticket.types';
import type { TicketAttachment } from '../types/trimestre.types';
import { Avatar } from './Avatar';
import { FileViewerModal } from './FileViewerModal';
import { userService } from '../services/user.service';

// ── Configuración por tipo de tarea ──────────────────────────────────────────
const TYPE_CFG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  task:  { label: 'Tarea',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Layers      },
  bug:   { label: 'Bug',       color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   icon: Bug         },
  story: { label: 'Historia',  color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: BookOpen    },
};

// ── Config de prioridad (punto indicador) ─────────────────────────────────────
const PRIO_DOT: Record<string, string> = {
  alta:  'bg-rose-500',
  media: 'bg-amber-500',
  baja:  'bg-zinc-600',
};

// ── Acciones opcionales por tarjeta ──────────────────────────────────────────
export interface TicketCardActions {
  onClaim?:        () => void;
  onMarkComplete?: () => void;
  onApprove?:      () => void;
  onReject?:       () => void;
}

interface TicketCardProps {
  ticket:   Ticket;
  actions?: TicketCardActions;
}

export const TicketCard = ({ ticket, actions }: TicketCardProps) => {
  const navigate = useNavigate();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const adjuntos    = ((ticket as any).adjuntos ?? []) as TicketAttachment[];
  const sprintName  = (ticket as any).sprint?.nombre ?? null;
  const storyPoints = (ticket as any).story_points ?? 0;

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

  // ── Fecha límite ───────────────────────────────────────────────────────────
  const daysUntil = ticket.fecha_limite
    ? Math.ceil((new Date(ticket.fecha_limite).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = daysUntil !== null && daysUntil < 0;
  const isNear    = daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;

  // ── Estados especiales ─────────────────────────────────────────────────────
  const assigneeName          = (ticket as any).asignado_a?.nombre ?? ticket.asignado_a_rel?.nombre;
  const isCompletedByAprendiz = ticket.completado_por_aprendiz === true;
  const isRejected            = ticket.esta_bloqueado && ticket.estado === 'in_progress';

  const hasActions = actions && (
    actions.onClaim || actions.onMarkComplete || actions.onApprove || actions.onReject
  );

  // ── Config de tipo ─────────────────────────────────────────────────────────
  const typeCfg = TYPE_CFG[(ticket as any).tipo ?? 'task'] ?? TYPE_CFG.task;
  const TypeIcon = typeCfg.icon;

  // ── Color de fondo según estado ────────────────────────────────────────────
  const cardBase = isRejected
    ? 'bg-rose-950/30 border-rose-500/30 hover:border-rose-400/50'
    : isCompletedByAprendiz
      ? 'bg-emerald-950/30 border-emerald-500/25 hover:border-emerald-400/40'
      : isDragging
        ? 'bg-zinc-800 border-zinc-500/60 shadow-2xl'
        : 'bg-zinc-900 border-zinc-700/60 hover:border-zinc-500/80 hover:bg-zinc-800/90 hover:shadow-md hover:shadow-black/40';

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => navigate(`/tickets/${ticket.id}`)}
        className={`group rounded-xl border cursor-pointer overflow-hidden transition-all duration-200 ${cardBase}`}
      >
        {/* ── Cabecera ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2 gap-2">

          {/* Izquierda: tipo + #número + badges */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">

            {/* Tipo de tarea */}
            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest shrink-0 ${typeCfg.bg} ${typeCfg.color} ${typeCfg.border}`}>
              <TypeIcon size={8} />
              {typeCfg.label}
            </span>

            {/* Número de módulo */}
            {(ticket as any).sprint_id && (ticket as any).ticket_number && (
              <span className="text-[9px] font-black text-zinc-500 shrink-0">
                #{(ticket as any).ticket_number}
              </span>
            )}

            {/* Punto de prioridad */}
            {ticket.prioridad !== 'baja' && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIO_DOT[ticket.prioridad]}`} title={`Prioridad ${ticket.prioridad}`} />
            )}

            {/* Badge: bloqueado */}
            {ticket.esta_bloqueado && !isRejected && (
              <Flag size={9} className="text-rose-400 shrink-0" fill="currentColor" />
            )}

            {/* Badge: completado por aprendiz */}
            {isCompletedByAprendiz && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-[8px] font-black text-emerald-400 uppercase tracking-wider shrink-0">
                <CheckCheck size={7} /> Listo
              </span>
            )}

            {/* Badge: rechazado */}
            {isRejected && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-500/15 border border-rose-500/25 rounded-full text-[8px] font-black text-rose-400 uppercase tracking-wider shrink-0">
                <XCircle size={7} /> Rechazado
              </span>
            )}
          </div>

          {/* Derecha: story points + drag */}
          <div className="flex items-center gap-2 shrink-0">
            {storyPoints > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-black text-zinc-500 bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 rounded-full">
                <ZapIcon size={7} className="text-amber-500" />
                {storyPoints}
              </span>
            )}
            <div
              {...attributes}
              {...listeners}
              onClick={e => e.stopPropagation()}
              title="Arrastra para mover"
              aria-label="Arrastrar tarea"
              className="p-1 rounded-md text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical size={11} />
            </div>
          </div>
        </div>

        {/* ── Título ──────────────────────────────────────────────────────── */}
        <p className={`px-3.5 text-[13px] font-semibold leading-snug line-clamp-2 ${
          isRejected
            ? 'text-rose-100/80'
            : isCompletedByAprendiz
              ? 'text-emerald-100/70'
              : 'text-zinc-200 group-hover:text-white'
        }`}>
          {ticket.titulo}
        </p>

        {/* ── Motivo de rechazo ────────────────────────────────────────────── */}
        {isRejected && ticket.motivo_bloqueo && (
          <div className="mx-3.5 mt-2 px-2.5 py-1.5 bg-rose-500/8 border border-rose-500/20 rounded-lg text-[10px] text-rose-300 leading-snug">
            <span className="font-black text-rose-400 block mb-0.5">↩ Corrección:</span>
            <span className="line-clamp-2">{ticket.motivo_bloqueo}</span>
          </div>
        )}

        {/* ── Módulo al que pertenece ──────────────────────────────────────── */}
        {sprintName && (
          <div className="px-3.5 mt-2">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 px-2 py-0.5 rounded-full">
              <BookOpen size={7} />
              {sprintName}
            </span>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3.5 pt-2 pb-3 mt-1">

          {/* Izquierda: fecha + adjuntos */}
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1 text-[10px] font-medium ${
              isOverdue ? 'text-rose-400' : isNear ? 'text-amber-400' : 'text-zinc-600'
            }`}>
              {isOverdue ? <AlertCircle size={9} /> : <Clock size={9} />}
              {daysUntil !== null
                ? isOverdue ? 'Vencido' : `${daysUntil}d`
                : <span className="text-zinc-700">Sin fecha</span>
              }
            </span>
            {adjuntos.length > 0 && (
              <span
                className="flex items-center gap-0.5 text-[9px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                onClick={e => { e.stopPropagation(); setViewerIndex(0); }}
                title={`${adjuntos.length} adjunto${adjuntos.length > 1 ? 's' : ''}`}
              >
                <Paperclip size={9} />
                {adjuntos.length}
              </span>
            )}
          </div>

          {/* Derecha: nombre del asignado + avatar */}
          {assigneeName && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-zinc-500 truncate max-w-[56px] hidden sm:block">
                {assigneeName.split(' ')[0]}
              </span>
              <Avatar
                nombre={assigneeName}
                size="xs"
                avatarUrl={(ticket as any).asignado_a?.avatar_url ?? (ticket as any).asignado_a_rel?.avatar_url}
              />
            </div>
          )}
        </div>

        {/* ── Botones de acción ────────────────────────────────────────────── */}
        {hasActions && (
          <div
            className="px-3 pb-3 flex gap-1.5 flex-wrap"
            onClick={e => e.stopPropagation()}
          >
            {actions?.onClaim && (
              <button
                onClick={actions.onClaim}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/25 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 text-[10px] font-black rounded-lg transition-all"
              >
                <Zap size={9} /> Tomar
              </button>
            )}
            {actions?.onMarkComplete && (
              <button
                onClick={actions.onMarkComplete}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded-lg transition-all"
              >
                <CheckCheck size={9} /> Listo
              </button>
            )}
            {actions?.onApprove && (
              <button
                onClick={actions.onApprove}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded-lg transition-all"
              >
                <ThumbsUp size={9} /> Aprobar
              </button>
            )}
            {actions?.onReject && (
              <button
                onClick={actions.onReject}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 text-[10px] font-black rounded-lg transition-all"
              >
                <RotateCcw size={9} /> Rechazar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Visor de archivos ─────────────────────────────────────────────── */}
      {viewerIndex !== null && (
        <FileViewerModal
          attachments={adjuntos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  );
};
