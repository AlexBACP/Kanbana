import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, Briefcase, Zap,
  ExternalLink, Users, AlertCircle, Mail, TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { userService } from '../../services/user.service';

const SKILL_BADGES = ['React', 'NestJS', 'MySQL', 'Docker', 'Git', 'TypeScript', 'AWS'];

export const LeadersPanel = () => {
  const { data: allUsers = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  });

  const leaders = (allUsers as any[]).filter((u: any) => u.rol === 'lider_tecnico');

  if (isError) return (
    <div className="flex flex-col items-center justify-center p-20 text-rose-400 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/20">
      <AlertCircle size={48} className="mb-4" />
      <p className="font-black uppercase tracking-widest text-sm">Error al cargar líderes técnicos</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Squad Leaders</h2>
          <p className="text-dark-muted text-sm font-bold mt-1">
            {isLoading ? '...' : `${leaders.length} líderes técnicos registrados`}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-black uppercase tracking-widest">
          <ShieldCheck size={14} />
          Equipo Técnico ADSO
        </div>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Líderes Activos', value: leaders.filter((l: any) => l.activo).length, icon: ShieldCheck, color: 'emerald' },
          { label: 'Total Líderes', value: leaders.length, icon: Users, color: 'blue' },
          { label: 'Con Proyectos', value: Math.min(leaders.length, 3), icon: Briefcase, color: 'violet' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-dark-card border border-dark-border rounded-[1.5rem] p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-${color}-500/10`}>
              <Icon size={18} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-xl font-black text-dark-text">{value}</p>
              <p className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* LEADERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map(n => (
            <div key={n} className="h-72 bg-dark-card/50 rounded-[2.5rem] animate-pulse border border-dark-border" />
          ))
        ) : leaders.length === 0 ? (
          <div className="col-span-3 text-center py-16 bg-dark-card/20 rounded-[2.5rem] border border-dashed border-dark-border">
            <ShieldCheck size={36} className="mx-auto text-dark-muted mb-4 opacity-40" />
            <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin líderes técnicos registrados</p>
            <p className="text-xs text-dark-muted/60 mt-2">Asigna el rol "lider_tecnico" a usuarios desde el panel de usuarios</p>
          </div>
        ) : (
          leaders.map((leader: any, i: number) => (
            <motion.div
              key={leader.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-dark-card p-6 rounded-[2.5rem] border border-dark-border hover:border-emerald-500/30 transition-all group"
            >
              {/* Avatar + Name */}
              <div className="flex items-start gap-4 mb-5">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xl font-black shadow-lg border border-emerald-500/20 group-hover:scale-105 transition-transform overflow-hidden">
                    {leader.avatar_url ? (
                      <img src={leader.avatar_url} alt={leader.nombre} className="w-full h-full object-cover" />
                    ) : (
                      leader.nombre?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-dark-card ${leader.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-dark-text group-hover:text-emerald-400 transition-colors truncate">
                    {leader.nombre}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Mail size={12} className="text-dark-muted" />
                    <p className="text-xs text-dark-muted truncate">{leader.correo}</p>
                  </div>
                  <span className={`inline-block mt-2 text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${leader.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {leader.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {/* Mock skills */}
              <div className="mb-5">
                <p className="text-[10px] font-black text-dark-muted uppercase tracking-widest mb-2">Stack técnico</p>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_BADGES.slice(0, 4).map(skill => (
                    <span key={skill} className="text-[10px] font-black px-2 py-1 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20 uppercase tracking-wider">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Proyectos', value: '—', icon: Briefcase },
                  { label: 'Tickets', value: '—', icon: Zap },
                  { label: 'Progreso', value: '—%', icon: TrendingUp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-dark-bg/50 rounded-xl p-2 text-center border border-dark-border/50">
                    <p className="text-xs font-black text-dark-text">{value}</p>
                    <p className="text-[9px] text-dark-muted uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-4 border-t border-dark-border/50">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-600/10 text-primary-400 border border-primary-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/20 transition-all">
                  <ExternalLink size={12} /> Ver Celda
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-dark-bg/50 text-dark-muted border border-dark-border text-[10px] font-black uppercase tracking-widest hover:text-dark-text hover:bg-dark-bg transition-all">
                  <Users size={12} /> Equipo
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
