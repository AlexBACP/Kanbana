// ── NUEVO ARCHIVO ─────────────────────────────────────────────────────────────
// Componente de subida de archivos adjuntos a un ticket.
//
// Funcionalidad:
//  - Zona de drag & drop: el usuario arrastra un archivo directamente.
//  - Botón de selección: abre el explorador de archivos.
//  - Validación en el frontend: tipo de archivo y tamaño (máx 20 MB).
//    Aunque el backend también valida, hacerlo aquí da feedback inmediato.
//  - Barra de progreso durante la subida.
//  - Badge de advertencia si el ticket requiere adjunto y aún no tiene ninguno.
//  - Al completar la subida, invalida el query de adjuntos para refrescar la galería.
//
// Props:
//  ticketId        → ID del ticket al que se sube el archivo
//  requiereAdjunto → si true, muestra el badge de advertencia
//  tieneAdjuntos   → si true, oculta el badge de advertencia
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react';
import { useMutation, useQueryClient }   from '@tanstack/react-query';
import { Upload, AlertTriangle, CheckCircle2, X, FileText } from 'lucide-react';
import { ticketService } from '../services/ticket.service';

// ── Tipos de archivo permitidos (deben coincidir con el backend) ──────────────
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.pptx', '.ppt', '.xlsx', '.xls',
  '.png', '.jpg', '.jpeg', '.svg',
  '.zip', '.rar',
  '.txt',
];

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Formatea bytes a KB o MB legible
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  ticketId:        number;
  requiereAdjunto: boolean;
  tieneAdjuntos:   boolean;
}

export const AttachmentUploader = ({ ticketId, requiereAdjunto, tieneAdjuntos }: Props) => {
  const queryClient   = useQueryClient();
  const inputRef      = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [progress,   setProgress]     = useState<number | null>(null);
  const [errorMsg,   setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) =>
      ticketService.uploadAttachment(ticketId, file, setProgress),
    onSuccess: (data) => {
      // Refrescar la galería de adjuntos
      queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] });
      // Refrescar el ticket completo para actualizar adjuntos en la validación
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setProgress(null);
      setErrorMsg(null);
      setSuccessMsg(`"${data.nombre_original}" subido correctamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setProgress(null);
      setErrorMsg(
        err?.response?.data?.message ??
        'Error al subir el archivo. Intenta de nuevo.'
      );
    },
  });

  // Valida el archivo antes de subir
  const validateAndUpload = useCallback((file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validar extensión
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMsg(
        `Tipo no permitido: "${ext}". Acepta: PDF, Word, PPT, Excel, PNG, JPG, SVG, ZIP, RAR, TXT.`
      );
      return;
    }

    // Validar tamaño
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg(`El archivo supera el límite de ${MAX_SIZE_MB} MB (${formatSize(file.size)}).`);
      return;
    }

    uploadMutation.mutate({ file });
  }, [uploadMutation]);

  // Drag & Drop handlers
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  };

  // Selección desde explorador
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    // Limpiar input para permitir subir el mismo archivo de nuevo
    e.target.value = '';
  };

  const isUploading = uploadMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Badge de advertencia: solo cuando requiere adjunto y no tiene ninguno */}
      {requiereAdjunto && !tieneAdjuntos && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <p className="text-xs font-black text-amber-400 uppercase tracking-widest">
            Esta tarea requiere al menos un archivo adjunto para poder marcarse como completado
          </p>
        </div>
      )}

      {/* Zona de drag & drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200 select-none
          ${isDragging
            ? 'border-primary-500 bg-primary-500/10 scale-[1.01]'
            : 'border-zinc-800 hover:border-primary-500/50 hover:bg-zinc-950/50'
          }
          ${isUploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
            ${isDragging ? 'bg-primary-500/20 text-primary-400' : 'bg-zinc-950 text-zinc-500'}`}
          >
            <Upload size={22} />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-100">
              {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              PDF · Word · PPT · Excel · PNG · JPG · SVG · ZIP · RAR · TXT — máx {MAX_SIZE_MB} MB
            </p>
          </div>
        </div>

        {/* Barra de progreso durante la subida */}
        {isUploading && progress !== null && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-zinc-500 uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <FileText size={12} /> Subiendo...
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mensajes de error */}
      {errorMsg && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
          <X size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-rose-400">{errorMsg}</p>
        </div>
      )}

      {/* Mensaje de éxito */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs font-bold text-emerald-400">{successMsg}</p>
        </div>
      )}
    </div>
  );
};