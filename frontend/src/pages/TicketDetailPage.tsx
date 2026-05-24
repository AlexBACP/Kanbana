/**
 * TicketDetailPage — Vista completa de una tarea.
 *
 * Funciones operativas:
 *  - Ver / editar título + descripción (solo admin/líder)
 *  - Cambiar estado con validación de adjunto
 *  - Comentar (todos) · Eliminar comentario (autor / líder / admin)
 *  - Gestión de adjuntos: subir · descargar · eliminar
 *  - Bloquear / desbloquear ticket
 *  - Eliminar ticket (admin / líder)
 *  - Crear subtareas
 */
import { useState }              from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Clock, User, Tag, Send, Paperclip,
  Trash2, CheckCircle2, Flag, Plus, GripVertical,
  AlertCircle, AlertTriangle, X, Edit2, Save,
} from 'lucide-react';
import { ticketService }    from '../services/ticket.service';
import { commentService }   from '../services/comment.service';
import { formatDate }       from '../utils/date.utils';
import { useAuthStore }     from '../store/auth.store';
import { Modal }            from '../components/Modal';
import { TicketAttachment } from '../types/trimestre.types';
import { AttachmentUploader } from '../components/AttachmentUploader';
import { AttachmentGallery }  from '../components/AttachmentGallery';
import { TicketStatus }     from '../types/ticket.types';

// ── Mapas de estado ──────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En progreso',
  testing:     'Testing',
  done:        'Completado',
};
const STATUS_COLOR: Record<string, string> = {
  to_do:       'bg-zinc-700 text-zinc-300 border-zinc-600',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  testing:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const PRIO_COLOR: Record<string, string> = {
  alta:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  media: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  baja:  'bg-zinc-700/50 text-zinc-400 border-zinc-700',
};

// ── Componentes auxiliares ───────────────────────────────────────────────────
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
    {children}
  </div>
);

export const TicketDetailPage = () => {
  const { id }     = useParams<{ id: string }>();
  const ticketId   = Number(id);
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const { user }   = useAuthStore();

  const [activeTab,         setActiveTab]         = useState<'comentarios' | 'adjuntos' | 'subtareas' | 'historial'>('comentarios');
  const [isFlagModalOpen,   setIsFlagModalOpen]   = useState(false);
  const [isSubtaskModal,    setIsSubtaskModal]     = useState(false);
  const [isEditingTitle,    setIsEditingTitle]     = useState(false);
  const [editTitle,         setEditTitle]         = useState('');
  const [editDesc,          setEditDesc]          = useState('');
  const [commentText,       setCommentText]       = useState('');
  const [esFeedback,        setEsFeedback]        = useState(false);
  const [flagReason,        setFlagReason]        = useState('');
  const [subtaskTitle,      setSubtaskTitle]      = useState('');

  const isAdmin  = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLider  = user?.rol === 'aprendiz' && (user as any).es_lider_tecnico;
  const canEdit  = isAdmin || isLider;

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['tickets', ticketId],
    queryFn:  () => ticketService.getById(ticketId),
    enabled:  !!ticketId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', ticketId],
    queryFn:  () => commentService.getByTicket(ticketId),
    enabled:  !!ticketId,
  });

  const { data: adjuntos = [] } = useQuery<TicketAttachment[]>({
    queryKey: ['attachments', ticketId],
    queryFn:  () => ticketService.getAttachments(ticketId),
    enabled:  !!ticketId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateStatusMut = useMutation({
    mutationFn: (estado: TicketStatus) => ticketService.updateStatus(ticketId, { estado }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tickets', ticketId] }),
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo actualizar el estado'),
  });

  const updateTicketMut = useMutation({
    mutationFn: (dto: any) => ticketService.update(ticketId, dto),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setIsEditingTitle(false);
    },
  });

  const addCommentMut = useMutation({
    mutationFn: () => commentService.create(ticketId, {
      contenido:          commentText,
      es_retroalimentacion: esFeedback,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', ticketId] });
      setCommentText('');
      setEsFeedback(false);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al comentar'),
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: number) => commentService.deleteComment(ticketId, commentId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['comments', ticketId] }),
  });

  const flagMut = useMutation({
    mutationFn: (block: boolean) =>
      ticketService.setFlag(ticketId, block, block ? flagReason : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setIsFlagModalOpen(false);
      setFlagReason('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => ticketService.delete(ticketId),
    onSuccess:  () => navigate(-1),
  });

  const createSubtaskMut = useMutation({
    mutationFn: () => ticketService.create({
      titulo:      subtaskTitle,
      descripcion: '',
      proyecto_id: (ticket as any)?.proyecto_id,
      sprint_id:   (ticket as any)?.sprint_id,
      parent_id:   ticketId,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setIsSubtaskModal(false);
      setSubtaskTitle('');
    },
  });

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );

  if (!ticket) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
      <AlertCircle size={40} className="mb-4 opacity-20" />
      <p className="text-lg font-black uppercase tracking-widest">Tarea no encontrada</p>
      <Link to="/" className="mt-6 text-primary-400 hover:underline text-sm">Volver al inicio</Link>
    </div>
  );

  const t            = ticket as any;
  const assigneeName = t.asignado_a?.nombre ?? t.asignado_a_rel?.nombre ?? null;
  const creatorName  = t.creado_por?.nombre ?? t.creado_por_rel?.nombre ?? null;
  const projectName  = t.proyecto?.nombre ?? (t.proyecto_id ? `Proyecto #${t.proyecto_id}` : null);
  const sprintName   = t.sprint?.nombre ?? null;

  const openEdit = () => {
    setEditTitle(t.titulo);
    setEditDesc(t.descripcion ?? '');
    setIsEditingTitle(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors text-sm font-black uppercase tracking-widest"
          >
            <div className="p-2 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-zinc-600 transition-all">
              <ChevronLeft size={16} />
            </div>
            Volver
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Cambiar estado */}
            <select
              value={t.estado}
              onChange={e => updateStatusMut.mutate(e.target.value as TicketStatus)}
              disabled={updateStatusMut.isPending}
              className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border cursor-pointer outline-none transition-all ${STATUS_COLOR[t.estado]}`}
            >
              <option value="to_do">Por hacer</option>
              <option value="in_progress">En progreso</option>
              <option value="testing">Testing</option>
              <option value="done">Completado</option>
            </select>

            {/* Bloquear / desbloquear */}
            {canEdit && (
              <button
                onClick={() => t.esta_bloqueado ? flagMut.mutate(false) : setIsFlagModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                  t.esta_bloqueado
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                    : 'bg-zinc-800 text-amber-400 border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <Flag size={12} fill={t.esta_bloqueado ? 'currentColor' : 'none'} />
                {t.esta_bloqueado ? 'Quitar bloqueo' : 'Bloquear'}
              </button>
            )}

            {/* Eliminar */}
            {canEdit && (
              <button
                onClick={() => window.confirm('¿Eliminar esta tarea permanentemente?') && deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={12} />
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* ── Banner: adjunto requerido ─────────────────────────────────────── */}
        {t.requiere_adjunto && adjuntos.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest">Adjunto requerido</p>
              <p className="text-zinc-400 text-sm mt-0.5">
                Esta tarea no puede marcarse como completada hasta subir al menos un archivo.{' '}
                <button onClick={() => setActiveTab('adjuntos')} className="text-amber-400 underline">Ir a Adjuntos →</button>
              </p>
            </div>
          </div>
        )}

        {/* ── Banner: bloqueado ─────────────────────────────────────────────── */}
        {t.esta_bloqueado && (
          <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            <Flag size={18} className="text-rose-400 shrink-0" fill="currentColor" />
            <div>
              <p className="text-rose-400 text-xs font-black uppercase tracking-widest">Impedimento activo</p>
              <p className="text-zinc-300 text-sm mt-0.5">{t.motivo_bloqueo || 'Sin motivo especificado'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Columna izquierda ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Cabecera del ticket */}
            <Card>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest bg-primary-500/10 px-2.5 py-1 rounded-lg border border-primary-500/20">
                      #{t.id}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${PRIO_COLOR[t.prioridad] ?? ''}`}>
                      Prioridad {t.prioridad}
                    </span>
                    {t.requiere_adjunto && (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border flex items-center gap-1 ${adjuntos.length > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        <Paperclip size={9} />
                        {adjuntos.length > 0 ? `${adjuntos.length} adj.` : 'Adj. requerido'}
                      </span>
                    )}
                  </div>
                  {canEdit && !isEditingTitle && (
                    <button onClick={openEdit} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all shrink-0">
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>

                {isEditingTitle ? (
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-lg font-black text-zinc-100 outline-none focus:border-primary-500/50"
                    />
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 outline-none focus:border-primary-500/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingTitle(false)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-black hover:text-zinc-200 transition-all">Cancelar</button>
                      <button
                        onClick={() => updateTicketMut.mutate({ titulo: editTitle, descripcion: editDesc })}
                        disabled={updateTicketMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-black hover:bg-primary-500 disabled:opacity-50 transition-all"
                      >
                        <Save size={12} /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-black text-zinc-100 leading-tight">{t.titulo}</h1>
                    {t.descripcion && (
                      <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/40">
                        {t.descripcion}
                      </p>
                    )}
                  </>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
                  {creatorName && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Creado por</p>
                      <p className="text-sm font-black text-zinc-300 mt-0.5">{creatorName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Fecha</p>
                    <p className="text-sm font-black text-zinc-300 mt-0.5">{formatDate(t.creado_en)}</p>
                  </div>
                  {t.fecha_limite && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Vence</p>
                      <p className="text-sm font-black text-zinc-300 mt-0.5">{formatDate(t.fecha_limite)}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Card>
              {/* Tab nav */}
              <div className="flex gap-1 px-4 pt-4 border-b border-zinc-800 overflow-x-auto">
                {(['comentarios', 'adjuntos', 'subtareas', 'historial'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition-all ${
                      activeTab === tab
                        ? 'text-primary-400 border-primary-500'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    {tab === 'comentarios' && `Comentarios (${(comments as any[]).length})`}
                    {tab === 'adjuntos'    && (
                      <span className="flex items-center gap-1">
                        Adjuntos ({adjuntos.length})
                        {t.requiere_adjunto && adjuntos.length === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </span>
                    )}
                    {tab === 'subtareas'   && `Subtareas (${t.subtareas?.length ?? 0})`}
                    {tab === 'historial'   && 'Historial'}
                  </button>
                ))}
              </div>

              <div className="p-5">

                {/* ── Comentarios ─────────────────────────────────────────── */}
                {activeTab === 'comentarios' && (
                  <div className="space-y-5">
                    {/* Lista */}
                    <div className="space-y-4">
                      {(comments as any[]).length === 0 ? (
                        <div className="text-center py-10 text-zinc-600 text-sm">No hay comentarios aún.</div>
                      ) : (comments as any[]).map((c: any) => (
                        <div key={c.id} className="flex gap-3 group">
                          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-black shrink-0">
                            {c.usuario?.nombre?.charAt(0)?.toUpperCase() ?? <User size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-black text-zinc-300">
                                {c.usuario?.nombre ?? 'Usuario'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-600">{formatDate(c.creado_en)}</span>
                                {/* Eliminar comentario */}
                                {(canEdit || c.usuario_id === user?.id) && (
                                  <button
                                    onClick={() => window.confirm('¿Eliminar comentario?') && deleteCommentMut.mutate(c.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className={`text-sm text-zinc-300 rounded-xl rounded-tl-none p-3 border ${
                              c.es_retroalimentacion
                                ? 'bg-primary-500/10 border-primary-500/20'
                                : 'bg-zinc-800/60 border-zinc-700/40'
                            }`}>
                              {c.es_retroalimentacion && (
                                <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Retroalimentación Oficial
                                </p>
                              )}
                              {c.contenido}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Formulario */}
                    <div className="pt-4 border-t border-zinc-800 space-y-3">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        rows={3}
                        placeholder="Escribe un comentario, evidencia técnica o nota..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50 resize-none placeholder:text-zinc-600 transition-colors"
                      />
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {isAdmin && (
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={esFeedback}
                              onChange={e => setEsFeedback(e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600 text-primary-600"
                            />
                            <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">
                              Retroalimentación oficial
                            </span>
                          </label>
                        )}
                        <button
                          onClick={() => commentText.trim() && addCommentMut.mutate()}
                          disabled={!commentText.trim() || addCommentMut.isPending}
                          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-[11px] font-black rounded-xl disabled:opacity-40 transition-all"
                        >
                          <Send size={12} />
                          {addCommentMut.isPending ? 'Enviando...' : 'Comentar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Adjuntos ─────────────────────────────────────────────── */}
                {activeTab === 'adjuntos' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Archivos de la tarea</h3>
                      {t.requiere_adjunto && (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border ${
                          adjuntos.length > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {adjuntos.length > 0 ? '✓ Requisito cumplido' : '⚠ Adjunto obligatorio'}
                        </span>
                      )}
                    </div>
                    <AttachmentGallery ticketId={ticketId} canDelete={canEdit} />
                    <div className="pt-4 border-t border-zinc-800">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Subir archivo</p>
                      <AttachmentUploader
                        ticketId={ticketId}
                        requiereAdjunto={t.requiere_adjunto}
                        tieneAdjuntos={adjuntos.length > 0}
                      />
                    </div>
                  </div>
                )}

                {/* ── Subtareas ────────────────────────────────────────────── */}
                {activeTab === 'subtareas' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Desglose técnico</h3>
                      {canEdit && (
                        <button
                          onClick={() => setIsSubtaskModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <Plus size={11} /> Nueva subtarea
                        </button>
                      )}
                    </div>
                    {(!t.subtareas || t.subtareas.length === 0) ? (
                      <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-sm">Sin subtareas registradas</div>
                    ) : t.subtareas.map((sub: any) => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl">
                        <GripVertical size={14} className="text-zinc-700" />
                        <div className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center shrink-0 ${sub.estado === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600'}`}>
                          {sub.estado === 'done' && <CheckCircle2 size={10} />}
                        </div>
                        <Link to={`/tickets/${sub.id}`} className="flex-1 text-sm font-bold text-zinc-300 hover:text-primary-400 truncate transition-colors">
                          {sub.titulo}
                        </Link>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${STATUS_COLOR[sub.estado] ?? ''}`}>
                          {STATUS_LABEL[sub.estado] ?? sub.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Historial ────────────────────────────────────────────── */}
                {activeTab === 'historial' && (
                  <div className="py-16 text-center text-zinc-600 text-sm">
                    <Clock size={32} className="mx-auto mb-4 opacity-20" />
                    Próximamente: historial de cambios
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Columna derecha: detalles ─────────────────────────────────── */}
          <div className="space-y-4">
            <Card className="p-5 space-y-5">
              <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-3">Detalles</h3>

              {/* Estado actual */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Estado</p>
                <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${STATUS_COLOR[t.estado]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.estado === 'done' ? 'bg-emerald-500' : 'bg-primary-500 animate-pulse'}`} />
                  {STATUS_LABEL[t.estado] ?? t.estado}
                </span>
              </div>

              {/* Responsable */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Responsable</p>
                {assigneeName ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-black border border-indigo-500/20">
                      {assigneeName.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-zinc-300">{assigneeName}</span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">Sin asignar</span>
                )}
              </div>

              {/* Proyecto */}
              {projectName && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Proyecto</p>
                  <Link
                    to={`/projects/${t.proyecto_id}/kanban`}
                    className="flex items-center gap-2 text-sm font-black text-zinc-300 hover:text-primary-400 transition-colors"
                  >
                    <Tag size={13} className="text-zinc-600" />
                    {projectName}
                  </Link>
                </div>
              )}

              {/* Módulo */}
              {sprintName && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Módulo</p>
                  <p className="text-sm font-black text-zinc-300">{sprintName}</p>
                </div>
              )}

              {/* Adjuntos requeridos */}
              {t.requiere_adjunto && (
                <button
                  onClick={() => setActiveTab('adjuntos')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    adjuntos.length > 0
                      ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                      : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className={adjuntos.length > 0 ? 'text-emerald-400' : 'text-amber-400'} />
                    <span className={`text-xs font-black ${adjuntos.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {adjuntos.length > 0 ? `${adjuntos.length} archivo(s)` : 'Sin adjuntos'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600">Ver →</span>
                </button>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── Modal: Bloquear ────────────────────────────────────────────────── */}
      <Modal isOpen={isFlagModalOpen} onClose={() => setIsFlagModalOpen(false)} title="Registrar impedimento">
        <div className="space-y-4">
          <textarea
            value={flagReason}
            onChange={e => setFlagReason(e.target.value)}
            rows={3}
            placeholder="¿Qué está deteniendo el progreso?"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50 resize-none placeholder:text-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsFlagModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">Cancelar</button>
            <button
              onClick={() => flagReason.trim() && flagMut.mutate(true)}
              disabled={!flagReason.trim() || flagMut.isPending}
              className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-all"
            >
              Confirmar bloqueo
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Nueva subtarea ──────────────────────────────────────────── */}
      <Modal isOpen={isSubtaskModal} onClose={() => setIsSubtaskModal(false)} title="Nueva subtarea">
        <div className="space-y-4">
          <input
            value={subtaskTitle}
            onChange={e => setSubtaskTitle(e.target.value)}
            placeholder="Título de la subtarea"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsSubtaskModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">Cancelar</button>
            <button
              onClick={() => subtaskTitle.trim() && createSubtaskMut.mutate()}
              disabled={!subtaskTitle.trim() || createSubtaskMut.isPending}
              className="flex-1 py-2.5 rounded-xl text-xs font-black bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-all"
            >
              {createSubtaskMut.isPending ? 'Creando...' : 'Crear subtarea'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
