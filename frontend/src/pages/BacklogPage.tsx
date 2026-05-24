import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Plus, Search, GripVertical, Play,
  Calendar, Flag, Layers, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { ticketService } from '../services/ticket.service';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CreateTicketDto, CreateSprintDto } from '../types/ticket.types';
import { useAuthStore } from '../store/auth.store';
import { Link } from 'react-router-dom';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const PRIORITY_COLORS: Record<string, string> = {
  alta:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  media: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  baja:  'bg-zinc-700/30 text-zinc-500 border-zinc-700/50',
};

export const BacklogPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const isLead = user?.rol === 'aprendiz' && (user as any).es_lider_tecnico;
  const canCreateSprint = isAdmin;

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
      story_points: Number(data.story_points) || 0,
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
    mutationFn: ({ ticketId, sprint_id }: { ticketId: number; sprint_id: number | null }) =>
      ticketService.moveTask(ticketId, sprint_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: (sprintId: number) => projectService.startSprint(sprintId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] }),
  });

  const { register: regTicket, handleSubmit: handleTicketSubmit, reset: resetTicket } = useForm<CreateTicketDto>();
  const { register: regSprint, handleSubmit: handleSprintSubmit, reset: resetSprint } = useForm();

  const filteredBacklog = (backlogTickets as any[]).filter((t: any) =>
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sprintsArr = sprints as any[];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-black uppercase tracking-widest"
            >
              <ChevronLeft size={13} /> Volver
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-primary-400" />
                <h1 className="text-lg font-black text-white tracking-tight">Cola de Trabajo</h1>
              </div>
              {project && (
                <p className="text-[11px] text-zinc-500 font-bold mt-0.5">
                  {(project as any).nombre}
                  {(project as any).ficha?.codigo && (
                    <span className="ml-2 opacity-50 uppercase tracking-widest text-[10px]">· {(project as any).ficha.codigo}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canCreateSprint && (
              <button
                onClick={() => setIsSprintModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[12px] font-black uppercase tracking-widest transition-all hover:border-zinc-600"
              >
                <Plus size={14} /> Nuevo Módulo
              </button>
            )}
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600/15 border border-primary-500/30 text-primary-400 hover:bg-primary-600/25 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all"
            >
              <Plus size={14} /> Nueva Tarea
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative max-w-sm">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar tareas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[12px] text-zinc-300 outline-none focus:border-primary-500/50 w-full placeholder:text-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Módulos ─────────────────────────────────────────────────────── */}
        {sprintsArr.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> Módulos ({sprintsArr.length})
            </h2>
            {sprintsArr.map((sprint: any) => (
              <div
                key={sprint.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
              >
                {/* Sprint header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                      sprint.esta_activo
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                    }`}>
                      <Calendar size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-[14px] text-white">{sprint.nombre}</h3>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
                          sprint.esta_activo
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : sprint.esta_finalizado
                              ? 'bg-zinc-700/30 text-zinc-500 border-zinc-700/50'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {sprint.esta_activo ? 'Activo' : sprint.esta_finalizado ? 'Finalizado' : 'Planificado'}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                        {new Date(sprint.fecha_inicio).toLocaleDateString('es-CO')} — {new Date(sprint.fecha_fin).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!sprint.esta_activo && !sprint.esta_finalizado && isAdmin && (
                      <button
                        onClick={() => startSprintMutation.mutate(sprint.id)}
                        disabled={startSprintMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        <Play size={12} fill="currentColor" /> Activar
                      </button>
                    )}
                    {isLead && (
                      <button
                        onClick={() => navigate(`/projects/${projectId}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                      >
                        <Plus size={12} /> Solicitar módulo
                      </button>
                    )}
                  </div>
                </div>

                {/* Sprint tickets */}
                <div className="p-3">
                  {sprint.tickets && sprint.tickets.length > 0 ? (
                    <div className="space-y-1.5">
                      {sprint.tickets.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="flex items-center gap-3 px-4 py-3 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-700 rounded-xl transition-all group"
                        >
                          <GripVertical size={14} className="text-zinc-600 cursor-grab shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-primary-500/70 bg-primary-500/5 px-1.5 py-0.5 rounded border border-primary-500/10 shrink-0">
                                OKAF-{ticket.id}
                              </span>
                              <Link
                                to={`/tickets/${ticket.id}`}
                                className="text-[13px] font-bold text-zinc-200 hover:text-primary-400 truncate transition-colors"
                              >
                                {ticket.titulo}
                              </Link>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {ticket.esta_bloqueado && (
                              <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-400">
                                <Flag size={11} fill="currentColor" />
                              </div>
                            )}
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${PRIORITY_COLORS[ticket.prioridad] || PRIORITY_COLORS.baja}`}>
                              {ticket.prioridad}
                            </span>
                            <select
                              className="text-[10px] font-black uppercase tracking-widest bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-400 outline-none focus:border-primary-500 transition-all cursor-pointer"
                              onChange={e => moveTaskMutation.mutate({ ticketId: ticket.id, sprint_id: e.target.value === 'backlog' ? null : Number(e.target.value) })}
                              value=""
                            >
                              <option value="" disabled>Mover</option>
                              <option value="backlog">Cola de Trabajo</option>
                              {sprintsArr.filter((s: any) => s.id !== sprint.id && !s.esta_finalizado).map((s: any) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest italic">
                        Sin tareas asignadas a este módulo
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cola de Trabajo (backlog) ────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Layers size={12} /> Cola de Trabajo
            <span className="text-[9px] font-black bg-zinc-800 border border-zinc-700 text-zinc-500 px-2 py-0.5 rounded-full">
              {filteredBacklog.length}
            </span>
          </h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {loadingBacklog ? (
              <div className="p-8 text-center text-zinc-600 font-bold text-[12px] animate-pulse">
                Cargando cola de trabajo...
              </div>
            ) : filteredBacklog.length > 0 ? (
              <div className="p-3 space-y-1.5">
                {filteredBacklog.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="flex items-center gap-3 px-4 py-3 bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/30 hover:border-zinc-700 rounded-xl transition-all group"
                  >
                    <GripVertical size={14} className="text-zinc-600/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-primary-500/70 bg-primary-500/5 px-1.5 py-0.5 rounded border border-primary-500/10 shrink-0">
                          OKAF-{ticket.id}
                        </span>
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="text-[13px] font-bold text-zinc-300 hover:text-primary-400 truncate transition-colors"
                        >
                          {ticket.titulo}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${PRIORITY_COLORS[ticket.prioridad] || PRIORITY_COLORS.baja}`}>
                        {ticket.prioridad}
                      </span>
                      {sprintsArr.filter((s: any) => !s.esta_finalizado).length > 0 && (
                        <select
                          className="text-[10px] font-black uppercase tracking-widest bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-400 outline-none focus:border-primary-500 transition-all cursor-pointer"
                          onChange={e => moveTaskMutation.mutate({ ticketId: ticket.id, sprint_id: Number(e.target.value) })}
                          value=""
                        >
                          <option value="" disabled>Mover a módulo</option>
                          {sprintsArr.filter((s: any) => !s.esta_finalizado).map((s: any) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Layers size={28} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-[12px] text-zinc-600 font-bold uppercase tracking-widest">
                  {searchTerm ? 'Sin resultados' : 'La cola de trabajo está vacía'}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setIsTicketModalOpen(true)}
                    className="mt-4 text-[11px] text-primary-400 font-bold hover:underline"
                  >
                    + Crear primera tarea
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Nueva Tarea ─────────────────────────────────────────────── */}
      <Modal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} title="Nueva Tarea">
        <form onSubmit={handleTicketSubmit(data => createTicketMutation.mutate(data))} className="space-y-4">
          <FormField label="Título">
            <input
              {...regTicket('titulo', { required: 'El título es obligatorio' })}
              className="input-dark w-full"
              placeholder="Descripción breve de la tarea..."
            />
          </FormField>
          <FormField label="Descripción">
            <textarea
              {...regTicket('descripcion')}
              rows={3}
              className="input-dark w-full resize-none"
              placeholder="Detalles y criterios de aceptación..."
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Puntos">
              <input
                type="number"
                {...regTicket('story_points')}
                className="input-dark w-full"
                defaultValue={0}
              />
            </FormField>
            <FormField label="Prioridad">
              <select {...regTicket('prioridad')} className="input-dark w-full" defaultValue="media">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsTicketModalOpen(false)} className="px-5 py-2.5 text-[12px]">
              Cancelar
            </Button>
            <Button type="submit" isLoading={createTicketMutation.isPending} className="px-6 py-2.5 text-[12px]">
              Crear Tarea
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Nuevo Módulo ────────────────────────────────────────────── */}
      <Modal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} title="Nuevo Módulo">
        <form onSubmit={handleSprintSubmit(data => createSprintMutation.mutate(data as CreateSprintDto))} className="space-y-4">
          <FormField label="Nombre del módulo">
            <input
              {...regSprint('nombre', { required: 'El nombre es obligatorio' })}
              className="input-dark w-full"
              placeholder="Ej: Módulo 1 — Análisis"
            />
          </FormField>
          <FormField label="Descripción / Objetivos">
            <textarea
              {...regSprint('descripcion')}
              rows={3}
              className="input-dark w-full resize-none"
              placeholder="¿De qué trata este módulo? ¿Qué debe lograr el equipo al finalizarlo?"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha inicio">
              <input
                type="date"
                {...regSprint('fecha_inicio', { required: true })}
                className="input-dark w-full"
              />
            </FormField>
            <FormField label="Fecha fin">
              <input
                type="date"
                {...regSprint('fecha_fin', { required: true })}
                className="input-dark w-full"
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsSprintModalOpen(false)} className="px-5 py-2.5 text-[12px]">
              Cancelar
            </Button>
            <Button type="submit" isLoading={createSprintMutation.isPending} className="px-6 py-2.5 text-[12px]">
              Crear Módulo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
