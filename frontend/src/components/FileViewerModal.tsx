/**
 * FileViewerModal — Visor de archivos estilo Google Drive.
 *
 * Previsualiza adjuntos sin salir de la app:
 *   • Imágenes (png, jpg, gif, webp, svg…)  → <img>
 *   • PDF                                    → <iframe>
 *   • Video (mp4, webm…)                     → <video controls>
 *   • Audio (mp3, wav…)                      → <audio controls>
 *   • Texto/código (txt, json, csv, md…)     → <iframe> (el navegador lo renderiza)
 *   • Office (docx, xlsx, pptx…)             → fallback: descarga + visor de Office online
 *   • Otros                                  → fallback de descarga
 *
 * Navegación: flechas ← →, teclado, y contador "n de N".
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Download, ChevronLeft, ChevronRight,
  FileText, FileQuestion, ExternalLink,
} from 'lucide-react';
import type { TicketAttachment } from '../types/trimestre.types';

type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'other';

function kindOf(mime: string, name: string): Kind {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('text/') || m.includes('json') || m.includes('csv') || m.includes('xml')) return 'text';
  if (
    m.includes('word') || m.includes('excel') || m.includes('spreadsheet') ||
    m.includes('presentation') || m.includes('powerpoint') || m.includes('officedocument') ||
    m.includes('msword') || m.includes('ms-excel') || m.includes('ms-powerpoint')
  ) return 'office';

  // Fallback por extensión (cuando el MIME viene genérico)
  const ext = (name || '').split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
  if (['txt', 'json', 'csv', 'md', 'xml', 'log', 'yml', 'yaml'].includes(ext)) return 'text';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'other';
}

interface Props {
  attachments: TicketAttachment[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export const FileViewerModal = ({ attachments, index, onClose, onIndexChange }: Props) => {
  const file  = attachments[index];
  const total = attachments.length;

  const goPrev = () => onIndexChange((index - 1 + total) % total);
  const goNext = () => onIndexChange((index + 1) % total);

  // Navegación por teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) goPrev();
      else if (e.key === 'ArrowRight' && total > 1) goNext();
    };
    window.addEventListener('keydown', onKey);
    // Bloquea el scroll del fondo mientras el visor está abierto
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null;

  const kind = kindOf(file.tipo_mime, file.nombre_original);

  const renderViewer = () => {
    switch (kind) {
      case 'image':
        return (
          <img
            src={file.url}
            alt={file.nombre_original}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        );
      case 'pdf':
        return (
          <iframe
            src={file.url}
            title={file.nombre_original}
            className="w-full h-full rounded-lg bg-white"
          />
        );
      case 'video':
        return (
          <video src={file.url} controls autoPlay className="max-w-full max-h-full rounded-lg">
            Tu navegador no puede reproducir este video.
          </video>
        );
      case 'audio':
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <FileText size={40} className="text-indigo-400" />
            </div>
            <audio src={file.url} controls autoPlay className="w-80 max-w-[90vw]">
              Tu navegador no puede reproducir este audio.
            </audio>
          </div>
        );
      case 'text':
        return (
          <iframe
            src={file.url}
            title={file.nombre_original}
            className="w-full h-full rounded-lg bg-white"
          />
        );
      case 'office':
        return (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <FileText size={36} className="text-blue-400" />
            </div>
            <p className="text-zinc-300 font-bold">{file.nombre_original}</p>
            <p className="text-zinc-500 text-sm max-w-md">
              Los documentos de Office (Word, Excel, PowerPoint) no se pueden previsualizar
              directamente. Descárgalo o ábrelo con el visor de Office.
            </p>
            <div className="flex gap-3">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all"
              >
                <Download size={14} /> Descargar
              </a>
              {/* El visor de Office requiere que la URL sea accesible públicamente
                  (no funciona con localhost). Útil ya desplegado. */}
              <a
                href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-300 text-xs font-black rounded-lg transition-all"
              >
                <ExternalLink size={14} /> Visor de Office
              </a>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <FileQuestion size={36} className="text-zinc-500" />
            </div>
            <p className="text-zinc-300 font-bold">{file.nombre_original}</p>
            <p className="text-zinc-500 text-sm">No hay vista previa disponible para este tipo de archivo.</p>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all"
            >
              <Download size={14} /> Descargar
            </a>
          </div>
        );
    }
  };

  return createPortal((
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* ── Barra superior ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3 border-b border-zinc-800/80 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-black text-zinc-100 truncate">{file.nombre_original}</p>
          {total > 1 && (
            <p className="text-[11px] text-zinc-500">{index + 1} de {total}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            title="Descargar"
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Cuerpo: visor ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4 sm:p-8">
        {/* Flecha anterior */}
        {total > 1 && (
          <button
            onClick={e => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
            title="Anterior (←)"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div
          className="w-full h-full flex items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          {renderViewer()}
        </div>

        {/* Flecha siguiente */}
        {total > 1 && (
          <button
            onClick={e => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
            title="Siguiente (→)"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  ), document.body);
};
