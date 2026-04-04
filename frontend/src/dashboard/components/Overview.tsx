import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Clock, CheckCircle2, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { useAuthStore } from '../../store/auth.store';

export const Overview = () => {
  const { user } = useAuthStore();

  // --- Lógica para el Banner ---
  const formattedDate = useMemo(() => {
    const date = new Date();
    return new Intl.DateTimeFormat('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }).format(date);
  }, []);

  // Definimos colores/gradientes por rol
  const bannerStyles: Record<string, string> = {
    coordinador: 'from-emerald-500 to-teal-600',
    instructor: 'from-indigo-500 to-purple-600',
    lider_tecnico: 'from-blue-500 to-cyan-600',
    default: 'from-slate-700 to-slate-800'
  };

  const currentStyle = bannerStyles[user?.rol || 'default'];
  // -----------------------------

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', 'all'],
    queryFn: () => ticketService.getAll(),
  });

  const p = projects as any[];
  const t = tickets as any[];

  const stats = [
    {
      label: 'Proyectos activos',
      value: p.filter(x => x.estado === 'activo').length,
      icon: FolderKanban,
      color: 'text-info',
      bg: 'bg-info-light',
    },
    {
      label: 'Tickets en progreso',
      value: t.filter(x => x.estado === 'in_progress').length,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning-light',
    },
    {
      label: 'Completados (mes)',
      value: t.filter(x => x.estado === 'done' && new Date(x.actualizado_en).getMonth() === new Date().getMonth()).length,
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success-light',
    },
    {
      label: 'Bloqueados',
      value: t.filter(x => x.bloqueado).length,
      icon: AlertTriangle,
      color: 'text-danger',
      bg: 'bg-danger-light',
    },
  ];

  const recentProjects = p.slice(0, 5);
  const recentTickets = t.filter(x => x.estado !== 'done').slice(0, 6);

  return (
    <div className="space-y-6">
      
      {/* ✅ NUEVO: Hero Banner Estilo Jira */}
      <div className={`relative overflow-hidden rounded-2xl p-8 text-white shadow-lg bg-gradient-to-r ${currentStyle}`}>
        {/* Decoración de fondo (Simulando los engranajes de la imagen) */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full transform translate-x-10 translate-y-[-20%]">
            <path fill="currentColor" d="M44.7,-76.4C58.1,-69.2,69.2,-57.4,76.5,-43.8C83.8,-30.2,87.3,-15.1,86.5,-0.5C85.7,14.1,80.5,28.2,72.4,40.6C64.3,53,53.2,63.7,40.4,71.1C27.6,78.5,13.8,82.5,-0.5,83.4C-14.8,84.3,-29.7,82.1,-43,75.2C-56.3,68.4,-68.1,56.9,-76.2,43.4C-84.3,29.9,-88.7,14.9,-88.2,0.3C-87.7,-14.3,-82.3,-28.6,-74.1,-41.2C-65.9,-53.8,-54.9,-64.7,-42,-72.1C-29.1,-79.6,-14.5,-83.5,0.3,-84.1C15.1,-84.7,31.2,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-90 flex items-center gap-2 capitalize">
              <CalendarIcon size={14} />
              {formattedDate}
            </p>
            <h1 className="text-3xl font-bold mt-2 tracking-tight">
              Hola, {user?.nombre?.split(' ')[0]} {user?.nombre?.split(' ')[1] || ''}
            </h1>
            <p className="text-indigo-100 mt-1 font-medium">
              {user?.rol === 'coordinador' ? 'Resumen global del centro de formación' : 
               user?.rol === 'instructor' ? 'Estado de tus fichas y proyectos' : 
               'Progreso de tu equipo de desarrollo'}
            </p>
          </div>

          {/* Badge de estado opcional estilo Jira */}
          <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Sistema Operativo</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-ink-secondary">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={14} className={color} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-ink-primary">
              {loadingProjects ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* ... Resto del código (Proyectos y Tickets) se mantiene igual ... */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Proyectos recientes */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h3 className="text-sm font-medium text-ink-primary">Proyectos recientes</h3>
            <span className="text-xs text-ink-muted">{p.length} total</span>
          </div>
          <div className="divide-y divide-surface-border">
            {recentProjects.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted text-center">Sin proyectos aún</p>
            ) : recentProjects.map((proj: any) => (
              <div key={proj.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-primary truncate">{proj.nombre}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{proj.ficha?.codigo ?? 'Sin ficha'}</p>
                </div>
                <span className={`badge ml-3 shrink-0 ${
                  proj.estado === 'activo' ? 'badge-success' :
                  proj.estado === 'pausado' ? 'badge-warning' : 'badge-gray'
                }`}>
                  {proj.estado === 'activo' ? 'Activo' : proj.estado === 'pausado' ? 'En pausa' : 'Finalizado'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets pendientes */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h3 className="text-sm font-medium text-ink-primary">Tickets pendientes</h3>
            <span className="text-xs text-ink-muted">{t.filter(x => x.estado !== 'done').length} abiertos</span>
          </div>
          <div className="divide-y divide-surface-border">
            {recentTickets.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted text-center">Todo al día</p>
            ) : recentTickets.map((tk: any) => (
              <div key={tk.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  tk.prioridad === 'alta' ? 'bg-danger' :
                  tk.prioridad === 'media' ? 'bg-warning' : 'bg-ink-muted'
                }`} />
                <p className="text-sm text-ink-primary truncate flex-1">{tk.titulo}</p>
                <span className={`badge shrink-0 ${
                  tk.estado === 'in_progress' ? 'badge-info' :
                  tk.estado === 'testing' ? 'badge-warning' : 'badge-gray'
                }`}>
                  {tk.estado === 'in_progress' ? 'En progreso' :
                   tk.estado === 'testing' ? 'Testing' : 'Por hacer'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};