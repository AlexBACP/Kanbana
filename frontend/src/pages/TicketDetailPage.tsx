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
  AlertCircle, AlertTriangle, X, Edit2, Save, ExternalLink, Lightbulb,
  Github, GitBranch, GitCommit, GitPullRequest,
  Copy, Check,
} from 'lucide-react';
import { ticketService }    from '../services/ticket.service';
import { commentService }   from '../services/comment.service';
import { Avatar }           from '../components/Avatar';
import { userService }      from '../services/user.service';
import { recursoService }   from '../services/recurso.service';
import { githubService }    from '../services/github.service';
import { formatDate }       from '../utils/date.utils';
import { useAuthStore }     from '../store/auth.store';
import { Modal }            from '../components/Modal';
import { TicketAttachment } from '../types/trimestre.types';
import { AttachmentUploader }  from '../components/AttachmentUploader';
import { AttachmentGallery }   from '../components/AttachmentGallery';
import { useTicketSocket }     from '../hooks/useTicketSocket';
import { ProjectResourcesCard } from '../components/ProjectResourcesCard';
import { TicketStatus }     from '../types/ticket.types';

// ── Mapas de estado ──────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En desarrollo',
  testing:     'En revisión',
  done:        'Finalizado',
};
const STATUS_COLOR: Record<string, string> = {
  to_do:       'bg-zinc-700 text-zinc-300 border-zinc-600',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  testing:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const PRIO_COLOR: Record<string, string> = {
  alta:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  baja:  'bg-zinc-700/50 text-zinc-400 border-zinc-700',
};

// ── Componentes auxiliares ───────────────────────────────────────────────────
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

// ── SubtareasTab ─────────────────────────────────────────────────────────────
const SubtareasTab = ({
  ticket,
  canEdit,
  onAddClick,
  onSubtaskToggle,
}: {
  ticket: any;
  canEdit: boolean;
  onAddClick: () => void;
  onSubtaskToggle: (id: number, currentEstado: string) => void;
}) => {
  const subs  = (ticket.subtareas ?? []) as any[];
  const total = subs.length;
  const done  = subs.filter((s: any) => s.estado === 'done').length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Cabecera + botón */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Desglose técnico</h3>
          {total > 0 && (
            <span className="text-[10px] text-zinc-500">{done}/{total} completadas</span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Plus size={11} /> Nueva subtarea
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      {total > 0 && (
        <div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-600 mt-1">{pct}% completado</p>
        </div>
      )}

      {/* Lista */}
      {total === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-lg space-y-2">
          <GripVertical size={24} className="mx-auto text-zinc-700" />
          <p className="text-zinc-600 text-sm">Sin subtareas registradas</p>
          {canEdit && (
            <button
              onClick={onAddClick}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              + Crear la primera subtarea
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map((sub: any) => {
            const isDone = sub.estado === 'done';
            return (
              <div
                key={sub.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isDone
                    ? 'bg-emerald-500/5 border-emerald-500/15'
                    : 'bg-zinc-800/40 border-zinc-700/40 hover:border-zinc-600/60'
                }`}
              >
                {/* Toggle checkbox */}
                <button
                  onClick={() => onSubtaskToggle(sub.id, sub.estado)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    isDone
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-zinc-600 hover:border-emerald-500/50'
                  }`}
                  title={isDone ? 'Marcar como pendiente' : 'Marcar como completada'}
                >
                  {isDone && <CheckCircle2 size={11} />}
                </button>

                {/* Título con link */}
                <Link
                  to={`/tickets/${sub.id}`}
                  className={`flex-1 text-sm font-bold truncate transition-colors ${
                    isDone
                      ? 'text-zinc-500 line-through hover:text-zinc-400'
                      : 'text-zinc-300 hover:text-blue-400'
                  }`}
                >
                  {sub.titulo}
                </Link>

                {/* Asignado a */}
                {(sub.asignado_a?.nombre ?? sub.asignado_a_rel?.nombre) && (
                  <span className="text-[10px] text-zinc-500 hidden sm:block truncate max-w-[80px]">
                    {sub.asignado_a?.nombre ?? sub.asignado_a_rel?.nombre}
                  </span>
                )}

                {/* Estado badge */}
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shrink-0 ${STATUS_COLOR[sub.estado] ?? ''}`}>
                  {STATUS_LABEL[sub.estado] ?? sub.estado}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TicketDetailPage = () => {
  const { id }     = useParams<{ id: string }>();
  const ticketId   = Number(id);
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const { user }   = useAuthStore();

  const [activeTab,         setActiveTab]         = useState<'comentarios' | 'adjuntos' | 'subtareas' | 'github' | 'historial'>('comentarios');
  const [isFlagModalOpen,   setIsFlagModalOpen]   = useState(false);
  const [copiado,           setCopiado]           = useState(false);
  const [isSubtaskModal,    setIsSubtaskModal]     = useState(false);
  const [isEditingTitle,    setIsEditingTitle]     = useState(false);
  const [editTitle,         setEditTitle]         = useState('');
  const [editDesc,          setEditDesc]          = useState('');
  const [commentText,       setCommentText]       = useState('');
  const [esFeedback,        setEsFeedback]        = useState(false);
  const [flagReason,        setFlagReason]        = useState('');
  const [subtaskTitle,      setSubtaskTitle]      = useState('');
  const [suggestedResource, setSuggestedResource] = useState<any>(null);

  const isAdmin  = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLider  = user?.rol === 'aprendiz' && (user as any).es_lider_tecnico;
  const canEdit  = isAdmin || isLider;

  // ── Real-time: comentarios en vivo ────────────────────────────────────────
  useTicketSocket(ticketId);

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

  // ── Actividad GitHub del ticket (commits, ramas, PRs) ─────────────────────
  // refetchInterval mantiene la vista "casi en vivo" mientras llega el webhook.
  const { data: ghActivity } = useQuery({
    queryKey: ['github-activity', ticketId],
    queryFn:  () => githubService.getTicketActivity(ticketId),
    enabled:  !!ticketId,
    refetchInterval: activeTab === 'github' ? 15000 : false,
  });
  const ghBranches = ghActivity?.branches ?? [];
  const ghCommits  = ghActivity?.commits ?? [];
  const ghPRs      = ghActivity?.pull_requests ?? [];
  const ghCount    = ghBranches.length + ghCommits.length + ghPRs.length;

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateStatusMut = useMutation({
    mutationFn: (estado: TicketStatus) => ticketService.updateStatus(ticketId, { estado }),
    onSuccess: async (_, estado) => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      // ── Sugerencia inteligente de recurso ────────────────────────────────
      if (estado === 'in_progress') {
        const proyectoId = (ticket as any)?.proyecto_id;
        if (proyectoId) {
          try {
            const recursos = await recursoService.getAll(proyectoId);
            if (recursos.length > 0) {
              // Priorizar por orden ascendente (recurso principal del proyecto)
              const sorted = [...recursos].sort((a: any, b: any) => (a.orden ?? 99) - (b.orden ?? 99));
              setSuggestedResource(sorted[0]);
            }
          } catch (_) { /* silencioso */ }
        }
      } else {
        setSuggestedResource(null);
      }
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo actualizar el estado'),
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
            <div className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-all">
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
              className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer outline-none transition-all ${STATUS_COLOR[t.estado]}`}
            >
              <option value="to_do">Por hacer</option>
              <option value="in_progress">En desarrollo</option>
              <option value="testing">En revisión</option>
              <option value="done">Finalizado</option>
            </select>

            {/* Bloquear / desbloquear */}
            {canEdit && (
              <button
                onClick={() => t.esta_bloqueado ? flagMut.mutate(false) : setIsFlagModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-widest transition-all ${
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={12} />
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* ── Banner: adjunto requerido ─────────────────────────────────────── */}
        {t.requiere_adjunto && adjuntos.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
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
          <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <Flag size={18} className="text-rose-400 shrink-0" fill="currentColor" />
            <div>
              <p className="text-rose-400 text-xs font-black uppercase tracking-widest">Impedimento activo</p>
              <p className="text-zinc-300 text-sm mt-0.5">{t.motivo_bloqueo || 'Sin motivo especificado'}</p>
            </div>
          </div>
        )}

        {/* ── Banner: sugerencia de recurso al activar tarea ───────────────── */}
        {suggestedResource && (
          <div className="flex items-start gap-3 p-4 bg-blue-500/8 border border-blue-500/20 rounded-lg">
            <Lightbulb size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-blue-400 text-[11px] font-black uppercase tracking-widest mb-1">
                Recurso recomendado para esta tarea
              </p>
              <a
                href={suggestedResource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-bold text-zinc-200 hover:text-blue-300 transition-colors truncate"
              >
                <ExternalLink size={12} className="shrink-0 text-blue-500" />
                {suggestedResource.nombre}
              </a>
              {suggestedResource.descripcion && (
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{suggestedResource.descripcion}</p>
              )}
            </div>
            <button
              onClick={() => setSuggestedResource(null)}
              className="shrink-0 p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Descartar sugerencia"
            >
              <X size={13} />
            </button>
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
                    {/* Código de referencia global con botón copiar (para usar en commits) */}
                    {(t as any).codigo_referencia && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`KAN-${(t as any).codigo_referencia}`);
                          setCopiado(true);
                          setTimeout(() => setCopiado(false), 2000);
                        }}
                        title="Copiar referencia para usar en commits de GitHub"
                        className="group flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20 hover:border-blue-500/40 text-blue-400 transition-all font-mono"
                      >
                        <span>KAN-{(t as any).codigo_referencia}</span>
                        {copiado
                          ? <Check size={11} className="text-emerald-400" />
                          : <Copy size={11} className="opacity-50 group-hover:opacity-100" />}
                      </button>
                    )}
                    {/* Número visual dentro del módulo */}
                    {t.sprint_id && t.ticket_number && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400">
                        #{t.ticket_number} en módulo
                      </span>
                    )}
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-lg font-black text-zinc-100 outline-none focus:border-blue-500/50"
                    />
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingTitle(false)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-black hover:text-zinc-200 transition-all">Cancelar</button>
                      <button
                        onClick={() => updateTicketMut.mutate({ titulo: editTitle, descripcion: editDesc })}
                        disabled={updateTicketMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-500 disabled:opacity-50 transition-all"
                      >
                        <Save size={12} /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-black text-zinc-100 leading-tight">{t.titulo}</h1>
                    {t.descripcion && (
                      <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap bg-zinc-800/40 rounded-lg p-4 border border-zinc-700/40">
                        {t.descripcion}
                      </p>
                    )}
                  </>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
                  {creatorName && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-1.5">Creado por</p>
                      <div className="flex items-center gap-2">
                        <Avatar
                          nombre={creatorName}
                          avatarUrl={(t as any).creado_por?.avatar_url ?? (t as any).creado_por_rel?.avatar_url}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-zinc-300 leading-tight truncate">{creatorName}</p>
                          {(() => {
                            const rol = (t as any).creado_por?.rol ?? (t as any).creado_por_rel?.rol;
                            const esLider = (t as any).creado_por?.es_lider_tecnico ?? (t as any).creado_por_rel?.es_lider_tecnico;
                            if (!rol) return null;
                            const rolLabel = esLider
                              ? 'Líder Técnico'
                              : rol === 'coordinador' ? 'Coordinador'
                              : rol === 'instructor'  ? 'Instructor'
                              : 'Aprendiz';
                            const rolColor = esLider
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : rol === 'coordinador' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                              : rol === 'instructor'  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                              : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                            return (
                              <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border mt-0.5 ${rolColor}`}>
                                {rolLabel}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
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
                {(['comentarios', 'adjuntos', 'subtareas', 'github', 'historial'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition-all ${
                      activeTab === tab
                        ? 'text-blue-400 border-blue-500'
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
                    {tab === 'github'      && (
                      <span className="flex items-center gap-1.5">
                        <Github size={11} /> GitHub{ghCount > 0 ? ` (${ghCount})` : ''}
                      </span>
                    )}
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
                          <Avatar
                            nombre={c.usuario?.nombre ?? '?'}
                            avatarUrl={c.usuario?.avatar_url}
                            size="sm"
                          />
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
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className={`text-sm text-zinc-300 rounded-lg rounded-tl-none p-3 border ${
                              c.es_retroalimentacion
                                ? 'bg-blue-500/10 border-blue-500/20'
                                : 'bg-zinc-800/60 border-zinc-700/40'
                            }`}>
                              {c.es_retroalimentacion && (
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
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
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 resize-none placeholder:text-zinc-600 transition-colors"
                      />
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {isAdmin && (
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={esFeedback}
                              onChange={e => setEsFeedback(e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600 text-blue-600"
                            />
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                              Retroalimentación oficial
                            </span>
                          </label>
                        )}
                        <button
                          onClick={() => commentText.trim() && addCommentMut.mutate()}
                          disabled={!commentText.trim() || addCommentMut.isPending}
                          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-lg disabled:opacity-40 transition-all"
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
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
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
                  <SubtareasTab
                    ticket={t}
                    canEdit={canEdit}
                    onAddClick={() => setIsSubtaskModal(true)}
                    onSubtaskToggle={(subId, currentEstado) => {
                      const next: TicketStatus = currentEstado === 'done' ? 'in_progress' : 'done';
                      ticketService.updateStatus(subId, { estado: next }).then(() => {
                        qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
                      });
                    }}
                  />
                )}

                {/* ── GitHub: actividad enlazada ───────────────────────────── */}
                {activeTab === 'github' && (
                  <div className="space-y-6">
                    {ghCount === 0 ? (
                      <div className="py-12 text-center">
                        <Github size={32} className="mx-auto mb-4 text-zinc-700" />
                        <p className="text-sm text-zinc-400 font-bold">Sin actividad de GitHub todavía</p>
                        <p className="text-xs text-zinc-600 mt-2 max-w-md mx-auto leading-relaxed">
                          Referencia esta tarea desde tu código usando{' '}
                          <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-blue-400 font-mono">KAN-{t.id}</code>{' '}
                          en el nombre de la rama, el mensaje del commit o el título del PR.
                          Los commits, ramas y pull requests aparecerán aquí automáticamente.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Pull Requests */}
                        {ghPRs.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                              <GitPullRequest size={12} /> Pull Requests ({ghPRs.length})
                            </h4>
                            {ghPRs.map((pr: any) => (
                              <a key={pr.id} href={pr.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/40 transition-all group">
                                <GitPullRequest size={15} className={
                                  pr.estado === 'merged' ? 'text-violet-400'
                                  : pr.estado === 'closed' ? 'text-rose-400' : 'text-emerald-400'
                                } />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-blue-300">
                                    #{pr.numero} · {pr.titulo}
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    {pr.autor_login ?? 'desconocido'} · {pr.rama_origen} → {pr.rama_destino}
                                  </p>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                                  pr.estado === 'merged' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                  : pr.estado === 'closed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {pr.estado === 'merged' ? 'Mergeado' : pr.estado === 'closed' ? 'Cerrado' : 'Abierto'}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Ramas */}
                        {ghBranches.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                              <GitBranch size={12} /> Ramas ({ghBranches.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {ghBranches.map((b: any) => (
                                <span key={b.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs font-mono text-zinc-300">
                                  <GitBranch size={11} className="text-blue-400" />
                                  {b.nombre}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Commits */}
                        {ghCommits.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                              <GitCommit size={12} /> Commits ({ghCommits.length})
                            </h4>
                            <div className="space-y-1.5">
                              {ghCommits.map((c: any) => (
                                <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40 hover:border-blue-500/30 transition-all group">
                                  <GitCommit size={14} className="text-zinc-500 shrink-0" />
                                  <code className="text-[11px] font-mono text-blue-400 shrink-0">{(c.sha ?? '').slice(0, 7)}</code>
                                  <p className="flex-1 min-w-0 text-sm text-zinc-300 truncate group-hover:text-zinc-100">
                                    {(c.mensaje ?? '').split('\n')[0]}
                                  </p>
                                  <span className="text-[10px] text-zinc-600 shrink-0">{c.autor_login ?? c.autor_nombre}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
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
                <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${STATUS_COLOR[t.estado]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.estado === 'done' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
                  {STATUS_LABEL[t.estado] ?? t.estado}
                </span>
              </div>

              {/* Responsable */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Responsable</p>
                {assigneeName ? (
                  <div className="flex items-center gap-2">
                    <Avatar
                      nombre={assigneeName}
                      avatarUrl={t.asignado_a?.avatar_url ?? t.asignado_a_rel?.avatar_url}
                      size="xs"
                    />
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
                    className="flex items-center gap-2 text-sm font-black text-zinc-300 hover:text-blue-400 transition-colors"
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
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
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

            {/* ── Recursos del proyecto ─────────────────────────────────── */}
            {t.proyecto_id && <ProjectResourcesCard proyectoId={t.proyecto_id} />}
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
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 resize-none placeholder:text-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsFlagModalOpen(false)} className="flex-1 py-2.5 rounded-lg text-xs font-black bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">Cancelar</button>
            <button
              onClick={() => flagReason.trim() && flagMut.mutate(true)}
              disabled={!flagReason.trim() || flagMut.isPending}
              className="flex-1 py-2.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-all"
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
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 placeholder:text-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsSubtaskModal(false)} className="flex-1 py-2.5 rounded-lg text-xs font-black bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">Cancelar</button>
            <button
              onClick={() => subtaskTitle.trim() && createSubtaskMut.mutate()}
              disabled={!subtaskTitle.trim() || createSubtaskMut.isPending}
              className="flex-1 py-2.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all"
            >
              {createSubtaskMut.isPending ? 'Creando...' : 'Crear subtarea'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
