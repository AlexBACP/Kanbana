import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, UserPlus, Upload, AlertTriangle, CheckCircle2,
  Loader2, FileSpreadsheet, Download, Mail,
} from 'lucide-react';
import { fichaService } from '../services/ficha.service';

interface Props {
  fichaId: number;
  fichaCode: string;
  onClose: () => void;
}

type Tab = 'individual' | 'excel';

interface IndividualForm {
  nombre:    string;
  correo:    string;
  documento: string;
}

const EMPTY_FORM: IndividualForm = { nombre: '', correo: '', documento: '' };

export const AddAprendizModal = ({ fichaId, fichaCode, onClose }: Props) => {
  const qc  = useQueryClient();
  const [tab, setTab] = useState<Tab>('individual');

  // ── Individual ───────────────────────────────────────────────────────────
  const [form, setForm]         = useState<IndividualForm>(EMPTY_FORM);
  const [indLoading, setIndLoading] = useState(false);
  const [indError, setIndError] = useState<string | null>(null);
  const [indSuccess, setIndSuccess] = useState(false);

  const handleIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.correo.trim() || !form.documento.trim()) {
      setIndError('Todos los campos son obligatorios');
      return;
    }
    setIndLoading(true);
    setIndError(null);
    try {
      await fichaService.invitarAprendiz(fichaId, form);
      qc.invalidateQueries({ queryKey: ['users', 'my-context'] });
      setIndSuccess(true);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setIndError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al agregar el aprendiz'));
    } finally {
      setIndLoading(false);
    }
  };

  // ── Excel ────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [xlsFile, setXlsFile]     = useState<File | null>(null);
  const [xlsLoading, setXlsLoading] = useState(false);
  const [xlsError, setXlsError]   = useState<string | null>(null);
  const [xlsResult, setXlsResult] = useState<{
    created: number; linked: number; errors: { fila: number; correo: string; reason: string }[];
  } | null>(null);

  const handleExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xlsFile) { setXlsError('Selecciona un archivo'); return; }
    setXlsLoading(true);
    setXlsError(null);
    setXlsResult(null);
    try {
      const result = await fichaService.importFromExcel(fichaId, xlsFile);
      qc.invalidateQueries({ queryKey: ['users', 'my-context'] });
      setXlsResult(result);
      setXlsFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setXlsError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al importar el archivo'));
    } finally {
      setXlsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <UserPlus size={15} className="text-primary-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark-text">Agregar Aprendices</h3>
              <p className="text-[10px] text-dark-muted">Ficha #{fichaCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-bg/40 border-b border-dark-border px-5 py-2">
          {([
            { key: 'individual' as Tab, label: 'Individual', icon: UserPlus },
            { key: 'excel'      as Tab, label: 'Excel masivo', icon: FileSpreadsheet },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setIndError(null); setIndSuccess(false); setXlsError(null); setXlsResult(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">

            {/* ── Tab individual ── */}
            {tab === 'individual' && (
              <motion.div
                key="individual"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.12 }}
              >
                {indSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} className="text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-dark-text">¡Aprendiz agregado!</p>
                    <p className="text-xs text-dark-muted">Se envió un correo de confirmación con el enlace de acceso.</p>
                    <div className="flex gap-2 justify-center pt-2">
                      <button
                        onClick={() => setIndSuccess(false)}
                        className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-colors"
                      >
                        Agregar otro
                      </button>
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold border border-dark-border rounded-xl text-dark-muted hover:text-dark-text transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleIndividual} className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl text-xs text-sky-400">
                      <Mail size={12} className="shrink-0" />
                      El aprendiz recibirá un correo de confirmación. Su contraseña será su cédula.
                    </div>

                    {[
                      { key: 'nombre'    as const, label: 'Nombre completo', placeholder: 'Juan Pérez García' },
                      { key: 'correo'    as const, label: 'Correo electrónico', placeholder: 'juan.perez@sena.edu.co', type: 'email' },
                      { key: 'documento' as const, label: 'Cédula / documento', placeholder: '1234567890' },
                    ].map(({ key, label, placeholder, type }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark-muted mb-1">{label}</label>
                        <input
                          type={type || 'text'}
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text outline-none focus:border-primary-500/40 transition-colors placeholder:text-dark-muted/40"
                        />
                      </div>
                    ))}

                    {indError && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                        <p className="text-xs text-rose-400">{indError}</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 text-xs font-bold border border-dark-border rounded-xl text-dark-muted hover:text-dark-text transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={indLoading}
                        className="flex-1 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {indLoading
                          ? <><Loader2 size={12} className="animate-spin" /> Agregando...</>
                          : <><UserPlus size={12} /> Agregar y enviar correo</>
                        }
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}

            {/* ── Tab Excel ── */}
            {tab === 'excel' && (
              <motion.div
                key="excel"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12 }}
                className="space-y-4"
              >
                {/* Plantilla */}
                <div className="flex items-center justify-between p-3 bg-dark-bg border border-dark-border rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-dark-text">Plantilla Excel</p>
                    <p className="text-[10px] text-dark-muted">Columnas: nombre, correo, cedula, telefono, bio</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fichaService.downloadTemplate()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary-400 border border-primary-500/30 hover:bg-primary-500/10 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Download size={12} /> Descargar
                  </button>
                </div>

                <div className="flex items-center gap-2 p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl text-xs text-sky-400">
                  <Mail size={12} className="shrink-0" />
                  Se enviará un correo de confirmación a cada aprendiz importado.
                </div>

                <form onSubmit={handleExcel} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-dark-muted mb-1">Archivo (.xlsx, .xls, .csv)</label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={e => setXlsFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-dark-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary-600/15 file:text-primary-400 file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-primary-600/25 cursor-pointer"
                    />
                  </div>

                  {xlsError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                      <p className="text-xs text-rose-400">{xlsError}</p>
                    </div>
                  )}

                  {xlsResult && (
                    <div className="space-y-2">
                      <div className="flex gap-3">
                        {xlsResult.created > 0 && (
                          <div className="flex-1 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-emerald-400">{xlsResult.created}</p>
                            <p className="text-[10px] text-dark-muted">creado{xlsResult.created !== 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {xlsResult.linked > 0 && (
                          <div className="flex-1 p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-sky-400">{xlsResult.linked}</p>
                            <p className="text-[10px] text-dark-muted">vinculado{xlsResult.linked !== 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {xlsResult.errors.length > 0 && (
                          <div className="flex-1 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-rose-400">{xlsResult.errors.length}</p>
                            <p className="text-[10px] text-dark-muted">error{xlsResult.errors.length !== 1 ? 'es' : ''}</p>
                          </div>
                        )}
                      </div>
                      {xlsResult.errors.length > 0 && (
                        <div className="bg-dark-bg border border-dark-border rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                          {xlsResult.errors.map((err, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-dark-border/40 last:border-0">
                              <AlertTriangle size={10} className="text-rose-400 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-rose-400">Fila {err.fila}: {err.correo} — {err.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 text-xs font-bold border border-dark-border rounded-xl text-dark-muted hover:text-dark-text transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={xlsLoading || !xlsFile}
                      className="flex-1 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {xlsLoading
                        ? <><Loader2 size={12} className="animate-spin" /> Importando...</>
                        : <><Upload size={12} /> Importar y enviar correos</>
                      }
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
