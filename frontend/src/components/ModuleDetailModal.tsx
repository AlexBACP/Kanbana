/**
 * ModuleDetailModal
 *
 * Modal de detalles del módulo activo. Muestra:
 *   - Nombre, fechas, estado de urgencia
 *   - Descripción / objetivos (editable por líder e instructor)
 *   - Progreso desglosado por estado de tarea
 *   - Distribución del equipo (tareas por miembro)
 *
 * Props:
 *   sprint     — módulo activo (incluye descripcion si existe)
 *   tickets    — tareas del módulo (con asignado_a)
 *   onClose    — cierra el modal
 *   canEdit    — si true, el usuario puede editar la descripción
 *   onSave     — callback después de guardar la descripción
 */
import { useState } from 'react';
import {
  X, Calendar, CheckCheck, Clock, AlertTriangle,
  Circle, Pencil, Save, Users, BarChart3,
} from 'lucide-react';

interface SprintShape {
  id:                  number;
  nombre:              string;
  fecha_inicio:        string | Date;
  fecha_fin:           string | Date;
  descripcion?:        string | null;
  pendiente_revision?: boolean;
  esta_finalizado?:    boolean;
}

interface ModuleDetailModalProps {
  sprint:   SprintShape;
  tickets:  any[];
  onClose:  () => void;
  canEdit?: boolean;
  onSave?:  (descripcion: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysRemaining(fechaFin: string | Date): number {
  const end = new Date(fechaFin);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtFull(d: string | Date) {
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

const STATUS_CFG = [
  { key: 'to_do',       label: 'Por hacer',    icon: Circle,        color: 'text-zinc-400',    bar: 'bg-zinc-500'    },
  { key: 'in_progress', label: 'En desarrollo', icon: Clock,         color: 'text-blue-400',    bar: 'bg-blue-500'    },
  { key: 'testing',     label: 'En revisión',   icon: AlertTriangle, color: 'text-amber-400',   bar: 'bg-amber-500'   },
  { key: 'done',        label: 'Completadas',   icon: CheckCheck,    color: 'text-emerald-400', bar: 'bg-emerald-500' },
] as const;

// ── Componente ─────────────────────────────────────────────────────────────────
export const ModuleDetailModal = ({
  sprint,
  tickets,
  onClose,
  canEdit = false,
  onSave,
}: ModuleDetailModalProps) => {
  const [editing,     setEditing]     = useState(false);
  const [draft,       setDraft]       = useState(sprint.descripcion ?? '');
  const [saving,      setSaving]      = useState(false);

  const daysLeft  = getDaysRemaining(sprint.fecha_fin);
  const total     = tickets.length;

  // ── Status counts ────────────────────────────────────────────────────────
  const counts = {
    to_do:       tickets.filter(t => t.estado === 'to_do').length,
    in_progress: tickets.filter(t => t.estado === 'in_progress').length,
    testing:     tickets.filter(t => t.estado === 'testing').length,
    done:        tickets.filter(t => t.estado === 'done').length,
  };
  const progress = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  // ── Team breakdown ───────────────────────────────────────────────────────
  const memberMap = new Map<string, { nombre: string; total: number; done: number }>();
  for (const t of tickets) {
    const name = t.asignado_a?.nombre ?? t.asignado_a_rel?.nombre ?? null;
    if (!name) continue;
    const entry = memberMap.get(name) ?? { nombre: name, total: 0, done: 0 };
    entry.total++;
    if (t.estado === 'done') entry.done++;
    memberMap.set(name, entry);
  }
  const unassigned = tickets.filter(t => !t.asignado_a && !t.asignado_a_rel).length;
  const members    = Array.from(memberMap.values()).sort((a, b) => b.total - a.total);

  // ── Urgency chip ─────────────────────────────────────────────────────────
  const urgencyChip = sprint.pendiente_revision
    ? { bg: 'bg-blue-500/15 border-blue-500/25 text-blue-400', label: 'En revisión instructor' }
    : sprint.esta_finalizado
    ? { bg: 'bg-zinc-500/15 border-zinc-500/25 text-zinc-400', label: 'Finalizado' }
    : daysLeft < 0
    ? { bg: 'bg-rose-500/15 border-rose-500/25 text-rose-400', label: `Vencido hace ${Math.abs(daysLeft)}d` }
    : daysLeft === 0
    ? { bg: 'bg-rose-500/15 border-rose-500/25 text-rose-400', label: 'Vence hoy' }
    : daysLeft <= 3
    ? { bg: 'bg-amber-500/15 border-amber-500/25 text-amber-400', label: `${daysLeft} día${daysLeft === 1 ? '' : 's'} restantes` }
    : { bg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400', label: `${daysLeft} días restantes` };

  // ── Save description ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0 pr-4">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest mb-2 ${urgencyChip.bg}`}>
              {urgencyChip.label}
            </span>
            <h2 className="text-[15px] font-black text-white tracking-tight truncate">
              {sprint.nombre}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500">
              <Calendar size={10} />
              <span>{fmtFull(sprint.fecha_inicio)}</span>
              <span className="text-zinc-700">→</span>
              <span>{fmtFull(sprint.fecha_fin)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Scroll body ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Descripción ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 size={9} /> Descripción / Objetivos
              </h3>
              {canEdit && !editing && (
                <button
                  onClick={() => { setDraft(sprint.descripcion ?? ''); setEditing(true); }}
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-all uppercase tracking-widest"
                >
                  <Pencil size={9} /> Editar
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={4}
                  placeholder="Describe los objetivos de este módulo..."
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-3 py-2 text-[12px] text-zinc-200 resize-none outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-[10px] font-black text-zinc-500 hover:text-zinc-300 rounded transition-all uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black rounded transition-all uppercase tracking-widest"
                  >
                    <Save size={9} />
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : sprint.descripcion ? (
              <p className="text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {sprint.descripcion}
              </p>
            ) : (
              <p className="text-[12px] text-zinc-600 italic">
                {canEdit
                  ? 'Sin descripción — haz clic en "Editar" para agregar los objetivos del módulo.'
                  : 'El instructor no ha agregado una descripción para este módulo.'}
              </p>
            )}
          </div>

          {/* ── Progreso ──────────────────────────────────────────────────── */}
          {total > 0 && (
            <div>
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <CheckCheck size={9} /> Progreso del módulo
              </h3>

              {/* Overall bar */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      progress === 100 ? 'bg-emerald-500' : daysLeft <= 3 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={`text-[11px] font-black shrink-0 tabular-nums ${
                  progress === 100 ? 'text-emerald-400' : 'text-zinc-400'
                }`}>
                  {progress}%
                </span>
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-2 gap-2">
                {STATUS_CFG.map(({ key, label, icon: Icon, color, bar }) => {
                  const count = counts[key as keyof typeof counts];
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={key} className="bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`flex items-center gap-1.5 text-[10px] font-black ${color}`}>
                          <Icon size={10} />
                          <span className="truncate">{label}</span>
                        </div>
                        <span className="text-[11px] font-black text-zinc-300 tabular-nums shrink-0">{count}</span>
                      </div>
                      <div className="h-0.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Equipo ────────────────────────────────────────────────────── */}
          {(members.length > 0 || unassigned > 0) && (
            <div>
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Users size={9} /> Distribución del equipo
              </h3>
              <div className="space-y-1.5">
                {members.map(m => {
                  const memberPct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                  const initials  = m.nombre.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={m.nombre} className="flex items-center gap-2.5">
                      {/* Avatar */}
                      <div className="h-6 w-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-blue-400">{initials}</span>
                      </div>
                      {/* Name */}
                      <span className="text-[11px] font-medium text-zinc-300 truncate min-w-0 flex-1">
                        {m.nombre}
                      </span>
                      {/* Mini bar */}
                      <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${memberPct}%` }}
                        />
                      </div>
                      {/* Count */}
                      <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 w-8 text-right">
                        {m.done}/{m.total}
                      </span>
                    </div>
                  );
                })}
                {unassigned > 0 && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-zinc-500">?</span>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-600 italic flex-1">Sin asignar</span>
                    <span className="text-[10px] text-zinc-600 tabular-nums w-8 text-right">{unassigned}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estado vacío */}
          {total === 0 && (
            <div className="py-6 text-center text-zinc-600">
              <p className="text-[12px] font-bold">Este módulo aún no tiene tareas asignadas.</p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-black text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-all uppercase tracking-widest"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
