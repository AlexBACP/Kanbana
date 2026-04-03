import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  Clock, 
  User, 
  Tag, 
  Send, 
  Paperclip, 
  MoreVertical,
  Trash2,
  CheckCircle2,
  Flag,
  Plus,
  GripVertical,
  AlertCircle
} from 'lucide-react';
import { ticketService } from '../services/ticket.service';
import { commentService } from '../services/comment.service';
import { Button } from '../components/Button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatDate } from '../utils/date.utils';
import { CreateCommentDto } from '../types/comment.types';
import { useAuthStore } from '../store/auth.store';
import { Modal } from '../components/Modal';
import { CreateTicketDto } from '../types/ticket.types';

export const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'comentarios' | 'subtareas' | 'historial'>('comentarios');
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLead = user?.rol === 'lider_tecnico';

  const { data: ticket, isLoading: loadingTicket } = useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: () => ticketService.getById(ticketId),
    enabled: !!ticketId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', ticketId],
    queryFn: () => commentService.getByTicket(ticketId),
    enabled: !!ticketId,
  });

  const { register: regComment, handleSubmit: handleCommentSubmit, reset: resetComment } = useForm<CreateCommentDto>();
  const { register: regFlag, handleSubmit: handleFlagSubmit } = useForm<{ reason: string }>();
  const { register: regSubtask, handleSubmit: handleSubtaskSubmit, reset: resetSubtask } = useForm<CreateTicketDto>();

  const addCommentMutation = useMutation({
    mutationFn: (data: CreateCommentDto) => commentService.create(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
      resetComment();
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: (data: { isBlocked: boolean, reason?: string }) => 
      ticketService.setFlag(ticketId, data.isBlocked, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setIsFlagModalOpen(false);
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: (data: CreateTicketDto) => 
      ticketService.create({ 
        ...data, 
        proyecto_id: ticket!.proyecto_id, 
        sprint_id: ticket!.sprint_id,
        parent_id: ticketId 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
      setIsSubtaskModalOpen(false);
      resetSubtask();
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: () => ticketService.delete(ticketId),
    onSuccess: () => {
      navigate(-1);
    },
  });

  const onSubmitComment = (data: CreateCommentDto) => {
    const isFeedback = isAdmin && data.es_retroalimentacion;
    addCommentMutation.mutate({ ...data, es_retroalimentacion: !!isFeedback });
  };

  if (loadingTicket) return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
    </div>
  );

  if (!ticket) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-bg text-dark-muted">
      <AlertCircle size={48} className="mb-4 opacity-20" />
      <p className="text-xl font-black uppercase tracking-widest">Ticket no encontrado</p>
      <Link to="/dashboard" className="mt-6 text-primary-400 hover:underline font-bold">Volver al inicio</Link>
    </div>
  );

  const assigneeName = ticket.asignado_a_rel?.nombre || (ticket as any).asignado_a?.nombre;
  const creatorName = ticket.creado_por_rel?.nombre || (ticket as any).creado_por?.nombre;
  const projectName = ticket.proyecto?.nombre || (ticket.proyecto_id ? `Proyecto #${ticket.proyecto_id}` : 'Sin proyecto');

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in pb-20 px-2">
      {/* Navegación y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <button 
          onClick={() => navigate(-1)}
          className="group flex items-center gap-4 text-sm font-black text-dark-muted hover:text-primary-400 transition-all uppercase tracking-widest"
        >
          <div className="p-3 bg-dark-card border border-dark-border rounded-2xl group-hover:border-primary-500/30 transition-all shadow-xl">
            <ChevronLeft size={20} />
          </div>
          Volver
        </button>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            className={`flex items-center gap-2 ${ticket.esta_bloqueado ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'text-amber-500 border-amber-500/20'}`}
            onClick={() => {
              if (ticket.esta_bloqueado) {
                updateFlagMutation.mutate({ isBlocked: false });
              } else {
                setIsFlagModalOpen(true);
              }
            }}
          >
            <Flag size={16} fill={ticket.esta_bloqueado ? 'currentColor' : 'none'} />
            {ticket.esta_bloqueado ? 'Quitar Bloqueo' : 'Bloquear Ticket'}
          </Button>
          {(isAdmin || isLead) && (
            <Button 
              variant="danger" 
              className="flex items-center gap-2"
              onClick={() => {
                if (window.confirm('¿Estás seguro de eliminar este ticket?')) {
                  deleteTicketMutation.mutate();
                }
              }}
              isLoading={deleteTicketMutation.isPending}
            >
              <Trash2 size={16} />
              Eliminar
            </Button>
          )}
          <Button className="flex items-center gap-2 px-8">
            <CheckCircle2 size={16} />
            Finalizar
          </Button>
        </div>
      </div>

      {ticket.esta_bloqueado && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[2.5rem] flex gap-5 items-start animate-shake shadow-2xl shadow-rose-500/5">
          <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20">
            <Flag size={24} fill="currentColor" />
          </div>
          <div>
            <p className="text-rose-400 font-black uppercase tracking-widest text-xs mb-1">Impedimento Detectado</p>
            <p className="text-dark-text font-bold text-lg leading-tight">{ticket.motivo_bloqueo || 'Sin motivo especificado'}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Lado Izquierdo: Contenido del Ticket */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-dark-card rounded-[3rem] border border-dark-border shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-2 h-full bg-primary-600 opacity-20" />
            <div className="p-8 sm:p-12 space-y-8">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] bg-primary-500/5 px-3 py-1 rounded-lg border border-primary-500/10">OKAF-{ticket.id}</span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border ${
                      ticket.prioridad === 'alta' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                      ticket.prioridad === 'media' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                      'bg-dark-bg text-dark-muted border-dark-border'
                    }`}>
                      Prioridad {ticket.prioridad}
                    </span>
                  </div>
                  <h1 className="text-3xl font-black text-dark-text tracking-tight leading-tight">
                    {ticket.titulo}
                  </h1>
                </div>
                <button className="p-3 text-dark-muted hover:text-dark-text rounded-2xl bg-dark-bg/50 border border-dark-border hover:border-dark-muted transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className="prose prose-invert max-w-none text-dark-muted font-medium leading-relaxed text-lg bg-dark-bg/30 p-8 rounded-[2rem] border border-dark-border/50">
                {ticket.descripcion}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 border-t border-dark-border">
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-primary-600/10 text-primary-400 flex items-center justify-center text-sm font-black border border-primary-500/20 group-hover:scale-110 transition-transform">
                    {creatorName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-40">Creado por</p>
                    <p className="text-sm font-black text-dark-text">{creatorName || 'Usuario'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-dark-bg text-dark-muted flex items-center justify-center border border-dark-border group-hover:scale-110 transition-transform">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-40">Fecha</p>
                    <p className="text-sm font-black text-dark-text">{formatDate(ticket.creado_en)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-sm font-black border border-indigo-500/20 group-hover:scale-110 transition-transform">
                    {ticket.story_points || 0}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-40">Esfuerzo</p>
                    <p className="text-sm font-black text-dark-text">Story Points</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección de Comentarios y Subtareas */}
          <div className="bg-dark-card rounded-[3rem] border border-dark-border shadow-2xl overflow-hidden">
            <div className="border-b border-dark-border px-8 py-6 flex items-center justify-between bg-dark-bg/20">
              <div className="flex gap-10">
                <button 
                  onClick={() => setActiveTab('comentarios')}
                  className={`text-xs font-black uppercase tracking-widest pb-6 -mb-6 transition-all relative ${
                    activeTab === 'comentarios' ? 'text-primary-400' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  Comentarios ({comments.length})
                  {activeTab === 'comentarios' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 rounded-full shadow-lg shadow-primary-500/50" />}
                </button>
                <button 
                  onClick={() => setActiveTab('subtareas')}
                  className={`text-xs font-black uppercase tracking-widest pb-6 -mb-6 transition-all relative ${
                    activeTab === 'subtareas' ? 'text-primary-400' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  Subtareas ({ticket.subtareas?.length || 0})
                  {activeTab === 'subtareas' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 rounded-full shadow-lg shadow-primary-500/50" />}
                </button>
                <button 
                  onClick={() => setActiveTab('historial')}
                  className={`text-xs font-black uppercase tracking-widest pb-6 -mb-6 transition-all relative ${
                    activeTab === 'historial' ? 'text-primary-400' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  Historial
                  {activeTab === 'historial' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 rounded-full shadow-lg shadow-primary-500/50" />}
                </button>
              </div>
            </div>

            <div className="p-8 sm:p-10">
              {activeTab === 'comentarios' ? (
                <div className="space-y-10">
                  {/* Lista de Comentarios */}
                  <div className="space-y-8">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-6 group">
                        <div className="w-12 h-12 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted shrink-0 group-hover:border-primary-500/30 transition-all">
                          <User size={20} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-black text-dark-text group-hover:text-primary-400 transition-colors">Usuario #{comment.usuario_id}</p>
                            <p className="text-[10px] font-bold text-dark-muted uppercase tracking-widest">{formatDate(comment.creado_en)}</p>
                          </div>
                          <div className={`p-6 rounded-[2rem] rounded-tl-none text-sm font-medium leading-relaxed border transition-all ${
                            comment.es_retroalimentacion 
                              ? 'bg-primary-600/10 border-primary-500/30 text-dark-text shadow-lg shadow-primary-500/5' 
                              : 'bg-dark-bg/50 border-dark-border text-dark-muted'
                          }`}>
                            {comment.es_retroalimentacion && (
                              <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">
                                <CheckCircle2 size={14} /> Retroalimentación Oficial
                              </div>
                            )}
                            {comment.contenido}
                          </div>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                       <div className="py-10 text-center text-dark-muted font-bold italic opacity-30">No hay comentarios aún.</div>
                    )}
                  </div>

                  <form onSubmit={handleCommentSubmit(onSubmitComment)} className="space-y-4 pt-6 border-t border-dark-border">
                    <div className="relative group">
                      <textarea
                        {...regComment('contenido', { required: true })}
                        rows={3}
                        className="w-full px-6 py-6 bg-dark-bg border border-dark-border rounded-[2rem] text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none pr-32 placeholder:text-dark-muted/30"
                        placeholder="Añadir una nota técnica o evidencia..."
                      />
                      <div className="absolute bottom-4 right-4 flex items-center gap-3">
                        <button type="button" className="p-3 text-dark-muted hover:text-primary-400 bg-dark-card rounded-xl border border-dark-border hover:border-primary-500/20 transition-all">
                          <Paperclip size={20} />
                        </button>
                        <button 
                          type="submit" 
                          disabled={addCommentMutation.isPending}
                          className="p-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-xl shadow-primary-500/20 transition-all disabled:opacity-50 active:scale-90"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-primary-500/5 border border-primary-500/10 rounded-2xl w-fit">
                        <input 
                          type="checkbox" 
                          id="es_retroalimentacion" 
                          {...regComment('es_retroalimentacion')}
                          className="w-4 h-4 rounded bg-dark-bg border-dark-border text-primary-600 focus:ring-primary-500/20 transition-all cursor-pointer" 
                        />
                        <label htmlFor="es_retroalimentacion" className="text-[10px] font-black text-primary-400 uppercase tracking-widest cursor-pointer select-none">
                          Marcar como Retroalimentación Oficial
                        </label>
                      </div>
                    )}
                  </form>
                </div>
              ) : activeTab === 'subtareas' ? (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-dark-muted uppercase tracking-[0.2em]">Desglose Técnico</h3>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => setIsSubtaskModalOpen(true)} 
                      className="flex items-center gap-2 px-4 py-2 text-[10px]"
                    >
                      <Plus size={14} /> Nueva Subtarea
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {ticket.subtareas?.map(sub => (
                      <div key={sub.id} className="flex items-center gap-5 p-5 bg-dark-bg/40 hover:bg-dark-bg border border-dark-border rounded-2xl transition-all group">
                        <GripVertical size={16} className="text-dark-muted/20" />
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                          sub.estado === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-dark-border'
                        }`}>
                          {sub.estado === 'done' && <CheckCircle2 size={12} />}
                        </div>
                        <Link to={`/tickets/${sub.id}`} className="flex-1 text-sm font-bold text-dark-text hover:text-primary-400 truncate transition-colors">
                          {sub.titulo}
                        </Link>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                          sub.estado === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-dark-bg text-dark-muted border-dark-border'
                        }`}>
                          {sub.estado}
                        </span>
                      </div>
                    ))}
                    {(!ticket.subtareas || ticket.subtareas.length === 0) && (
                      <div className="text-center py-16 bg-dark-bg/20 rounded-[2rem] border-2 border-dashed border-dark-border">
                        <Plus size={32} className="mx-auto mb-4 text-dark-muted opacity-20" />
                        <p className="text-xs font-black text-dark-muted/40 uppercase tracking-widest">No hay subtareas registradas</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <Clock size={48} className="mx-auto mb-6 text-dark-muted opacity-10" />
                  <p className="text-xs font-black text-dark-muted/40 uppercase tracking-[0.2em] italic">Próximamente: Historial de cambios</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lado Derecho: Detalles Secundarios */}
        <div className="space-y-8">
          <div className="bg-dark-card p-8 rounded-[3rem] border border-dark-border shadow-2xl space-y-8">
            <h3 className="text-lg font-black text-dark-text tracking-tight border-b border-dark-border pb-4">Detalles del Ticket</h3>
            
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-dark-muted uppercase tracking-[0.2em] opacity-40">Estado Actual</p>
                <div className="flex items-center justify-between p-4 bg-dark-bg rounded-2xl border border-dark-border shadow-inner">
                  <span className="text-sm font-black text-dark-text uppercase tracking-widest">{ticket.estado.replace('_', ' ')}</span>
                  <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${ticket.estado === 'done' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-primary-500 shadow-primary-500/50 animate-pulse'}`} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-dark-muted uppercase tracking-[0.2em] opacity-40">Responsable</p>
                <div className="flex items-center gap-4 p-2 group cursor-pointer">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-black border border-indigo-500/20 group-hover:scale-110 transition-transform">
                    {assigneeName?.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-black text-dark-text group-hover:text-primary-400 transition-colors">{assigneeName || 'Sin asignar'}</span>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-dark-border">
                <p className="text-[10px] font-black text-dark-muted uppercase tracking-[0.2em] opacity-40">Contexto</p>
                <Link to={`/projects/${ticket.proyecto_id}/kanban`} className="flex items-center gap-3 p-2 group">
                  <div className="w-10 h-10 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted group-hover:text-primary-400 group-hover:border-primary-500/30 transition-all">
                    <Tag size={18} />
                  </div>
                  <span className="text-sm font-black text-dark-text group-hover:text-primary-400 transition-colors line-clamp-1">
                    {projectName}
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-2xl shadow-primary-500/20 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-3 tracking-tight">Registro de Trabajo</h3>
              <p className="text-sm text-primary-100 mb-8 leading-relaxed font-medium opacity-90">
                Lleva un control exacto del tiempo invertido para tus evidencias técnicas.
              </p>
              <Button variant="secondary" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 font-black py-4">
                Iniciar Cronómetro
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Marcar Impedimento */}
      <Modal isOpen={isFlagModalOpen} onClose={() => setIsFlagModalOpen(false)} title="Marcar Impedimento">
        <form onSubmit={handleFlagSubmit((data) => updateFlagMutation.mutate({ isBlocked: true, reason: data.reason }))} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">¿Qué está deteniendo el progreso?</label>
            <textarea
              {...regFlag('reason', { required: 'Debes especificar un motivo' })}
              rows={4}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none placeholder:text-dark-muted/30"
              placeholder="Ej: Dependencia técnica, falta de requerimientos, error crítico en el entorno..."
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="secondary" onClick={() => setIsFlagModalOpen(false)} className="px-6 py-4">Cancelar</Button>
            <Button type="submit" variant="primary" className="bg-rose-600 hover:bg-rose-700 border-rose-500/30 px-8 py-4">Confirmar Bloqueo</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nueva Subtarea */}
      <Modal isOpen={isSubtaskModalOpen} onClose={() => setIsSubtaskModalOpen(false)} title="Nueva Subtarea Técnica">
        <form onSubmit={handleSubtaskSubmit((data) => createSubtaskMutation.mutate(data))} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Título de la Subtarea</label>
            <input 
              {...regSubtask('titulo', { required: 'El título es obligatorio' })} 
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30" 
              placeholder="Ej: Crear migración de base de datos" 
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Instrucciones Técnicas</label>
            <textarea 
              {...regSubtask('descripcion')} 
              rows={3} 
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none placeholder:text-dark-muted/30" 
              placeholder="Opcional: detalla los pasos técnicos..."
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="secondary" onClick={() => setIsSubtaskModalOpen(false)} className="px-6 py-4">Cancelar</Button>
            <Button type="submit" className="px-8 py-4">Crear Subtarea</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
