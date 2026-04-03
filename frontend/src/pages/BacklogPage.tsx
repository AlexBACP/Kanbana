import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  MoreVertical, 
  GripVertical,
  Play,
  Calendar,
  Flag
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { ticketService } from '../services/ticket.service';
import { Button } from '../components/Button';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { useForm } from 'react-hook-form';
import { CreateTicketDto, CreateSprintDto } from '../types/ticket.types';
import { useAuthStore } from '../store/auth.store';

export const BacklogPage = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLead = user?.rol === 'lider_tecnico';

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getById(projectId),
    enabled: !!projectId,
  });

  const { data: backlogTickets = [], isLoading: loadingBacklog } = useQuery({
    queryKey: ['tickets', projectId, 'backlog'],
    queryFn: () => ticketService.getAll(projectId, undefined, true),
    enabled: !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn: () => projectService.getSprints(projectId),
    enabled: !!projectId,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: CreateTicketDto) => ticketService.create({ 
      ...data, 
      proyecto_id: projectId,
      story_points: Number(data.story_points) || 0 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      setIsTicketModalOpen(false);
      resetTicket();
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: (data: CreateSprintDto) => projectService.createSprint(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      setIsSprintModalOpen(false);
      resetSprint();
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ ticketId, sprint_id }: { ticketId: number, sprint_id: number | null }) => 
      ticketService.moveTask(ticketId, sprint_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: (sprintId: number) => projectService.startSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    },
  });

  const { register: regTicket, handleSubmit: handleTicketSubmit, reset: resetTicket } = useForm<CreateTicketDto>();
  const { register: regSprint, handleSubmit: handleSprintSubmit, reset: resetSprint } = useForm();

  const filteredBacklog = backlogTickets.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <Link to="/projects" className="p-3 bg-dark-card hover:bg-dark-border rounded-2xl text-dark-muted hover:text-primary-400 border border-dark-border transition-all shadow-xl">
            <ChevronLeft size={24} />
          </Link>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-dark-text tracking-tight">Backlog</h1>
            <p className="text-dark-muted font-bold flex items-center gap-2">
              <span className="text-primary-400">{project?.nombre}</span>
              <span className="opacity-30">•</span>
              <span className="text-[10px] uppercase tracking-widest">{project?.ficha?.codigo}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 bg-dark-card p-6 rounded-[2.5rem] border border-dark-border shadow-2xl">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-muted group-focus-within:text-primary-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Buscar en el backlog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-12 pr-4 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30"
          />
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || isLead) && (
            <Button 
              onClick={() => setIsSprintModalOpen(true)} 
              variant="secondary" 
              className="flex items-center gap-2 px-6 py-4 bg-dark-bg border border-dark-border text-dark-text hover:bg-dark-border rounded-2xl font-black text-sm transition-all"
            >
              <Plus size={18} />
              Nuevo Sprint
            </Button>
          )}
          <Button 
            onClick={() => setIsTicketModalOpen(true)} 
            className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nueva Historia
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* Sprints */}
        <div className="space-y-8">
          {sprints.map(sprint => (
            <div key={sprint.id} className="bg-dark-card rounded-[2.5rem] border border-dark-border shadow-2xl overflow-hidden group hover:border-primary-500/20 transition-all duration-500">
              <div className="bg-dark-bg/40 px-8 py-6 flex items-center justify-between border-b border-dark-border">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    sprint.esta_activo 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' 
                      : 'bg-dark-bg text-dark-muted border-dark-border'
                  }`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-dark-text text-lg tracking-tight group-hover:text-primary-400 transition-colors">{sprint.nombre}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        sprint.esta_activo ? 'bg-emerald-500 text-white' : 'bg-dark-border text-dark-muted'
                      }`}>
                        {sprint.esta_activo ? 'Activo' : sprint.esta_finalizado ? 'Finalizado' : 'Planificado'}
                      </span>
                      <span className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter opacity-60">
                        {new Date(sprint.fecha_inicio).toLocaleDateString()} — {new Date(sprint.fecha_fin).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!sprint.esta_activo && !sprint.esta_finalizado && (isAdmin || isLead) && (
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-2"
                      onClick={() => startSprintMutation.mutate(sprint.id)}
                    >
                      <Play size={14} fill="currentColor" /> Iniciar
                    </Button>
                  )}
                  <button className="w-10 h-10 flex items-center justify-center text-dark-muted hover:text-dark-text hover:bg-dark-bg rounded-xl transition-all">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-dark-card/30">
                {sprint.tickets && sprint.tickets.length > 0 ? (
                  <div className="space-y-2">
                    {sprint.tickets.map(ticket => (
                      <div key={ticket.id} className="group/item flex items-center gap-5 p-4 bg-dark-bg/40 hover:bg-dark-bg/80 border border-dark-border rounded-2xl transition-all">
                        <GripVertical size={16} className="text-dark-muted/30 cursor-grab active:cursor-grabbing" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-primary-500/80 uppercase tracking-widest bg-primary-500/5 px-2 py-0.5 rounded-md border border-primary-500/10">OKAF-{ticket.id}</span>
                            <Link to={`/tickets/${ticket.id}`} className="text-sm font-bold text-dark-text hover:text-primary-400 truncate transition-colors">
                              {ticket.titulo}
                            </Link>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {ticket.esta_bloqueado && (
                            <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-500">
                              <Flag size={14} fill="currentColor" />
                            </div>
                          )}
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-40">Puntos</span>
                            <span className="text-xs font-black text-primary-400">{ticket.story_points || 0}</span>
                          </div>
                          <select 
                            className="text-[10px] font-black uppercase tracking-widest bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-dark-muted outline-none focus:border-primary-500 transition-all cursor-pointer"
                            onChange={(e) => moveTaskMutation.mutate({ ticketId: ticket.id, sprint_id: e.target.value === 'backlog' ? null : Number(e.target.value) })}
                            value=""
                          >
                            <option value="" disabled>Mover</option>
                            <option value="backlog">Backlog</option>
                            {sprints.filter(s => s.id !== (sprint as any).id && !s.esta_finalizado).map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-xs font-bold text-dark-muted/40 uppercase tracking-[0.2em] italic">Arrastra historias para este sprint</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Backlog */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-2xl font-black text-dark-text tracking-tight flex items-center gap-4">
              Backlog 
              <span className="text-xs font-black bg-dark-card border border-dark-border text-dark-muted px-3 py-1 rounded-full uppercase tracking-widest">{filteredBacklog.length}</span>
            </h2>
          </div>
          <div className="bg-dark-card rounded-[2.5rem] border border-dark-border shadow-2xl overflow-hidden p-4">
            {loadingBacklog ? (
              <div className="p-16 text-center text-dark-muted font-bold animate-pulse">Cargando backlog...</div>
            ) : filteredBacklog.length > 0 ? (
              <div className="space-y-2">
                {filteredBacklog.map(ticket => (
                  <div key={ticket.id} className="group flex items-center gap-5 p-4 bg-dark-bg/20 hover:bg-dark-bg/60 border border-dark-border hover:border-primary-500/30 rounded-2xl transition-all">
                    <GripVertical size={16} className="text-dark-muted/20" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-primary-500/80 uppercase tracking-widest bg-primary-500/5 px-2 py-0.5 rounded-md border border-primary-500/10">OKAF-{ticket.id}</span>
                        <Link to={`/tickets/${ticket.id}`} className="text-sm font-bold text-dark-text hover:text-primary-400 truncate transition-colors">
                          {ticket.titulo}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        ticket.prioridad === 'alta' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                        ticket.prioridad === 'media' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-dark-bg text-dark-muted border border-dark-border'
                      }`}>
                        {ticket.prioridad}
                      </div>
                      <div className="flex flex-col items-end min-w-[40px]">
                        <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-40">Pts</span>
                        <span className="text-xs font-black text-dark-text">{ticket.story_points || 0}</span>
                      </div>
                      <select 
                        className="text-[10px] font-black uppercase tracking-widest bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-dark-muted outline-none focus:border-primary-500 transition-all cursor-pointer"
                        onChange={(e) => moveTaskMutation.mutate({ ticketId: ticket.id, sprint_id: Number(e.target.value) })}
                        value=""
                      >
                        <option value="" disabled>Mover a</option>
                        {sprints.filter(s => !s.esta_finalizado).map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-dark-muted font-bold italic opacity-40">El backlog está vacío. Define historias para comenzar.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nuevo Ticket */}
      <Modal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} title="Nueva Historia de Usuario">
        <form onSubmit={handleTicketSubmit((data) => createTicketMutation.mutate(data))} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Título de la Historia</label>
            <input 
              {...regTicket('titulo', { required: 'El título es obligatorio' })} 
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30" 
              placeholder="Ej: Como usuario quiero poder filtrar por fecha..." 
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Descripción / Criterios de Aceptación</label>
            <textarea 
              {...regTicket('descripcion', { required: 'La descripción es obligatoria' })} 
              rows={4} 
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30 resize-none" 
              placeholder="Describe los detalles de la tarea..."
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Story Points</label>
              <input 
                type="number" 
                {...regTicket('story_points')} 
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" 
                defaultValue={0} 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Prioridad</label>
              <select 
                {...regTicket('prioridad')} 
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setIsTicketModalOpen(false)}
              className="px-6 py-4 bg-dark-bg border border-dark-border text-dark-text hover:bg-dark-border transition-all rounded-2xl font-black text-sm"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={createTicketMutation.isPending}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all"
            >
              Crear Historia
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nuevo Sprint */}
      <Modal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} title="Crear Nuevo Sprint">
        <form onSubmit={handleSprintSubmit((data) => createSprintMutation.mutate(data as CreateSprintDto))} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Nombre del Sprint</label>
            <input 
              {...regSprint('nombre', { required: 'El nombre es obligatorio' })} 
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30" 
              placeholder="Ej: Sprint 1 - Core MVP" 
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Fecha Inicio</label>
              <input 
                type="date" 
                {...regSprint('fecha_inicio', { required: 'La fecha de inicio es obligatoria' })} 
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Fecha Fin</label>
              <input 
                type="date" 
                {...regSprint('fecha_fin', { required: 'La fecha de fin es obligatoria' })} 
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setIsSprintModalOpen(false)}
              className="px-6 py-4 bg-dark-bg border border-dark-border text-dark-text hover:bg-dark-border transition-all rounded-2xl font-black text-sm"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={createSprintMutation.isPending}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all"
            >
              Crear Sprint
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
