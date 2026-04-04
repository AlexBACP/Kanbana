import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { fichaService } from '../../services/ficha.service';
import { FolderKanban, GraduationCap, Clock, CheckCircle2, ArrowRight, Users } from 'lucide-react';

interface Props {
  onNavigate: (section: any) => void;
}

export const InstructorOverview = ({ onNavigate }: Props) => {
  const { user } = useAuthStore();

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });

  const { data: fichas = [] } = useQuery({
    queryKey: ['fichas'],
    queryFn: fichaService.getAll,
    staleTime: 60_000,
  });

  const p = proyectos as any[];
  const f = fichas as any[];

  // Fichas donde el instructor tiene proyectos
  const misFichaIds = [...new Set(p.map((pr: any) => pr.fichaId).filter(Boolean))];
  const misFichas = f.filter((fi: any) => misFichaIds.includes(fi.id));

  const activos   = p.filter((pr: any) => pr.estado === 'activo').length;
  const pausados  = p.filter((pr: any) => pr.estado === 'pausado').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-dark-text">
          Hola, {user?.nombre?.split(' ')[0]}
        </h1>
        <p className="text-sm text-dark-muted mt-0.5">
          Tienes {p.length} proyecto{p.length !== 1 ? 's' : ''} activo{p.length !== 1 ? 's' : ''} en {misFichas.length} ficha{misFichas.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Mis fichas',        value: misFichas.length,  icon: GraduationCap, color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Proyectos activos', value: activos,           icon: FolderKanban,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En pausa',          value: pausados,          icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10' },
          { label: 'Total proyectos',   value: p.length,          icon: CheckCircle2,  color: 'text-primary-400', bg: 'bg-primary-500/10' },
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

      {/* Mis fichas */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <h3 className="text-sm font-medium text-dark-text">Mis fichas</h3>
          <button
            onClick={() => onNavigate('fichas')}
            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
          >
            Ver todas <ArrowRight size={11} />
          </button>
        </div>
        <div className="divide-y divide-dark-border">
          {misFichas.length === 0 ? (
            <p className="px-4 py-8 text-sm text-dark-muted text-center">Sin fichas asignadas</p>
          ) : misFichas.map((fi: any) => {
            const proyFicha = p.filter((pr: any) => pr.fichaId === fi.id);
            return (
              <div key={fi.id} className="flex items-center justify-between px-4 py-3 hover:bg-dark-border/20 transition-colors">
                <div>
                  <p className="text-sm font-medium text-dark-text">{fi.programa}</p>
                  <p className="text-xs text-dark-muted mt-0.5">
                    Ficha {fi.codigo} · {proyFicha.length} proyecto{proyFicha.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-xs text-dark-muted">
                  {proyFicha.filter((pr: any) => pr.estado === 'activo').length} activos
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Proyectos recientes */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <h3 className="text-sm font-medium text-dark-text">Proyectos recientes</h3>
          <button
            onClick={() => onNavigate('proyectos')}
            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight size={11} />
          </button>
        </div>
        <div className="divide-y divide-dark-border">
          {p.slice(0, 5).map((pr: any) => (
            <div key={pr.id} className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/20 transition-colors">
              <div className="w-7 h-7 bg-primary-500/10 rounded-lg flex items-center justify-center shrink-0">
                <FolderKanban size={14} className="text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-text truncate">{pr.nombre}</p>
                <p className="text-xs text-dark-muted">{pr.ficha?.codigo ?? 'Sin ficha'}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${
                pr.estado === 'activo'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : pr.estado === 'pausado'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-dark-border/40 text-dark-muted border-dark-border'
              }`}>
                {pr.estado === 'activo' ? 'Activo' : pr.estado === 'pausado' ? 'En pausa' : 'Finalizado'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};