import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  FolderKanban,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowUpRight
} from 'lucide-react';
import { projectService } from "../../services/project.service";
import { ticketService } from "../../services/ticket.service";
import { useAuthStore } from "../../store/auth.store";
import { Link } from 'react-router-dom';

export const Overview = () => {
  const { user } = useAuthStore();

  // Mantenemos tu lógica de conexión original
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', 'all'],
    queryFn: () => ticketService.getAll(),
  });

  // Estadísticas calculadas dinámicamente con estilos mejorados
  const stats = [
    {
      label: 'Proyectos Activos',
      value: projects.filter(p => p.estado === 'activo').length,
      icon: FolderKanban,
      color: 'blue',
    },
    {
      label: 'Tickets Pendientes',
      value: tickets.filter(t => t.estado === 'to_do' || t.estado === 'in_progress').length,
      icon: Clock,
      color: 'amber',
    },
    {
      label: 'En Testing',
      value: tickets.filter(t => t.estado === 'testing').length,
      icon: AlertCircle,
      color: 'purple',
    },
    {
      label: 'Completados',
      value: tickets.filter(t => 
        t.estado === 'done' && 
        new Date(t.actualizado_en).getMonth() === new Date().getMonth()
      ).length,
      icon: CheckCircle2,
      color: 'emerald',
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* 1. Header Dinámico Pro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-dark-card/40 p-8 rounded-[2.5rem] border border-dark-border/50 shadow-2xl">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-dark-text tracking-tight">Panel de Control</h1>
          <p className="text-dark-muted font-bold flex items-center gap-2">
            Bienvenido de nuevo, 
            <span className="text-primary-400 bg-primary-500/10 px-3 py-1 rounded-xl border border-primary-500/20 shadow-sm">
              {user?.nombre}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 bg-dark-bg/60 px-5 py-3 rounded-2xl border border-dark-border shadow-inner">
          <CalendarIcon size={20} className="text-primary-400" />
          <div className="text-right">
            <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Hoy</p>
            <p className="text-xs font-black text-dark-text uppercase">
              {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Grid de Estadísticas con Animación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div 
            key={index}
            whileHover={{ y: -5 }}
            className="bg-dark-card p-7 rounded-[2rem] border border-dark-border shadow-xl hover:border-primary-500/30 transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={`p-4 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400 border border-${stat.color}-500/20 group-hover:scale-110 transition-transform shadow-lg`}>
                <stat.icon size={26} />
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                <TrendingUp size={12} /> +12%
              </span>
            </div>
            <p className="text-[10px] font-black text-dark-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-dark-text tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 3. Proyectos Recientes (Lógica de carga adaptada) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-xl font-black text-dark-text tracking-tight flex items-center gap-3">
              Proyectos Recientes
              <span className="text-[10px] bg-dark-border px-2 py-1 rounded-lg text-dark-muted">{projects.length}</span>
            </h2>
            <Link to="/projects" className="text-[10px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest bg-primary-500/5 px-4 py-2 rounded-xl border border-primary-500/10 transition-all flex items-center gap-2 group">
              Ver todos <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
          
          <div className="bg-dark-card rounded-[2.5rem] border border-dark-border shadow-2xl overflow-hidden backdrop-blur-sm">
            {loadingProjects ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto" />
                <p className="text-dark-muted font-black text-xs uppercase tracking-widest">Sincronizando Proyectos...</p>
              </div>
            ) : projects.length > 0 ? (
              <div className="divide-y divide-dark-border/50">
                {projects.slice(0, 5).map((project) => (
                  <Link 
                    key={project.id} 
                    to={`/projects/${project.id}/kanban`}
                    className="flex items-center justify-between p-7 hover:bg-dark-bg/40 transition-all group"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-600/5 text-primary-400 flex items-center justify-center font-black text-xl border border-primary-500/20 shadow-lg group-hover:scale-105 transition-transform">
                        {project.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-dark-text text-lg group-hover:text-primary-400 transition-colors leading-tight">{project.nombre}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                           <span className="text-[10px] text-dark-muted font-bold opacity-60">ID: #{project.id.toString().padStart(3, '0')}</span>
                           <div className="w-1 h-1 rounded-full bg-dark-border" />
                           <p className="text-xs text-dark-muted font-medium line-clamp-1 opacity-80 italic">{project.descripcion || 'Sin descripción'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-bg/60 rounded-xl border border-dark-border">
                         <div className={`w-1.5 h-1.5 rounded-full ${project.estado === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                         <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{project.estado}</span>
                      </div>
                      <ChevronRight size={20} className="text-dark-muted group-hover:text-primary-400 transition-all group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center space-y-3 opacity-60">
                <FolderKanban size={48} className="mx-auto text-dark-muted/20" />
                <p className="text-dark-muted font-bold italic">No hay proyectos activos en el sistema.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Actividad (Estilo Bitácora SENA) */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-dark-text tracking-tight px-4">Bitácora</h2>
          <div className="bg-dark-card p-8 rounded-[2.5rem] border border-dark-border shadow-2xl space-y-8 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
              <Clock size={100} />
            </div>
            
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-5 relative z-10 group/item">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted shadow-inner group-hover/item:border-primary-500/50 transition-colors group-hover/item:text-primary-400">
                    <Clock size={16} />
                  </div>
                  {i < 4 && <div className="absolute top-10 bottom-[-32px] left-5 w-px bg-gradient-to-b from-dark-border to-transparent" />}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm text-dark-text font-black group-hover/item:text-primary-400 transition-colors">Estado Actualizado</p>
                  <p className="text-[11px] text-dark-muted font-bold mt-1 opacity-80">Ticket #{100+i} movido a "Done"</p>
                  <p className="text-[9px] text-primary-400/60 mt-2 uppercase font-black tracking-[0.2em] bg-primary-500/5 w-fit px-2 py-0.5 rounded-md border border-primary-500/10">Hace {i * 15}m</p>
                </div>
              </div>
            ))}
            
            <button className="w-full py-4 mt-4 border-2 border-dashed border-dark-border rounded-2xl text-[10px] font-black text-dark-muted uppercase tracking-widest hover:border-primary-500/30 hover:text-primary-400 transition-all">
              Ver historial completo
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};