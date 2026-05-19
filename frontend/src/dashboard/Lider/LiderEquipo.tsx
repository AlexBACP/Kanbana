/**
 * LiderEquipo — Equipo del proyecto del líder técnico.
 * Muestra SOLO los miembros del proyecto donde él es líder.
 * Información de contacto + estado + perfil.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { UserProfileModal } from '../../components/UserProfileModal';
import {
  Search, Mail, Phone, ShieldCheck, Users, Eye,
  FolderKanban, Crown, BookOpen,
} from 'lucide-react';

const ROL_BADGE: Record<string, { bg: string; label: string; icon: any }> = {
  aprendiz:      { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',     label: 'Aprendiz',       icon: BookOpen },
  lider_tecnico: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Líder técnico', icon: Crown },
};

export const LiderEquipo = () => {
  const [search, setSearch] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
    staleTime: 60_000,
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: miembros = [], isLoading } = useQuery({
    queryKey: ['projects', miProyecto?.id, 'members'],
    queryFn: () => projectService.getMembers(miProyecto?.id),
    enabled: !!miProyecto?.id,
    staleTime: 60_000,
  });

  const miembrosArr = miembros as any[];
  const filtered = miembrosArr.filter(m =>
    m.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    m.correo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Mi Equipo</h2>
          {miProyecto ? (
            <p className="section-subtitle">
              <span className="inline-flex items-center gap-1">
                <FolderKanban size={11} className="text-ink-muted" />
                {miProyecto.nombre}
              </span>
              {' · '}{miembrosArr.length} miembro{miembrosArr.length !== 1 ? 's' : ''}
            </p>
          ) : (
            <p className="section-subtitle">Sin proyecto asignado</p>
          )}
        </div>
      </div>

      {/* Contexto del proyecto */}
      {miProyecto && (
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center shrink-0">
            <FolderKanban size={18} className="text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate">{miProyecto.nombre}</p>
            <p className="text-xs text-ink-muted">{miProyecto.ficha?.codigo ? `Ficha ${miProyecto.ficha.codigo}` : 'Sin ficha'} · {miProyecto.estado}</p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-ink-primary">{miembrosArr.filter(m => m.rol === 'aprendiz').length}</p>
              <p className="text-[10px] text-ink-muted">Aprendices</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">{miembrosArr.filter(m => m.rol === 'lider_tecnico').length}</p>
              <p className="text-[10px] text-ink-muted">Líderes</p>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      {miembrosArr.length > 0 && (
        <div className="relative w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-base pl-9 w-full text-sm"
          />
        </div>
      )}

      {/* Lista de miembros */}
      {!miProyecto ? (
        <div className="card p-10 text-center">
          <FolderKanban size={28} className="mx-auto text-ink-muted mb-3 opacity-30" />
          <p className="text-sm text-ink-muted">No tienes un proyecto asignado todavía</p>
          <p className="text-xs text-ink-muted mt-1">Un coordinador o instructor debe asignarte como líder de un proyecto</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => <div key={n} className="h-36 bg-surface-hover rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Users size={28} className="mx-auto text-ink-muted mb-3 opacity-30" />
          <p className="text-sm text-ink-muted">
            {search ? 'Sin coincidencias' : 'Aún no hay miembros en este proyecto'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m: any) => {
            const rolCfg = ROL_BADGE[m.rol] ?? ROL_BADGE.aprendiz;
            const RolIcon = rolCfg.icon;
            return (
              <div key={m.id} className="card p-4 flex flex-col hover:border-primary-500/30 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600/10 rounded-full flex items-center justify-center border border-primary-600/20 overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        <img src={userService.getAvatarUrl(m.avatar_url) || ''} alt={m.nombre} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary-400">{m.nombre?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-primary leading-tight">{m.nombre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <RolIcon size={10} className={rolCfg.bg.includes('amber') ? 'text-amber-400' : 'text-emerald-400'} />
                        <span className={`text-[10px] font-medium ${rolCfg.bg.includes('amber') ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {rolCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${m.activo ? 'bg-emerald-500' : 'bg-slate-500'}`} title={m.activo ? 'Activo' : 'Inactivo'} />
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Mail size={11} className="shrink-0" />
                    <span className="text-xs truncate">{m.correo}</span>
                  </div>
                  {m.telefono && (
                    <div className="flex items-center gap-2 text-ink-muted">
                      <Phone size={11} className="shrink-0" />
                      <span className="text-xs">{m.telefono}</span>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-surface-border flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${m.activo ? 'text-emerald-400' : 'text-ink-muted'}`}>
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    onClick={() => setProfileUserId(m.id)}
                    className="text-[10px] text-primary-400 hover:text-primary-300 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    <Eye size={10} /> Ver perfil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {profileUserId !== null && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
