/**
 * RejectModal — Modal de rechazo para el líder técnico.
 *
 * Reemplaza el browser prompt() con una UI en condiciones que:
 *  1. Muestra un aviso explicando qué pasa al rechazar.
 *  2. Permite escribir el motivo de rechazo (opcional).
 *  3. Ofrece "Rechazar y comentar" que además navega al detalle del ticket
 *     para que el líder deje un comentario explicando las correcciones.
 */
import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { RotateCcw, MessageSquare } from 'lucide-react';
import { Modal }               from './Modal';

interface RejectModalProps {
  /** Ticket que se va a rechazar. null = modal cerrado. */
  ticket:      { id: number; titulo?: string } | null;
  onClose:     () => void;
  onReject:    (ticketId: number, motivo: string) => void;
  isPending?:  boolean;
}

export const RejectModal = ({ ticket, onClose, onReject, isPending }: RejectModalProps) => {
  const navigate      = useNavigate();
  const [motivo, setMotivo] = useState('');

  // Limpiar motivo cada vez que se abre un ticket nuevo
  useEffect(() => {
    if (ticket) setMotivo('');
  }, [ticket?.id]);

  const handleReject = () => {
    if (!ticket) return;
    onReject(ticket.id, motivo);
  };

  const handleRejectAndComment = () => {
    if (!ticket) return;
    onReject(ticket.id, motivo);
    // Navegar al detalle para que el líder agregue un comentario con instrucciones
    navigate(`/tickets/${ticket.id}`);
  };

  return (
    <Modal isOpen={!!ticket} onClose={onClose} title="Rechazar tarea">
      <div className="space-y-4">

        {/* Nombre del ticket */}
        {ticket?.titulo && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Ticket:{' '}
            <span className="font-semibold text-zinc-200">{ticket.titulo}</span>
          </p>
        )}

        {/* Aviso informativo */}
        <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <MessageSquare size={13} className="shrink-0 mt-0.5 text-amber-400" />
          <p className="text-xs text-amber-300 leading-relaxed">
            La tarea volverá a{' '}
            <span className="font-black text-amber-200">En desarrollo</span>{' '}
            marcada en rojo. Usa{' '}
            <span className="font-black text-amber-200">Rechazar y comentar</span>{' '}
            para explicar al aprendiz exactamente qué debe corregir.
          </p>
        </div>

        {/* Motivo */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Motivo del rechazo (opcional)
          </label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej: El módulo de autenticación no valida el token correctamente..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-rose-500/50 placeholder:text-zinc-600 resize-none transition-colors"
            autoFocus
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl text-xs font-black transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black transition-all disabled:opacity-50"
          >
            <RotateCcw size={11} /> Rechazar
          </button>
          <button
            onClick={handleRejectAndComment}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-600/15 hover:bg-amber-600/30 border border-amber-500/25 text-amber-400 rounded-xl text-xs font-black transition-all disabled:opacity-50"
          >
            <MessageSquare size={11} /> Rechazar y comentar
          </button>
        </div>
      </div>
    </Modal>
  );
};
