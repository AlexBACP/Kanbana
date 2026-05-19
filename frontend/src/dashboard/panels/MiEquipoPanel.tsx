/**
 * MiEquipoPanel
 *
 * Panel exclusivo del rol Líder Técnico. Muestra los aprendices que el
 * instructor asignó al mismo proyecto que lidera el usuario autenticado.
 *
 * ── NUEVO ────────────────────────────────────────────────────────────────
 * Antes: el líder técnico veía "LeadersPanel", que carga TODOS los aprendices
 * con es_lider_tecnico=true del sistema. Es decir, veía a otros líderes, no
 * a su propio equipo.
 *
 * Ahora: este panel busca el proyecto donde liderId = user.id y luego
 * carga los miembros de ese proyecto (GET /projects/:id/members). Filtra
 * para mostrar solo los aprendices (excluye al propio líder de la lista).
 * ────────────────────────────────────────────────────────────────────────
 */
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { Users, Mail, FolderKanban, AlertCircle } from 'lucide-react';

export const MiEquipoPanel = () => {
  const { user } = useAuthStore();

  // Paso 1: obtener el proyecto donde este aprendiz es líder técnico
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectService.getAll(),
  });

  // El proyecto donde liderId coincide con el usuario autenticado
  const miProyecto = (proyectos as any[]).find(
    (p: any) => p.liderId === user?.id || p.lider?.id === user?.id
  );

  // Paso 2: obtener los miembros de ese proyecto
  const { data: miembros = [], isLoading: loadingMiembros } = useQuery({
    queryKey: ['project-members', miProyecto?.id],
    queryFn:  () => projectService.getMembers(miProyecto.id),
    // Solo ejecuta si tenemos el proyecto
    enabled:  !!miProyecto?.id,
  });

  const isLoading = loadingProyectos || loadingMiembros;

  // Filtrar: solo aprendices que NO sean el propio líder
  // El endpoint devuelve miembros + lider, así que excluimos al usuario actual
  const equipo = (miembros as any[]).filter(
    (m: any) => m.id !== user?.id && m.rol === 'aprendiz'
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="section-title">Mi Equipo</h2>
          <p className="section-subtitle">Cargando...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-36 bg-surface-hover rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!miProyecto) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="section-title">Mi Equipo</h2>
          <p className="section-subtitle">No tienes un proyecto asignado aún</p>
        </div>
        <div className="card p-12 text-center">
          <Users size={28} className="mx-auto text-ink-muted mb-3 opacity-40" />
          <p className="text-sm text-ink-muted">
            Tu coordinador o instructor debe asignarte como líder de un proyecto
            para que puedas ver tu equipo aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-title">Mi Equipo</h2>
        <p className="section-subtitle">
          {isLoading ? '...' : `${equipo.length} aprendices en ${miProyecto.nombre}`}
        </p>
      </div>

      {/* Info del proyecto */}
      <div className="card p-4 flex items-center gap-3 border-primary-500/20 bg-primary-500/5">
        <FolderKanban size={18} className="text-primary-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-ink-primary">{miProyecto.nombre}</p>
          <p className="text-xs text-ink-muted">Tu proyecto activo como líder técnico</p>
        </div>
      </div>

      {equipo.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={28} className="mx-auto text-ink-muted mb-3 opacity-40" />
          <p className="text-sm text-ink-muted">
            Aún no hay aprendices asignados a este proyecto
          </p>
          <p className="text-xs text-ink-muted mt-1">
            El instructor debe añadir aprendices desde el panel de gestión del proyecto
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipo.map((m: any) => (
            <div
              key={m.id}
              className="card p-5 flex flex-col gap-4 hover:border-primary-500/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar_url
                    ? <img
                        src={userService.getAvatarUrl(m.avatar_url) || ''}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    : <span className="text-sm font-semibold text-primary-400">
                        {m.nombre?.slice(0, 2).toUpperCase()}
                      </span>
                  }
                </div>

                {/* Nombre y estado */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-primary truncate">
                    {m.nombre}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {m.es_lider_tecnico && (
                      <span className="badge badge-warning">Sub-líder</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-2 pt-3 border-t border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{m.correo}</span>
                </div>
                {m.ficha && (
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <FolderKanban size={12} className="shrink-0" />
                    <span>Ficha {m.ficha.codigo}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};