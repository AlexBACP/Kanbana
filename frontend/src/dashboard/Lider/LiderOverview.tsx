import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { FolderKanban, Ticket, CheckCircle2, Clock } from 'lucide-react';

export const LiderOverview = () => {
  const { user } = useAuthStore();

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
    staleTime: 60_000,
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', miProyecto?.id],
    queryFn: () => ticketService.getAll(miProyecto?.id),
    enabled: !!miProyecto?.id,
  });

  const t = tickets as any[];
  const done = t.filter(x => x.estado === 'done').length;
  const inProgress = t.filter(x => x.estado === 'in_progress').length;
  const todo = t.filter(x => x.estado === 'to_do').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-dark-text">
          Hola, {user?.nombre?.split(' ')[0]} (Líder Técnico)
        </h1>
        <p className="text-sm text-dark-muted mt-0.5">
          {miProyecto ? `Gestionando el proyecto: ${miProyecto.nombre}` : 'No tienes un proyecto asignado aún.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Tickets',   value: t.length,   icon: Ticket,       color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Completados',    value: done,       icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En progreso',    value: inProgress, icon: Clock,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Por hacer',      value: todo,       icon: FolderKanban,  color: 'text-amber-400',   bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-muted">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={14} className={color} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-dark-text">{value}</p>
          </div>
        ))}
      </div>

      {miProyecto && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-dark-text mb-4">Información del Proyecto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-dark-muted uppercase tracking-widest">Instructor Responsable</p>
              <p className="text-sm text-dark-text font-medium mt-1">
                {miProyecto.instructor?.nombre || 'No asignado'}
              </p>
            </div>
            <div>
              <p className="text-xs text-dark-muted uppercase tracking-widest">Ficha de Formación</p>
              <p className="text-sm text-dark-text font-medium mt-1">
                {miProyecto.ficha?.programa || 'No asignada'} ({miProyecto.ficha?.codigo || 'S/N'})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
