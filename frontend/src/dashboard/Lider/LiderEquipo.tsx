import { useQuery } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { Search, Mail, Phone, UserPlus, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { useState } from 'react';

export const LiderEquipo = () => {
  const [search, setSearch] = useState('');

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: miembros = [], isLoading } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(miProyecto?.id),
    enabled: !!miProyecto?.id,
  });

  const filtered = (miembros as any[]).filter(m => 
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    m.correo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-dark-text uppercase tracking-widest flex items-center gap-2">
            Mi Equipo de Trabajo
            <span className="badge badge-primary px-2 py-0.5 text-[10px]">{miembros.length} Miembros</span>
          </h2>
          <p className="text-xs text-dark-muted mt-1">Gestión de aprendices asignados al proyecto</p>
        </div>
        <button className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2">
          <UserPlus size={14} /> Gestionar Miembros
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-20 text-center text-dark-muted animate-pulse">Cargando equipo...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-dark-muted border border-dashed border-dark-border rounded-xl">
            No se encontraron miembros en el equipo.
          </div>
        ) : filtered.map((m) => (
          <div key={m.id} className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col hover:border-primary-500/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600/10 rounded-full flex items-center justify-center border border-primary-600/20">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.nombre} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary-400">{m.nombre.substring(0,2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark-text">{m.nombre}</p>
                  <p className="text-[10px] text-dark-muted uppercase tracking-widest flex items-center gap-1 mt-0.5">
                    <ShieldCheck size={10} className="text-primary-400" /> {m.rol.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button className="p-1.5 text-dark-muted hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-2.5 text-dark-muted">
                <Mail size={12} className="shrink-0" />
                <span className="text-xs truncate">{m.correo}</span>
              </div>
              <div className="flex items-center gap-2.5 text-dark-muted">
                <Phone size={12} className="shrink-0" />
                <span className="text-xs">{m.telefono || 'Sin teléfono'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-dark-muted">
                <Clock size={12} className="shrink-0" />
                <span className="text-xs">Activo hace 2h</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-dark-border flex items-center justify-between">
              <span className={`text-[10px] uppercase font-bold tracking-widest ${m.activo ? 'text-emerald-400' : 'text-dark-muted'}`}>
                {m.activo ? 'En línea' : 'Desconectado'}
              </span>
              <button className="text-[10px] text-primary-400 hover:text-primary-300 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
                Ver Perfil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
