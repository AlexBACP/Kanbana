import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Settings, Search, ListTodo, CheckCircle2 } from 'lucide-react';
import { projectService } from '../services/project.service';
import { ticketService } from '../services/ticket.service';
import { KanbanBoard } from '../components/KanbanBoard';
import { Button } from '../components/Button';
import { useState } from 'react';
import { TicketStatus } from '../types/ticket.types';
import { useAuthStore } from '../store/auth.store';

export const KanbanPage = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLead = user?.rol === 'lider_tecnico';

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getById(projectId),
    enabled: !!projectId,
  });

  const { data: activeSprint } = useQuery({
    queryKey: ['projects', projectId, 'sprint', 'active'],
    queryFn: () => projectService.getActiveSprint(projectId),
    enabled: !!projectId,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', projectId, activeSprint?.id],
    queryFn: () => ticketService.getAll(projectId, activeSprint?.id),
    enabled: !!projectId && !!activeSprint,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
    },
  });

  const closeSprintMutation = useMutation({
    mutationFn: () => projectService.closeSprint(activeSprint!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });

  const handleStatusChange = (ticketId: number, newStatus: TicketStatus) => {
    updateStatusMutation.mutate({ ticketId, status: newStatus });
  };

  const filteredTickets = tickets.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!project && !isLoading) return <div className="p-8 text-center">Proyecto no encontrado</div>;

  return (
    <div className="h-full flex flex-col gap-10 animate-in">
      {/* Header del Kanban */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 px-2">
        <div className="flex items-center gap-6">
          <Link 
            to="/projects" 
            className="p-3 bg-dark-card hover:bg-dark-border rounded-2xl text-dark-muted hover:text-primary-400 border border-dark-border transition-all shadow-xl"
          >
            <ChevronLeft size={24} />
          </Link>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-dark-text tracking-tight">{project?.nombre}</h1>
              {activeSprint ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-lg shadow-emerald-500/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    {activeSprint.nombre}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                    Sin Sprint Activo
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-dark-muted font-medium mt-1 line-clamp-1 opacity-80 max-w-xl">{project?.descripcion}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden xl:block group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-muted group-focus-within:text-primary-500 transition-colors">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Filtrar tareas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all w-56 placeholder:text-dark-muted/30 shadow-xl"
            />
          </div>

          <Link to={`/projects/${projectId}/backlog`}>
            <Button variant="secondary" className="flex items-center gap-2 px-6 py-3 bg-dark-bg border border-dark-border text-dark-text hover:bg-dark-border rounded-2xl font-black text-xs transition-all">
              <ListTodo size={16} />
              Planificar Backlog
            </Button>
          </Link>

          {activeSprint && (isAdmin || isLead) && (
            <Button 
              variant="secondary" 
              className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-2xl font-black text-xs transition-all shadow-lg shadow-rose-500/5"
              onClick={() => {
                if (window.confirm('¿Estás seguro de cerrar el sprint actual?')) {
                  closeSprintMutation.mutate();
                }
              }}
            >
              <CheckCircle2 size={16} />
              Finalizar Sprint
            </Button>
          )}
          
          <Button variant="ghost" className="p-3 bg-dark-card border border-dark-border rounded-2xl text-dark-muted hover:text-dark-text transition-all shadow-xl">
            <Settings size={20} />
          </Button>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-8 scrollbar-hide">
        {!activeSprint ? (
          <div className="h-full flex flex-col items-center justify-center bg-dark-card/30 rounded-[3rem] border-4 border-dashed border-dark-border p-20 text-center shadow-inner animate-in">
            <div className="w-28 h-28 bg-dark-card rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-8 border border-dark-border relative group">
              <div className="absolute inset-0 bg-primary-500/10 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <ListTodo size={48} className="text-dark-muted group-hover:text-primary-400 transition-colors relative z-10" />
            </div>
            <h3 className="text-3xl font-black text-dark-text tracking-tight">El tablero está en espera</h3>
            <p className="text-dark-muted font-bold max-w-md mt-4 mb-10 leading-relaxed opacity-70">
              Para visualizar el flujo de trabajo, ve al backlog y activa un sprint con las tareas prioritarias.
            </p>
            <Link to={`/projects/${projectId}/backlog`}>
              <Button className="px-10 py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-primary-500/20 transition-all active:scale-95">
                Ir a Planificación
              </Button>
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex gap-8 h-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-80 shrink-0 bg-dark-card rounded-[2.5rem] border border-dark-border animate-pulse" />
            ))}
          </div>
        ) : (
          <KanbanBoard 
            tickets={filteredTickets} 
            onStatusChange={handleStatusChange} 
          />
        )}
      </div>
    </div>
  );
};