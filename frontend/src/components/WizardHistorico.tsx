/**
 * WizardHistorico — Wizard de 3 pasos para declarar trimestres históricos.
 *
 * Caso de uso: instructor/coordinador adoptó Kanbana cuando la ficha ya
 * llevaba uno o más trimestres completados. Este wizard permite registrar
 * esos trimestres como "históricos" (sin módulos/tareas, solo metadatos y
 * evidencia opcional) para que la línea de tiempo de la ficha sea correcta.
 *
 * Backend: POST /fichas/:id/declarar-historico
 *   Body: { trimestre_actual, anteriores: [{numero, nombre?, fecha_inicio?,
 *           fecha_fin?, evidencia_url?, evidencia_nombre?}] }
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Upload, Loader2,
  CheckCircle2, AlertCircle, History,
} from 'lucide-react';
import { fichaService } from '../services/ficha.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoricoRow = {
  numero: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  evidencia_url?: string;
  evidencia_nombre?: string;
  uploading?: boolean;
};

type Props = {
  fichaId: number;
  /** Lista completa de trimestres de la ficha (del query ['fichas', fichaId, 'trimestres']) */
  trimestres: any[];
  onClose: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelCls =
  'text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-0.5 mb-1 block';
const inputCls =
  'w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600';

// ─── Component ────────────────────────────────────────────────────────────────

export const WizardHistorico = ({ fichaId, trimestres, onClose }: Props) => {
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [trimestreActual, setTrimestreActual] = useState<number | null>(null);
  const [rows, setRows] = useState<HistoricoRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // One hidden file-input ref per trimestre número
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const totalTrimestres = trimestres.length;

  // ── Init rows from existing trimestre data ──────────────────────────────
  const initRows = (actual: number) => {
    const initialised: HistoricoRow[] = Array.from({ length: actual - 1 }, (_, i) => {
      const n = i + 1;
      const t = trimestres.find((tr: any) => tr.numero === n);
      return {
        numero: n,
        nombre: t?.nombre ?? '',
        fecha_inicio: t?.fecha_inicio ? String(t.fecha_inicio).slice(0, 10) : '',
        fecha_fin:    t?.fecha_fin    ? String(t.fecha_fin).slice(0, 10)    : '',
        evidencia_url:    t?.evidencia_cierre_url    ?? undefined,
        evidencia_nombre: t?.evidencia_cierre_nombre ?? undefined,
      };
    });
    setRows(initialised);
  };

  // ── Upload evidence for one row ─────────────────────────────────────────
  const uploadForRow = async (numero: number, file: File) => {
    setRows(prev =>
      prev.map(r => r.numero === numero ? { ...r, uploading: true } : r),
    );
    try {
      const { url, nombre } = await fichaService.uploadEvidencia(file);
      setRows(prev =>
        prev.map(r =>
          r.numero === numero
            ? { ...r, evidencia_url: url, evidencia_nombre: nombre, uploading: false }
            : r,
        ),
      );
    } catch {
      setRows(prev =>
        prev.map(r => r.numero === numero ? { ...r, uploading: false } : r),
      );
    }
  };

  // ── Submit mutation ─────────────────────────────────────────────────────
  const declareMutation = useMutation({
    mutationFn: () =>
      fichaService.declararHistorico(fichaId, {
        trimestre_actual: trimestreActual!,
        anteriores: rows.map(r => ({
          numero: r.numero,
          ...(r.nombre        ? { nombre:          r.nombre        } : {}),
          ...(r.fecha_inicio  ? { fecha_inicio:     r.fecha_inicio  } : {}),
          ...(r.fecha_fin     ? { fecha_fin:        r.fecha_fin     } : {}),
          ...(r.evidencia_url
            ? { evidencia_url: r.evidencia_url, evidencia_nombre: r.evidencia_nombre }
            : {}),
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'trimestres'] });
      setStep(4);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'Error al declarar los trimestres históricos');
    },
  });

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <History size={15} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Trimestres históricos</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {step < 4 ? `Paso ${step} de 3` : 'Completado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">

            {/* ── Step 1: ¿En curso o desde cero? ── */}
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-base font-black text-white mb-1">
                    ¿Tu ficha ya estaba en curso?
                  </h3>
                  <p className="text-[12px] text-zinc-400 leading-relaxed">
                    Si empezaste a usar Kanbana cuando la ficha ya llevaba
                    uno o más trimestres completados, puedes declararlos como
                    históricos para que la línea de tiempo refleje la realidad.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setStep(2)}
                    className="w-full flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/25 hover:bg-amber-500/10 hover:border-amber-500/40 rounded-xl transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-black text-white">
                        Sí, la ficha ya estaba en curso
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Configura los trimestres anteriores como históricos
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </button>

                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-between p-4 bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600 rounded-xl transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-black text-zinc-300">
                        No, empecé desde el primer trimestre
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        Cerrar sin cambios
                      </p>
                    </div>
                    <X
                      size={14}
                      className="text-zinc-600 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </button>
                </div>

                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                  <AlertCircle size={13} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-300/80 leading-relaxed">
                    Los trimestres históricos solo tienen nombre, fechas y evidencia
                    opcional. No tienen módulos ni tareas — representan trabajo
                    realizado antes de usar Kanbana.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: ¿En qué trimestre están? ── */}
            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-base font-black text-white mb-1">
                    ¿En qué trimestre están actualmente?
                  </h3>
                  <p className="text-[12px] text-zinc-400">
                    Los trimestres anteriores a este se marcarán como{' '}
                    <span className="text-amber-400 font-semibold">históricos</span>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: totalTrimestres }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      disabled={n === 1}
                      onClick={() => {
                        setTrimestreActual(n);
                        initRows(n);
                        setStep(3);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        n === 1
                          ? 'opacity-30 cursor-not-allowed border-zinc-700/30 bg-zinc-800/20'
                          : 'border-zinc-700/50 bg-zinc-800/30 hover:border-amber-500/30 hover:bg-amber-500/5 active:scale-[0.98]'
                      }`}
                    >
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                        {n === 1 ? 'No aplica' : `${n - 1} histórico${n - 1 > 1 ? 's' : ''}`}
                      </p>
                      <p className="text-sm font-black text-white">Trimestre {n}</p>
                      {n === 1 && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">Sin trimestres anteriores</p>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Configurar cada trimestre anterior ── */}
            {step === 3 && trimestreActual !== null && rows.length > 0 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-base font-black text-white mb-1">
                    Configura los trimestres anteriores
                  </h3>
                  <p className="text-[12px] text-zinc-400">
                    Todos los campos son{' '}
                    <span className="text-zinc-300 font-semibold">opcionales</span>{' '}
                    — los datos básicos ya están guardados en la ficha.
                  </p>
                </div>

                {rows.map(row => (
                  <div
                    key={row.numero}
                    className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3"
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest shrink-0">
                        Histórico
                      </span>
                      <p className="text-sm font-black text-white">Trimestre {row.numero}</p>
                    </div>

                    {/* Nombre */}
                    <div>
                      <label className={labelCls}>Nombre (opcional)</label>
                      <input
                        type="text"
                        value={row.nombre}
                        onChange={e =>
                          setRows(prev =>
                            prev.map(r =>
                              r.numero === row.numero ? { ...r, nombre: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder={`Ej: Trimestre ${row.numero} — Análisis`}
                        className={inputCls}
                      />
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Inicio</label>
                        <input
                          type="date"
                          value={row.fecha_inicio}
                          onChange={e =>
                            setRows(prev =>
                              prev.map(r =>
                                r.numero === row.numero ? { ...r, fecha_inicio: e.target.value } : r,
                              ),
                            )
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Fin</label>
                        <input
                          type="date"
                          value={row.fecha_fin}
                          onChange={e =>
                            setRows(prev =>
                              prev.map(r =>
                                r.numero === row.numero ? { ...r, fecha_fin: e.target.value } : r,
                              ),
                            )
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* Evidencia upload */}
                    <div>
                      <label className={labelCls}>Evidencia (opcional)</label>
                      {/* Hidden file input */}
                      <input
                        ref={el => { fileRefs.current[row.numero] = el; }}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) uploadForRow(row.numero, f);
                          // Reset so the same file can be re-selected
                          e.target.value = '';
                        }}
                      />
                      {row.evidencia_url ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                          <p className="text-[11px] text-emerald-400 truncate flex-1">
                            {row.evidencia_nombre}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setRows(prev =>
                                prev.map(r =>
                                  r.numero === row.numero
                                    ? { ...r, evidencia_url: undefined, evidencia_nombre: undefined }
                                    : r,
                                ),
                              )
                            }
                            className="text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                            title="Quitar evidencia"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={row.uploading}
                          onClick={() => fileRefs.current[row.numero]?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-600 hover:border-zinc-500 hover:bg-zinc-700 rounded-lg text-[11px] text-zinc-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {row.uploading ? (
                            <><Loader2 size={12} className="animate-spin" /> Subiendo…</>
                          ) : (
                            <><Upload size={12} /> Adjuntar acta, PDF, planilla…</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <AlertCircle size={13} className="text-rose-400 shrink-0" />
                    <p className="text-[11px] text-rose-400">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Step 4: Éxito ── */}
            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-10 space-y-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white mb-2">
                    ¡Históricos declarados!
                  </h3>
                  <p className="text-[12px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    Los trimestres anteriores al{' '}
                    <span className="text-white font-semibold">Trimestre {trimestreActual}</span>{' '}
                    se marcaron como históricos. El Trimestre {trimestreActual} quedó como activo.
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Footer (steps 2, 3 y 4) ── */}
        {(step === 2 || step === 3) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 shrink-0">
            <button
              onClick={() => { setStep(s => (s - 1) as any); setError(null); }}
              className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={13} /> Atrás
            </button>

            {step === 3 && (
              <button
                onClick={() => declareMutation.mutate()}
                disabled={declareMutation.isPending || rows.some(r => r.uploading)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                {declareMutation.isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> Declarando…</>
                ) : (
                  <><History size={13} /> Declarar históricos</>
                )}
              </button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="px-6 py-4 border-t border-zinc-800 shrink-0 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
