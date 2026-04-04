import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle, Mail, FolderKanban, Users } from 'lucide-react';
import { userService } from '../../services/user.service';

export const LeadersPanel = () => {
  const { data: allUsers = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
  });

  const leaders = (allUsers as any[]).filter((u: any) => u.rol === 'lider_tecnico');

  if (isError) return (
    <div className="card p-12 flex flex-col items-center gap-3 text-danger">
      <AlertCircle size={28} />
      <p className="text-sm font-medium">Error al cargar líderes técnicos</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-title">Líderes técnicos</h2>
        <p className="section-subtitle">
          {isLoading ? '...' : `${leaders.length} líderes en el sistema`}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(n => <div key={n} className="h-36 bg-surface-hover rounded-2xl animate-pulse" />)}
        </div>
      ) : leaders.length === 0 ? (
        <div className="card p-12 text-center">
          <ShieldCheck size={28} className="mx-auto text-ink-muted mb-3 opacity-40" />
          <p className="text-sm text-ink-muted">No hay líderes técnicos registrados</p>
          <p className="text-xs text-ink-muted mt-1">
            Asigna el rol "Líder técnico" desde la sección Usuarios
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaders.map((l: any) => (
            <div
              key={l.id}
              className="card p-5 flex flex-col gap-4 hover:border-primary-500/40 transition-colors"
            >
              {/* Avatar + Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                  {l.avatar_url
                    ? <img src={l.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="text-sm font-semibold text-primary-400">{l.nombre?.slice(0,2).toUpperCase()}</span>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-primary truncate">{l.nombre}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`badge ${l.activo ? 'badge-success' : 'badge-danger'}`}>
                      {l.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-2 pt-3 border-t border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{l.correo}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <FolderKanban size={12} className="shrink-0" />
                  <span>Proyectos: —</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Users size={12} className="shrink-0" />
                  <span>Equipo: —</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
