/**
 * ExcelAprendicesPreview — utilidad + componente para previsualizar un Excel
 * de aprendices ANTES de importarlo.
 *
 * Lo usan dos flujos:
 *   - AddAprendizModal (InstructorEquipo)
 *   - AprendicesManager (FichasPanel)
 *
 * Muestra: total de filas, cuántos correos son Gmail válidos, cuántos no,
 * correos inválidos/duplicados, y la lista de no-Gmail.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Eye, MailX, Loader2, ShieldCheck } from 'lucide-react';
import { fichaService } from '../services/ficha.service';

// ─── Detector de correos Gmail ───────────────────────────────────────────────
const GMAIL_RX = /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i;
const isGmail = (correo: string) => GMAIL_RX.test(correo.trim());

export interface ExcelRow {
  fila: number;
  nombre: string;
  correo: string;
  cedula: string;
  esGmail: boolean;
  errorFormato: string | null;
}

export interface ExcelPreview {
  filas:      ExcelRow[];
  total:      number;
  gmails:     number;
  noGmails:   number;
  invalidos:  number;
  duplicados: string[];
}

// Lee un archivo Excel/CSV y produce un preview estructurado
export async function parseExcelPreview(file: File): Promise<ExcelPreview> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

  if (rows.length === 0) {
    return { filas: [], total: 0, gmails: 0, noGmails: 0, invalidos: 0, duplicados: [] };
  }

  const headerRow = (rows[0] as any[]).map(c => String(c ?? '').trim().toLowerCase());
  const idxNombre = headerRow.findIndex(h => /nombre/.test(h));
  const idxCorreo = headerRow.findIndex(h => /correo|email|mail/.test(h));
  const idxCedula = headerRow.findIndex(h => /cedula|cédula|documento|doc/.test(h));

  const colNombre = idxNombre >= 0 ? idxNombre : 0;
  const colCorreo = idxCorreo >= 0 ? idxCorreo : 1;
  const colCedula = idxCedula >= 0 ? idxCedula : 2;

  const dataStart = (idxNombre >= 0 || idxCorreo >= 0 || idxCedula >= 0) ? 1 : 0;

  const filas:      ExcelRow[] = [];
  const seen:       Set<string> = new Set();
  const duplicados: Set<string> = new Set();

  let gmails = 0, noGmails = 0, invalidos = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] as any[];
    const nombre = String(r[colNombre] ?? '').trim();
    const correo = String(r[colCorreo] ?? '').trim().toLowerCase();
    const cedula = String(r[colCedula] ?? '').trim();

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

    filas.push({ fila: i + 1, nombre, correo, cedula, esGmail, errorFormato });
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

// ─── Componente visual del preview ───────────────────────────────────────────
export const ExcelAprendicesPreview = ({ preview }: { preview: ExcelPreview }) => {
  const [showAllNoGmail, setShowAllNoGmail] = useState(false);
  const [showAllBounce,  setShowAllBounce]  = useState(false);

  const noGmailRows = preview.filas.filter(r => !r.errorFormato && !r.esGmail);
  const invalidRows = preview.filas.filter(r => r.errorFormato);

  // Correos con formato válido — candidatos a verificar MX
  const correosValidos = preview.filas
    .filter(r => !r.errorFormato)
    .map(r => r.correo);

  // ── Verificación MX del dominio (real, vía backend) ──────────────────────
  // Detecta correos cuyo dominio NO puede recibir emails → rebotarían.
  const { data: mxResults, isLoading: mxLoading } = useQuery({
    queryKey: ['validar-correos', correosValidos.sort().join(',')],
    queryFn:  () => fichaService.validarCorreos(correosValidos),
    enabled:  correosValidos.length > 0,
    staleTime: 5 * 60_000,
  });

  // Mapa correo → dominioValido
  const mxMap = new Map<string, boolean>();
  (mxResults ?? []).forEach(r => mxMap.set(r.correo, r.dominioValido));

  // Filas cuyo dominio NO recibe correos (rebotarían)
  const bounceRows = (mxResults && !mxLoading)
    ? preview.filas.filter(r => !r.errorFormato && mxMap.get(r.correo) === false)
    : [];

  if (preview.total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
        <AlertTriangle size={12} className="text-rose-400 shrink-0" />
        <p className="text-xs text-rose-400">El archivo no contiene filas con datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
        <Eye size={11} /> Vista previa
      </div>

      {/* Stats: total / gmail / no-gmail */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
          <p className="text-base font-black text-zinc-200">{preview.total}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total</p>
        </div>
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center">
          <p className="text-base font-black text-emerald-400">{preview.gmails}</p>
          <p className="text-[10px] text-emerald-400/80 uppercase tracking-widest">Gmail</p>
        </div>
        <div className={`p-2.5 rounded-xl text-center border ${
          preview.noGmails > 0 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-zinc-950 border-zinc-800'
        }`}>
          <p className={`text-base font-black ${preview.noGmails > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
            {preview.noGmails}
          </p>
          <p className={`text-[10px] uppercase tracking-widest ${preview.noGmails > 0 ? 'text-amber-400/80' : 'text-zinc-500'}`}>
            No-Gmail
          </p>
        </div>
      </div>

      {/* ── Verificación de entrega (MX del dominio) ──────────────────────── */}
      {mxLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 border border-zinc-700/60 rounded-xl">
          <Loader2 size={12} className="animate-spin text-zinc-500 shrink-0" />
          <p className="text-[11px] text-zinc-500">Verificando que los dominios puedan recibir correos…</p>
        </div>
      ) : bounceRows.length > 0 ? (
        <div className="bg-rose-500/8 border border-rose-500/25 rounded-xl overflow-hidden">
          <div className="px-3 py-2 flex items-start gap-2 border-b border-rose-500/15">
            <MailX size={12} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] font-black text-rose-400">
                {bounceRows.length} correo{bounceRows.length !== 1 ? 's' : ''} NO recibirá{bounceRows.length !== 1 ? 'n' : ''} el email
              </p>
              <p className="text-[10px] text-rose-400/70 mt-0.5">
                El dominio no existe o está mal escrito (ej: @gmial.com). Si los importas, el correo de confirmación rebotará.
              </p>
            </div>
          </div>
          <div className={`overflow-y-auto ${showAllBounce ? 'max-h-44' : 'max-h-24'}`}>
            {(showAllBounce ? bounceRows : bounceRows.slice(0, 4)).map(r => (
              <div key={r.fila} className="flex items-center gap-2 px-3 py-1.5 border-b border-rose-500/8 last:border-0">
                <span className="text-[9px] font-bold text-rose-400/50 w-8 shrink-0">#{r.fila}</span>
                <p className="text-[11px] text-rose-200 truncate flex-1">{r.correo}</p>
                <p className="text-[10px] text-rose-400/60 truncate max-w-[110px]">{r.nombre}</p>
              </div>
            ))}
          </div>
          {bounceRows.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllBounce(s => !s)}
              className="w-full px-3 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 transition-colors border-t border-rose-500/15"
            >
              {showAllBounce ? 'Ocultar' : `Ver los ${bounceRows.length - 4} restantes`}
            </button>
          )}
        </div>
      ) : mxResults && correosValidos.length > 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
          <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-400 font-medium">
            Todos los dominios pueden recibir correos. Ninguno rebotará por dominio inexistente.
          </p>
        </div>
      ) : null}

      {/* Inválidos / duplicados */}
      {(preview.invalidos > 0 || preview.duplicados.length > 0) && (
        <div className="flex items-start gap-2 px-3 py-2 bg-rose-500/8 border border-rose-500/20 rounded-xl">
          <AlertTriangle size={11} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-rose-400 leading-relaxed">
            {preview.invalidos > 0 && (
              <p>{preview.invalidos} fila{preview.invalidos !== 1 ? 's' : ''} con correo vacío o mal formado.</p>
            )}
            {preview.duplicados.length > 0 && (
              <p>{preview.duplicados.length} correo{preview.duplicados.length !== 1 ? 's' : ''} duplicado{preview.duplicados.length !== 1 ? 's' : ''} en el archivo.</p>
            )}
          </div>
        </div>
      )}

      {/* Lista de no-Gmail */}
      {preview.noGmails > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
          <div className="px-3 py-2 flex items-start gap-2 border-b border-amber-500/15">
            <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] font-bold text-amber-400">
                {preview.noGmails} correo{preview.noGmails !== 1 ? 's' : ''} no Gmail
              </p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">
                Estos aprendices no podrán iniciar sesión con Google. Recibirán el correo de confirmación y usarán su cédula como contraseña.
              </p>
            </div>
          </div>
          <div className={`overflow-y-auto ${showAllNoGmail ? 'max-h-44' : 'max-h-24'}`}>
            {(showAllNoGmail ? noGmailRows : noGmailRows.slice(0, 4)).map(r => (
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
          {invalidRows.slice(0, 6).map(r => (
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

      {/* Todo OK */}
      {preview.noGmails === 0 && preview.invalidos === 0 && preview.duplicados.length === 0
        && bounceRows.length === 0 && !mxLoading && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-400 font-medium">
            Todos son Gmail válidos y sus dominios reciben correos. Listo para importar.
          </p>
        </div>
      )}
    </div>
  );
};
