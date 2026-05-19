/**
 * ── MODIFICADO ────────────────────────────────────────────────────────────────
 * KanbanPage — Tablero Kanban de un proyecto específico
 * Ruta: /projects/:id/kanban
 *
 * Cambios respecto a la versión original:
 *
 *  1. Se agrega un toggle de vista en el header: "Kanban" | "Trimestres".
 *     El botón "Trimestres" abre TrimestresView en lugar del tablero.
 *     El botón "Kanban" vuelve al tablero normal.
 *
 *
 *  3. Cuando la vista activa es 'trimestres', el contenedor deja de ser
 *     overflow-hidden y se convierte en scrollable para mostrar los acordeones.
 *
 *  4. El indicador del sprint activo sigue mostrándose en ambas vistas.
 *
 *  Todo lo demás (DnD, modal de ticket, cierre de sprint, panel de miembros)
 *  se mantiene sin cambios.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useParams, useNavigate }         from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Search, ListTodo, CheckCircle2,
  Users, Plus, Clock, AlertCircle, LayoutGrid, Flag,
  Layers, KanbanSquare,
} from 'lucide-react';
import { projectService }   from '../services/project.service';
import { ticketService }    from '../services/ticket.service';
import { userService }      from '../services/user.service';
import { KanbanBoard }      from '../components/KanbanBoard';
// ── NUEVO IMPORT ──────────────────────────────────────────────────────────────
import { Modal }            from '../components/Modal';
import { Button }           from '../components/Button';
import { useState }         from 'react';
import { TicketStatus }     from '../types/ticket.types';
import { useAuthStore }     from '../store/auth.store';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

export const KanbanPage = () => {
  const { id }       = useParams<{ id: string }>();
  const projectId    = Number(id);
  const queryClient  = useQueryClient();
  const { user }     = useAuthStore();
  const navigate     = useNavigate();
  const [searchTerm, setSearchTerm]         = useState('');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showMembers, setShowMembers]         = useState(false);
  // Trimestres gestionados desde ProjectPage — aquí siempre kanban
  const activeView = 'kanban';
  // ── NUEVO: estado del toggle de vista ────────────────────────────────────
  // 'kanban'     → tablero drag & drop (vista por defecto)
  // 'trimestres' → vista agrupada por trimestre con acordeones
  // Vista siempre en kanban — trimestres se gestionan desde ProjectPage

  const canManage = user?.rol === 'coordinador' || user?.rol === 'instructor' ||
                    (user?.rol === 'aprendiz' && user.es_lider_tecnico);

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn:  () => projectService.getById(projectId),
    enabled:  !!projectId,
  });

  const { data: activeSprint } = useQuery({
    queryKey: ['projects', projectId, 'sprint', 'active'],
    queryFn:  () => projectService.getActiveSprint(projectId),
    enabled:  !!projectId,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', projectId, activeSprint?.id],
    queryFn:  () => ticketService.getAll(projectId, activeSprint?.id),
    enabled:  !!projectId,
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn:  () => projectService.getMembers(projectId),
    enabled:  !!projectId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      ticketService.updateStatus(ticketId, { estado: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
    },
    onError: (err: any) => {
      // ── Muestra el mensaje del backend (ej: "requiere adjunto") ─────────
      alert(err?.response?.data?.message ?? 'No se pudo actualizar el estado del ticket.');
    },
  });

  const closeSprintMutation = useMutation({
    mutationFn: () => projectService.closeSprint(activeSprint!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
    },
    onError: (err: any) => {
      // ── Muestra el mensaje del backend (ej: tickets sin done) ───────────
      alert(err?.response?.data?.message ?? 'No se pudo cerrar el sprint.');
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({
      ...dto,
      proyecto_id: projectId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
      setShowTicketModal(false);
    },
  });

  const handleStatusChange = (ticketId: number, newStatus: TicketStatus) => {
    updateStatusMutation.mutate({ ticketId, status: newStatus });
  };

  const filteredTickets = tickets.filter((t: any) =>
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const done       = tickets.filter((t: any) => t.estado === 'done').length;
  const inProgress = tickets.filter((t: any) => t.estado === 'in_progress').length;
  const blocked    = tickets.filter((t: any) => t.esta_bloqueado).length;
  const progress   = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;
  const aprendices = (members as any[]).filter((m: any) => m.rol === 'aprendiz');

  // Esperar a que ambos (proyecto Y tickets) terminen de cargar
  // antes de mostrar el estado de error. Si solo project es undefined
  // pero ticketsLoading es true, todavía estamos cargando — no es un error.
  if (!project && !ticketsLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-dark-bg gap-4">
        <LayoutGrid size={40} className="text-dark-muted opacity-30" />
        <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Proyecto no encontrado</p>
        <button onClick={() => navigate('/dashboard')} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
          ← Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    // ── MODIFICADO: cambia overflow cuando la vista es 'trimestres' ─────────
    <div className={'h-screen flex flex-col bg-dark-bg overflow-hidden'}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-dark-card border-b border-dark-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-dark-bg hover:bg-dark-border rounded-xl text-dark-muted hover:text-primary-400 border border-dark-border transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black text-dark-text tracking-tight">{project?.nombre || '...'}</h1>
                {activeSprint ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{activeSprint.nombre}</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Sin Sprint Activo</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-dark-muted mt-0.5 line-clamp-1 max-w-lg">{project?.descripcion}</p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Stats rápidos */}
            <div className="hidden lg:flex items-center gap-3 bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-xs font-black">
              <span className="text-emerald-400">{done} ✓</span>
              <span className="text-dark-border">|</span>
              <span className="text-blue-400">{inProgress} ⟳</span>
              {blocked > 0 && <><span className="text-dark-border">|</span><span className="text-rose-400">{blocked} ⚑</span></>}
              <span className="text-dark-border">|</span>
              <span className="text-primary-400">{progress}%</span>
            </div>

                        {/* El instructor y coordinador ven ambas vistas.
                Los aprendices también pueden ver la vista de trimestres
                para entender la estructura del proyecto. */}
            <div className="flex items-center bg-dark-bg border border-dark-border rounded-xl overflow-hidden">
              <button
                onClick={() => {}}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black transition-all ${
                  activeView === 'kanban'
                    ? 'bg-primary-600/20 text-primary-400 border-r border-primary-500/20'
                    : 'text-dark-muted hover:text-dark-text border-r border-dark-border'
                }`}
              >
                <KanbanSquare size={13} /> Kanban
              </button>

            </div>

            {/* Buscador (solo en vista kanban) */}
            {activeView === 'kanban' && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  placeholder="Filtrar tareas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-dark-text outline-none focus:border-primary-500 transition-all w-44 placeholder:text-dark-muted/50"
                />
              </div>
            )}

            {/* Miembros */}
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center gap-1.5 px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs font-black text-dark-muted hover:text-dark-text hover:border-primary-500/40 transition-all"
            >
              <Users size={14} /> {aprendices.length}
            </button>

            {/* Crear ticket (solo kanban) */}
            {canManage && activeView === 'kanban' && (
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary-600/15 border border-primary-500/25 text-primary-400 rounded-xl text-xs font-black hover:bg-primary-600/25 transition-all"
              >
                <Plus size={14} /> Tarea
              </button>
            )}

            {/* Backlog */}
            <button
              onClick={() => navigate(`/projects/${projectId}/backlog`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs font-black text-dark-muted hover:text-dark-text transition-all"
            >
              <ListTodo size={14} /> Backlog
            </button>

            {/* Cerrar sprint (solo kanban) */}
            {activeSprint && canManage && activeView === 'kanban' && (
              <button
                onClick={() => {
                  if (confirm('¿Finalizar el sprint actual? Se verificará que todos los tickets estén completados.')) {
                    closeSprintMutation.mutate();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-black hover:bg-rose-500/20 transition-all"
              >
                <CheckCircle2 size={14} /> Finalizar Sprint
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        {tickets.length > 0 && (
          <div className="mt-3 h-1 bg-dark-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Panel de miembros (colapsable) ───────────────────────── */}
      {showMembers && (
        <div className="bg-dark-card/80 border-b border-dark-border px-6 py-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Equipo:</span>
            {aprendices.length === 0 ? (
              <span className="text-xs text-dark-muted italic">Sin integrantes asignados</span>
            ) : aprendices.map((m: any) => (
              <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 bg-dark-bg rounded-lg border border-dark-border text-xs">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-[8px] font-black text-white">
                  {m.nombre?.slice(0,1).toUpperCase()}
                </div>
                <span className="text-dark-text font-bold">{m.nombre.split(' ')[0]}</span>
                <span className="text-dark-muted text-[10px] capitalize">{m.rol === 'lider_tecnico' ? 'Líder' : 'Aprendiz'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ Contenido principal: Kanban o Trimestres ══════════════════════ */}

      {/* ── Vista Kanban (sin cambios) ─────────────────────────────────── */}
      {activeView === 'kanban' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          {!activeSprint ? (
            <div className="h-full flex flex-col items-center justify-center bg-dark-card/30 rounded-[3rem] border-4 border-dashed border-dark-border p-16 text-center">
              <div className="w-20 h-20 bg-dark-card rounded-[2rem] flex items-center justify-center mb-6 border border-dark-border">
                <ListTodo size={36} className="text-dark-muted opacity-40" />
              </div>
              <h3 className="text-2xl font-black text-dark-text tracking-tight">El tablero está en espera</h3>
              <p className="text-dark-muted max-w-sm mt-3 mb-8 text-sm leading-relaxed opacity-70">
                Para visualizar el flujo de trabajo, ve al backlog y activa un sprint con las tareas prioritarias.
              </p>
              <button
                onClick={() => navigate(`/projects/${projectId}/backlog`)}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-[1.5rem] font-black text-sm transition-all active:scale-95"
              >
                Ir al Backlog
              </button>
            </div>
          ) : ticketsLoading ? (
            <div className="flex gap-6 h-full">
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
      )}

      {/* ── NUEVA Vista Trimestres ─────────────────────────────────────── */}
      {/* Se muestra como un panel scrollable por debajo del header.
          TrimestresView carga sus propios datos con useQuery internamente.
          El instructor puede crear sprints y cerrar trimestres desde aquí. */}
      

      {/* ── Modal: Crear Ticket ───────────────────────────────────── */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Nueva Tarea">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createTicketMutation.mutate({
            titulo:       f.get('titulo') as string,
            descripcion:  f.get('descripcion') as string,
            prioridad:    f.get('prioridad') as string,
            asignado_a:   f.get('asignado_a') ? Number(f.get('asignado_a')) : undefined,
            fecha_limite: f.get('fecha_limite') || undefined,
            sprint_id:    activeSprint?.id || undefined,
          });
        }} className="space-y-5">
          <FormField label="Título">
            <input name="titulo" required className="input-dark" placeholder="Descripción breve de la tarea" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" className="input-dark resize-none" rows={3} placeholder="Detalles del ticket..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prioridad">
              <select name="prioridad" className="input-dark" defaultValue="media">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </FormField>
            <FormField label="Asignar a">
              <select name="asignado_a" className="input-dark">
                <option value="">Sin asignar</option>
                {aprendices.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Fecha límite">
            <input name="fecha_limite" type="date" className="input-dark" />
          </FormField>
          {activeSprint && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs text-emerald-400">
              <CheckCircle2 size={13} />
              Se añadirá al sprint activo: <strong>{activeSprint.nombre}</strong>
            </div>
          )}
          <Button
            type="submit"
            isLoading={createTicketMutation.isPending}
            className="w-full py-4"
          >
            {createTicketMutation.isPending ? 'Creando...' : 'Crear Tarea'}
          </Button>
          {createTicketMutation.isError && (
            <p className="text-xs text-rose-400 text-center flex items-center justify-center gap-1">
              <AlertCircle size={12} /> Error al crear el ticket.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};