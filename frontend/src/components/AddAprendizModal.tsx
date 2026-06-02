import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, UserPlus, Upload, AlertTriangle, CheckCircle2,
  Loader2, FileSpreadsheet, Download, Mail, Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

// ─── Detector de correos Gmail (mismo regex que LoginAside) ──────────────────
// Reconoce gmail.com y googlemail.com. Es generoso con el local-part.
const GMAIL_RX = /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i;
const isGmail = (correo: string) => GMAIL_RX.test(correo.trim());

interface ExcelRow {
  fila: number;
  nombre: string;
  correo: string;
  cedula: string;
  esGmail: boolean;
  // null si el correo es válido como email; mensaje si está mal formado
  errorFormato: string | null;
}

interface ExcelPreview {
  filas:      ExcelRow[];
  total:      number;
  gmails:     number;
  noGmails:   number;
  invalidos:  number; // correos mal formados o vacíos
  duplicados: string[]; // correos repetidos dentro del Excel
}

// Lee un archivo Excel/CSV y produce un preview estructurado
async function parseExcelPreview(file: File): Promise<ExcelPreview> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  // header: 1 → array de arrays; defval: '' → celdas vacías no se omiten
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

  if (rows.length === 0) {
    return { filas: [], total: 0, gmails: 0, noGmails: 0, invalidos: 0, duplicados: [] };
  }

  // Detectar fila de cabecera y los índices de columna
  // El backend espera: nombre, correo, cedula (al menos)
  const headerRow = (rows[0] as any[]).map(c => String(c ?? '').trim().toLowerCase());
  const idxNombre = headerRow.findIndex(h => /nombre/.test(h));
  const idxCorreo = headerRow.findIndex(h => /correo|email|mail/.test(h));
  const idxCedula = headerRow.findIndex(h => /cedula|cédula|documento|doc/.test(h));

  // Si no encontramos cabeceras claras, asumimos orden: nombre|correo|cedula
  const colNombre = idxNombre >= 0 ? idxNombre : 0;
  const colCorreo = idxCorreo >= 0 ? idxCorreo : 1;
  const colCedula = idxCedula >= 0 ? idxCedula : 2;

  // Saltar la fila de cabecera si la detectamos
  const dataStart = (idxNombre >= 0 || idxCorreo >= 0 || idxCedula >= 0) ? 1 : 0;

  const filas:      ExcelRow[] = [];
  const seen:       Set<string> = new Set();
  const duplicados: Set<string> = new Set();

  let gmails    = 0;
  let noGmails  = 0;
  let invalidos = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] as any[];
    const nombre = String(r[colNombre] ?? '').trim();
    const correo = String(r[colCorreo] ?? '').trim().toLowerCase();
    const cedula = String(r[colCedula] ?? '').trim();

    // Saltar filas completamente vacías
    if (!nombre && !correo && !cedula) continue;

    let errorFormato: string | null = null;
    if (!correo) {
      errorFormato = 'Correo vacío';
      invalidos++;
    } else if (!/^\S+@\S+\.\S+$/.test(correo)) {
      errorFormato = 'Formato de correo inválido';
      invalidos++;
    } else if (seen.has(correo)) {
      duplicados.add(correo);
    } else {
      seen.add(correo);
    }

    const esGmail = errorFormato ? false : isGmail(correo);
    if (!errorFormato) {
      if (esGmail) gmails++;
      else         noGmails++;
    }

    filas.push({
      fila: i + 1, // mostrar en base 1 (línea visible en el Excel)
      nombre,
      correo,
      cedula,
      esGmail,
      errorFormato,
    });
  }

  return {
    filas,
    total:      filas.length,
    gmails,
    noGmails,
    invalidos,
    duplicados: Array.from(duplicados),
  };
}

export const AddAprendizModal = ({ fichaId, fichaCode, onClose }: Props) => {
  const qc  = useQueryClient();
  const [tab, setTab] = useState<Tab>('individual');

  // ── Individual ───────────────────────────────────────────────────────────
  const [form, setForm]             = useState<IndividualForm>(EMPTY_FORM);
  const [indLoading, setIndLoading] = useState(false);
  const [indError, setIndError]     = useState<string | null>(null);
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
  const [xlsFile, setXlsFile]       = useState<File | null>(null);
  const [xlsLoading, setXlsLoading] = useState(false);
  const [xlsError, setXlsError]     = useState<string | null>(null);
  const [xlsResult, setXlsResult]   = useState<{
    created: number; linked: number; errors: { fila: number; correo: string; reason: string }[];
  } | null>(null);
  // Preview del Excel ANTES de subirlo
  const [preview,    setPreview]    = useState<ExcelPreview | null>(null);
  const [parsing,    setParsing]    = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showAllNoGmail, setShowAllNoGmail] = useState(false);

  const handleFileSelect = async (file: File | null) => {
    setXlsFile(file);
    setPreview(null);
    setParseError(null);
    setXlsResult(null);
    setXlsError(null);
    if (!file) return;

    setParsing(true);
    try {
      const p = await parseExcelPreview(file);
      setPreview(p);
      if (p.total === 0) {
        setParseError('El archivo no contiene filas con datos.');
      }
    } catch (err: any) {
      setParseError('No se pudo leer el archivo. ¿Estás seguro de que es un Excel/CSV válido?');
    } finally {
      setParsing(false);
    }
  };

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
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setXlsError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al importar el archivo'));
    } finally {
      setXlsLoading(false);
    }
  };

  const inputCls = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600";
  const cancelBtnCls = "flex-1 py-2.5 text-xs font-bold border border-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 hover:border-zinc-700 transition-colors";

  // Datos derivados del preview
  const noGmailRows = preview?.filas.filter(r => !r.errorFormato && !r.esGmail) ?? [];
  const invalidRows = preview?.filas.filter(r => r.errorFormato) ?? [];
  const previewOk   = preview && preview.total > 0 && !parseError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <UserPlus size={15} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Agregar Aprendices</h3>
              <p className="text-[10px] text-zinc-500">Ficha #{fichaCode}</p>
            </div>
          </div>
          <button onClick={onClose} title="Cerrar" aria-label="Cerrar" className="text-zinc-500 hover:text-zinc-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-950/40 border-b border-zinc-800 px-5 py-2">
          {([
            { key: 'individual' as Tab, label: 'Individual', icon: UserPlus },
            { key: 'excel'      as Tab, label: 'Excel masivo', icon: FileSpreadsheet },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setIndError(null); setIndSuccess(false); setXlsError(null); setXlsResult(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-100'
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
                    <p className="text-sm font-semibold text-zinc-100">¡Aprendiz agregado!</p>
                    <p className="text-xs text-zinc-500">Se envió un correo de confirmación con el enlace de acceso.</p>
                    <div className="flex gap-2 justify-center pt-2">
                      <button
                        onClick={() => setIndSuccess(false)}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
                      >
                        Agregar otro
                      </button>
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold border border-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 transition-colors"
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
                        <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
                        <input
                          type={type || 'text'}
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className={inputCls}
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
                      <button type="button" onClick={onClose} className={cancelBtnCls}>
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={indLoading}
                        className="flex-1 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
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
                <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-zinc-100">Plantilla Excel</p>
                    <p className="text-[10px] text-zinc-500">Columnas: nombre, correo, cedula, telefono, bio</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fichaService.downloadTemplate()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 rounded-lg px-3 py-1.5 transition-colors"
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
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Archivo (.xlsx, .xls, .csv)</label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600/15 file:text-blue-400 file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-blue-600/25 cursor-pointer"
                    />
                  </div>

                  {/* ── Preview del Excel (cliente) ─────────────────────────────── */}
                  {parsing && (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                      <Loader2 size={12} className="animate-spin" /> Analizando archivo…
                    </div>
                  )}

                  {parseError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                      <p className="text-xs text-rose-400">{parseError}</p>
                    </div>
                  )}

                  {previewOk && !xlsResult && (
                    <div className="space-y-2.5">
                      {/* Cabecera del preview */}
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
                        <Eye size={11} />
                        Vista previa
                      </div>

                      {/* Stats: total / gmail / no-gmail / inválidos */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                          <p className="text-base font-black text-zinc-200">{preview!.total}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total</p>
                        </div>
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center">
                          <p className="text-base font-black text-emerald-400">{preview!.gmails}</p>
                          <p className="text-[10px] text-emerald-400/80 uppercase tracking-widest">Gmail</p>
                        </div>
                        <div className={`p-2.5 rounded-xl text-center border ${
                          preview!.noGmails > 0
                            ? 'bg-amber-500/10 border-amber-500/25'
                            : 'bg-zinc-950 border-zinc-800'
                        }`}>
                          <p className={`text-base font-black ${preview!.noGmails > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                            {preview!.noGmails}
                          </p>
                          <p className={`text-[10px] uppercase tracking-widest ${preview!.noGmails > 0 ? 'text-amber-400/80' : 'text-zinc-500'}`}>
                            No-Gmail
                          </p>
                        </div>
                      </div>

                      {/* Inválidos / duplicados */}
                      {(preview!.invalidos > 0 || preview!.duplicados.length > 0) && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-rose-500/8 border border-rose-500/20 rounded-xl">
                          <AlertTriangle size={11} className="text-rose-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-rose-400 leading-relaxed">
                            {preview!.invalidos > 0 && (
                              <p>{preview!.invalidos} fila{preview!.invalidos !== 1 ? 's' : ''} con correo vacío o mal formado.</p>
                            )}
                            {preview!.duplicados.length > 0 && (
                              <p>{preview!.duplicados.length} correo{preview!.duplicados.length !== 1 ? 's' : ''} duplicado{preview!.duplicados.length !== 1 ? 's' : ''} en el archivo.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Aviso de correos no-Gmail con lista expandible */}
                      {preview!.noGmails > 0 && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 flex items-start gap-2 border-b border-amber-500/15">
                            <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-amber-400">
                                {preview!.noGmails} correo{preview!.noGmails !== 1 ? 's' : ''} no Gmail
                              </p>
                              <p className="text-[10px] text-amber-400/70 mt-0.5">
                                Estos aprendices no podrán iniciar sesión con Google. Recibirán el correo de confirmación, pero deberán usar su cédula como contraseña.
                              </p>
                            </div>
                          </div>
                          <div className={`overflow-y-auto ${showAllNoGmail ? 'max-h-44' : 'max-h-24'}`}>
                            {(showAllNoGmail ? noGmailRows : noGmailRows.slice(0, 4)).map((r) => (
                              <div key={r.fila} className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-500/8 last:border-0">
                                <span className="text-[9px] font-bold text-amber-400/50 w-8 shrink-0">#{r.fila}</span>
                                <p className="text-[11px] text-amber-200 truncate flex-1">{r.correo}</p>
                                <p className="text-[10px] text-amber-400/60 truncate max-w-[110px]">{r.nombre}</p>
                              </div>
                            ))}
                          </div>
                          {noGmailRows.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setShowAllNoGmail(s => !s)}
                              className="w-full px-3 py-1.5 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 transition-colors border-t border-amber-500/15"
                            >
                              {showAllNoGmail ? 'Ocultar' : `Ver los ${noGmailRows.length - 4} restantes`}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Filas inválidas */}
                      {invalidRows.length > 0 && (
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl overflow-hidden max-h-28 overflow-y-auto">
                          {invalidRows.slice(0, 6).map((r) => (
                            <div key={r.fila} className="flex items-center gap-2 px-3 py-1.5 border-b border-rose-500/10 last:border-0">
                              <span className="text-[9px] font-bold text-rose-400/50 w-8 shrink-0">#{r.fila}</span>
                              <p className="text-[11px] text-rose-300 truncate flex-1">{r.correo || '(vacío)'}</p>
                              <p className="text-[10px] text-rose-400/70 shrink-0">{r.errorFormato}</p>
                            </div>
                          ))}
                          {invalidRows.length > 6 && (
                            <p className="px-3 py-1.5 text-[10px] text-rose-400/60 italic">y {invalidRows.length - 6} más…</p>
                          )}
                        </div>
                      )}

                      {/* Buen estado */}
                      {preview!.noGmails === 0 && preview!.invalidos === 0 && preview!.duplicados.length === 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                          <p className="text-[11px] text-emerald-400 font-medium">
                            Todos los correos son Gmail válidos. Listo para importar.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Error de subida ─────────────────────────────────────── */}
                  {xlsError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                      <p className="text-xs text-rose-400">{xlsError}</p>
                    </div>
                  )}

                  {/* ── Resultado de la importación ─────────────────────────── */}
                  {xlsResult && (
                    <div className="space-y-2">
                      <div className="flex gap-3">
                        {xlsResult.created > 0 && (
                          <div className="flex-1 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-emerald-400">{xlsResult.created}</p>
                            <p className="text-[10px] text-zinc-500">creado{xlsResult.created !== 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {xlsResult.linked > 0 && (
                          <div className="flex-1 p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-sky-400">{xlsResult.linked}</p>
                            <p className="text-[10px] text-zinc-500">vinculado{xlsResult.linked !== 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {xlsResult.errors.length > 0 && (
                          <div className="flex-1 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                            <p className="text-lg font-bold text-rose-400">{xlsResult.errors.length}</p>
                            <p className="text-[10px] text-zinc-500">error{xlsResult.errors.length !== 1 ? 'es' : ''}</p>
                          </div>
                        )}
                      </div>
                      {xlsResult.errors.length > 0 && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                          {xlsResult.errors.map((err, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                              <AlertTriangle size={10} className="text-rose-400 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-rose-400">Fila {err.fila}: {err.correo} — {err.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={onClose} className={cancelBtnCls}>
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={xlsLoading || !xlsFile || !previewOk || preview!.total === 0}
                      className="flex-1 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {xlsLoading
                        ? <><Loader2 size={12} className="animate-spin" /> Importando...</>
                        : preview
                          ? <><Upload size={12} /> Importar {preview.total} aprendiz{preview.total !== 1 ? 'es' : ''}</>
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
