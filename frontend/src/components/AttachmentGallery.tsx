// ── NUEVO ARCHIVO ─────────────────────────────────────────────────────────────
// Galería de archivos adjuntos de un ticket.
//
// Funcionalidad:
//  - Carga los adjuntos del ticket desde GET /api/tickets/:id/attachments.
//  - Muestra cada archivo con:
//      · Ícono según tipo MIME (PDF, imagen, ZIP, Word, Excel, etc.)
//      · Nombre original del archivo
//      · Tamaño formateado (KB / MB)
//      · Usuario que lo subió y fecha
//      · Botón de descarga (abre la URL pública en nueva pestaña)
//      · Botón de borrar (con confirmación)
//  - Estado vacío cuando no hay adjuntos.
//
// Props:
//  ticketId  → ID del ticket cuyos adjuntos se listan
//  canDelete → si true, muestra el botón de borrar (admin/instructor/quien subió)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Image, Archive, FileSpreadsheet,
  Presentation, Download, Trash2, Paperclip, Eye,
} from 'lucide-react';
import { ticketService }    from '../services/ticket.service';
import { userService }     from '../services/user.service';
import type { TicketAttachment } from '../types/trimestre.types';
import { formatDate }       from '../utils/date.utils';
import { FileViewerModal }  from './FileViewerModal';

// ── Ícono según tipo MIME ─────────────────────────────────────────────────────
function MimeIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/'))
    return <Image size={18} className="text-sky-400" />;
  if (mime.includes('pdf'))
    return <FileText size={18} className="text-rose-400" />;
  if (mime.includes('zip') || mime.includes('rar'))
    return <Archive size={18} className="text-amber-400" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileSpreadsheet size={18} className="text-emerald-400" />;
  if (mime.includes('presentation') || mime.includes('powerpoint'))
    return <Presentation size={18} className="text-orange-400" />;
  // Word, txt y el resto
  return <FileText size={18} className="text-indigo-400" />;
}

// Color de fondo del ícono según tipo
function mimeBg(mime: string): string {
  if (mime.startsWith('image/'))       return 'bg-sky-500/10 border-sky-500/20';
  if (mime.includes('pdf'))            return 'bg-rose-500/10 border-rose-500/20';
  if (mime.includes('zip') || mime.includes('rar')) return 'bg-amber-500/10 border-amber-500/20';
  if (mime.includes('sheet') || mime.includes('excel')) return 'bg-emerald-500/10 border-emerald-500/20';
  if (mime.includes('presentation'))   return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-indigo-500/10 border-indigo-500/20';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  ticketId:  number;
  canDelete: boolean;
}

export const AttachmentGallery = ({ ticketId, canDelete }: Props) => {
  const queryClient = useQueryClient();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { data: adjuntos = [], isLoading } = useQuery<TicketAttachment[]>({
    queryKey: ['attachments', ticketId],
    queryFn:  () => ticketService.getAttachments(ticketId),
    enabled:  !!ticketId,
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      ticketService.deleteAttachment(ticketId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
    },
  });

  const handleDelete = (adj: TicketAttachment) => {
    if (window.confirm(`¿Eliminar "${adj.nombre_original}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(adj.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-16 bg-zinc-950/50 rounded-2xl animate-pulse border border-zinc-800" />
        ))}
      </div>
    );
  }

  if (adjuntos.length === 0) {
    return (
      <div className="py-10 text-center bg-zinc-950/20 rounded-2xl border-2 border-dashed border-zinc-800">
        <Paperclip size={28} className="mx-auto mb-3 text-zinc-500 opacity-20" />
        <p className="text-xs font-black text-zinc-500/40 uppercase tracking-widest">
          Sin archivos adjuntos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {adjuntos.map((adj, i) => (
        <div
          key={adj.id}
          onClick={() => setViewerIndex(i)}
          className="flex items-center gap-4 p-4 bg-zinc-950/40 hover:bg-zinc-950
                     border border-zinc-800 rounded-2xl transition-all group cursor-pointer"
          title="Previsualizar"
        >
          {/* Ícono tipo de archivo */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${mimeBg(adj.tipo_mime)}`}>
            <MimeIcon mime={adj.tipo_mime} />
          </div>

          {/* Info del archivo */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-zinc-100 truncate group-hover:text-primary-300 transition-colors">{adj.nombre_original}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {formatSize(adj.tamano_bytes)}
              </span>
              {adj.subido_por && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-[10px] font-bold text-zinc-500 truncate">
                    {adj.subido_por.nombre}
                  </span>
                </>
              )}
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] font-bold text-zinc-500">
                {formatDate(adj.creado_en)}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Previsualizar */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIndex(i); }}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800
                         text-zinc-500 hover:text-primary-400 hover:border-primary-500/30
                         transition-all"
              title="Previsualizar"
            >
              <Eye size={15} />
            </button>

            {/* Descargar: abre la URL pública en nueva pestaña */}
            <a
              href={userService.getUploadUrl(adj.url) ?? adj.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800
                         text-zinc-500 hover:text-primary-400 hover:border-primary-500/30
                         transition-all"
              title="Descargar"
            >
              <Download size={15} />
            </a>

            {/* Borrar: solo si canDelete */}
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(adj); }}
                disabled={deleteMutation.isPending}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800
                           text-zinc-500 hover:text-rose-400 hover:border-rose-500/30
                           transition-all disabled:opacity-50"
                title="Eliminar adjunto"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* ── Visor de archivos ─────────────────────────────────────────────── */}
      {viewerIndex !== null && (
        <FileViewerModal
          attachments={adjuntos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  );
};