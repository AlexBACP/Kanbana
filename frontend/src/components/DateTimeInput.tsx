/**
 * DateTimeInput — Input de fecha (+ hora opcional) con:
 *  - Tema oscuro nativo (color-scheme: dark)
 *  - min / max visuales como hint de rango
 *  - Campo de hora opcional para deadline de clase
 *  - Consistente con el sistema de diseño zinc/dark
 */
import { Calendar, Clock, AlertCircle } from 'lucide-react';

interface DateTimeInputProps {
  /** ID del campo fecha (para formularios react-hook-form o nativos) */
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Fecha mínima seleccionable (YYYY-MM-DD) */
  min?: string;
  /** Fecha máxima seleccionable (YYYY-MM-DD) */
  max?: string;
  /** Si true, muestra también el campo de hora */
  withTime?: boolean;
  /** Nombre del campo de hora (para FormData) */
  timeName?: string;
  timeValue?: string;
  timeDefaultValue?: string;
  onTimeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Texto descriptivo del rango (ej: "Dentro del trimestre T1") */
  rangeLabel?: string;
  disabled?: boolean;
  required?: boolean;
  /** Ref para react-hook-form */
  inputRef?: React.Ref<HTMLInputElement>;
}

function fmtDateShort(d: string | undefined) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const baseCls = [
  'w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2.5',
  'text-[13px] text-zinc-100 outline-none',
  'hover:bg-zinc-900 focus:bg-zinc-900 focus:border-blue-500',
  'transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

// Calcula la hora actual en formato HH:MM — se usa como default del campo de hora
function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const DateTimeInput = ({
  id, name, value, defaultValue, onChange,
  min, max,
  withTime = false, timeName, timeValue, timeDefaultValue, onTimeChange,
  rangeLabel,
  disabled, required,
  inputRef,
}: DateTimeInputProps) => {
  const showRange = !!(min || max);

  // Si no se pasa timeDefaultValue y hay campo de hora, usar la hora actual
  const resolvedTimeDefault = timeDefaultValue ?? (withTime ? getCurrentTime() : undefined);

  return (
    <div className="space-y-1.5">
      {/* Hint de rango si hay min/max */}
      {showRange && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/8 border border-blue-500/15 rounded-md">
          <Calendar size={10} className="text-blue-400/70 shrink-0" />
          <span className="text-[10px] font-bold text-blue-400/80 flex-1">
            {rangeLabel ?? (
              <>
                {min && <span>{fmtDateShort(min)}</span>}
                {min && max && <span className="text-blue-400/40 mx-1">→</span>}
                {max && <span>{fmtDateShort(max)}</span>}
              </>
            )}
          </span>
          {max && (
            <span className="text-[9px] font-black text-blue-400/50 uppercase tracking-widest shrink-0">
              límite
            </span>
          )}
        </div>
      )}

      {/* Campo(s) de fecha [+ hora] */}
      <div className={`flex gap-2 ${withTime ? 'items-center' : ''}`}>
        <input
          ref={inputRef as any}
          type="date"
          id={id}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          className={`${baseCls} ${withTime ? 'flex-1' : 'w-full'}`}
        />

        {withTime && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded-md px-2.5 py-2.5 hover:border-blue-500/50 focus-within:border-blue-500 transition-colors">
              <Clock size={12} className="text-zinc-500 shrink-0" />
              <input
                type="time"
                name={timeName}
                value={timeValue}
                defaultValue={resolvedTimeDefault}
                onChange={onTimeChange}
                disabled={disabled}
                className="bg-transparent text-[13px] text-zinc-100 outline-none w-[72px] placeholder-zinc-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Aviso si la fecha seleccionada está fuera del rango */}
      {max && (
        <p className="text-[10px] text-zinc-600 flex items-center gap-1">
          <AlertCircle size={9} className="shrink-0" />
          Fecha límite del módulo: <span className="text-zinc-500 font-bold">{fmtDateShort(max)}</span>
        </p>
      )}
    </div>
  );
};
