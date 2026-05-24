/**
 * SprintContextBanner
 *
 * Muestra información contextual del sprint activo:
 *   nombre · rango de fechas · días restantes (con urgencia de color) · progreso
 *
 * Modos:
 *   compact=false (default) → barra horizontal completa para la cabecera del tablero
 *   compact=true            → pill pequeño, mismo espacio que el chip anterior
 */
import { Calendar, Info } from 'lucide-react';

interface SprintContextBannerProps {
  sprint: {
    nombre:              string;
    fecha_inicio:        string | Date;
    fecha_fin:           string | Date;
    pendiente_revision?: boolean;
  };
  ticketsDone?:  number;
  ticketsTotal?: number;
  compact?:      boolean;
  /** Si se provee, el banner se vuelve clickeable y muestra un ícono de detalle */
  onClick?:      () => void;
}

function getDaysRemaining(fechaFin: string | Date): number {
  const end = new Date(fechaFin);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtShort(d: string | Date) {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

type Urgency = {
  bg:     string;
  border: string;
  text:   string;
  dot:    string;
  label:  string;
};

function getUrgency(daysLeft: number, pendiente: boolean): Urgency {
  if (pendiente) return {
    bg:     'bg-violet-500/10',
    border: 'border-violet-500/20',
    text:   'text-violet-400',
    dot:    'bg-violet-500',
    label:  'En revisión',
  };
  if (daysLeft < 0) return {
    bg:     'bg-rose-500/10',
    border: 'border-rose-500/20',
    text:   'text-rose-400',
    dot:    'bg-rose-500',
    label:  `Vencido hace ${Math.abs(daysLeft)}d`,
  };
  if (daysLeft === 0) return {
    bg:     'bg-rose-500/10',
    border: 'border-rose-500/20',
    text:   'text-rose-400',
    dot:    'bg-rose-500 animate-pulse',
    label:  'Vence hoy',
  };
  if (daysLeft <= 3) return {
    bg:     'bg-amber-500/10',
    border: 'border-amber-500/20',
    text:   'text-amber-400',
    dot:    'bg-amber-500 animate-pulse',
    label:  `${daysLeft} día${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'}`,
  };
  return {
    bg:     'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text:   'text-emerald-400',
    dot:    'bg-emerald-500 animate-pulse',
    label:  `${daysLeft} días restantes`,
  };
}

export const SprintContextBanner = ({
  sprint,
  ticketsDone  = 0,
  ticketsTotal = 0,
  compact      = false,
  onClick,
}: SprintContextBannerProps) => {
  const daysLeft = getDaysRemaining(sprint.fecha_fin);
  const u        = getUrgency(daysLeft, !!sprint.pendiente_revision);
  const dateRange = `${fmtShort(sprint.fecha_inicio)} → ${fmtShort(sprint.fecha_fin)}`;
  const progress  = ticketsTotal > 0 ? Math.round((ticketsDone / ticketsTotal) * 100) : 0;

  const clickProps = onClick
    ? { onClick, role: 'button', tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onClick() }
    : {};

  /* ── Modo compacto: pill pequeño ─────────────────────────────── */
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${u.bg} ${u.border} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        {...clickProps}
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} />
        <span className={`text-[11px] font-black uppercase tracking-widest ${u.text}`}>
          {sprint.nombre}
        </span>
        <span className="text-zinc-700 text-[10px]">·</span>
        <span className={`text-[10px] font-bold ${u.text} opacity-80`}>{u.label}</span>
        {onClick && <Info size={9} className={`${u.text} opacity-60 ml-0.5`} />}
      </div>
    );
  }

  /* ── Modo completo: barra con fechas + progreso ───────────────── */
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${u.bg} ${u.border} flex-wrap ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      {...clickProps}
    >
      {/* Nombre + indicador */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} />
        <span className={`text-[12px] font-black uppercase tracking-widest ${u.text}`}>
          {sprint.nombre}
        </span>
        {onClick && <Info size={10} className={`${u.text} opacity-50`} />}
      </div>

      <span className="hidden sm:block text-zinc-700">·</span>

      {/* Fechas */}
      <div className="hidden sm:flex items-center gap-1.5 text-zinc-500 shrink-0">
        <Calendar size={10} />
        <span className="text-[11px] font-medium">{dateRange}</span>
      </div>

      <span className="hidden sm:block text-zinc-700">·</span>

      {/* Días restantes */}
      <span className={`text-[11px] font-black shrink-0 ${u.text}`}>{u.label}</span>

      {/* Contador de tareas */}
      {ticketsTotal > 0 && (
        <>
          <span className="text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-500 font-medium shrink-0">
            <span className="text-emerald-400 font-black">{ticketsDone}</span>
            <span className="text-zinc-600">/{ticketsTotal}</span>
          </span>

          {/* Mini barra de progreso */}
          <div className="flex-1 min-w-[60px] max-w-[120px] h-1 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progress === 100
                  ? 'bg-emerald-500'
                  : daysLeft <= 3
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className={`text-[11px] font-black hidden md:block ${
            progress === 100 ? 'text-emerald-400' : 'text-zinc-500'
          }`}>
            {progress}%
          </span>
        </>
      )}
    </div>
  );
};
