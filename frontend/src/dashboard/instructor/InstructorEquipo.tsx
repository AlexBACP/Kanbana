/**
 * InstructorEquipo
 * El instructor ve SOLO los usuarios de sus fichas.
 * Puede ver el perfil completo de cada aprendiz/líder.
 * Puede cambiar contraseña de sus aprendices/líderes.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { userService } from '../../services/user.service';
import { UserProfileModal } from '../../components/UserProfileModal';
import { Users, ShieldCheck, GraduationCap, Search, Eye } from 'lucide-react';

const ROL_LABEL: Record<string, string> = {
  aprendiz:      'Aprendiz',
  lider_tecnico: 'Líder técnico',
  instructor:    'Instructor',
  coordinador:   'Coordinador',
};

const ROL_BADGE: Record<string, string> = {
  aprendiz:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export const InstructorEquipo = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'aprendiz' | 'lider_tecnico'>('all');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const { data: context, isLoading } = useQuery({
    queryKey: ['users', 'my-context'],
    queryFn: userService.getMyContext,
    staleTime: 60_000,
  });

  const promoteMutation = useMutation({
    mutationFn: ({ id, rol }: { id: number; rol: string }) =>
      userService.updateRole(id, rol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'my-context'] });
    },
  });

  const users = (context as any)?.users ?? [];
  const relevantes = users.filter((u: any) =>
    u.rol === 'aprendiz' || u.rol === 'lider_tecnico'
  );

  const filtered = relevantes.filter((u: any) => {
    const term = search.toLowerCase();
    const matchSearch = u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term);
    const matchFilter = filter === 'all' || u.rol === filter;
    return matchSearch && matchFilter;
  });

  const tabs = [
    { key: 'all' as const,           label: `Todos (${relevantes.length})` },
    { key: 'aprendiz' as const,      label: `Aprendices (${relevantes.filter((u: any) => u.rol === 'aprendiz').length})` },
    { key: 'lider_tecnico' as const, label: `Líderes (${relevantes.filter((u: any) => u.rol === 'lider_tecnico').length})` },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-dark-text tracking-tight flex items-center gap-3">
            <Users size={22} className="text-primary-400" /> Mi Equipo
          </h2>
          <p className="text-sm text-dark-muted mt-1">{relevantes.length} integrantes en tus fichas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9 pr-4 py-2 bg-dark-card border border-dark-border rounded-xl text-sm text-dark-text outline-none focus:border-primary-500 transition-all w-52"
          />
        </div>
        <div className="flex gap-1 bg-dark-bg border border-dark-border rounded-xl p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === key ? 'bg-dark-card text-dark-text' : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(n => <div key={n} className="h-10 bg-dark-bg rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Correo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-muted">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-dark-muted">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm text-dark-muted">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-dark-border/50 last:border-0 hover:bg-dark-bg/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                        {u.avatar_url
                          ? <img src={userService.getAvatarUrl(u.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                          : <span className="text-[9px] font-semibold text-primary-400">{u.nombre?.slice(0,2).toUpperCase()}</span>
                        }
                      </div>
                      <button
                        onClick={() => setProfileUserId(u.id)}
                        className="font-medium text-dark-text text-sm hover:text-primary-400 transition-colors"
                      >
                        {u.nombre}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-dark-muted">{u.correo}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${ROL_BADGE[u.rol] ?? ''}`}>
                      {ROL_LABEL[u.rol]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${
                      u.activo
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Ver perfil completo */}
                      <button
                        onClick={() => setProfileUserId(u.id)}
                        className="text-xs text-dark-muted hover:text-primary-400 border border-dark-border hover:border-primary-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
                      >
                        <Eye size={11} /> Perfil
                      </button>
                      {/* Promover / degradar */}
                      {u.rol === 'aprendiz' && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Promover a ${u.nombre} como Líder Técnico?`)) {
                              promoteMutation.mutate({ id: u.id, rol: 'lider_tecnico' });
                            }
                          }}
                          disabled={promoteMutation.isPending}
                          className="text-xs text-dark-muted hover:text-primary-400 border border-dark-border hover:border-primary-500/30 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          → Líder
                        </button>
                      )}
                      {u.rol === 'lider_tecnico' && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Regresar a ${u.nombre} como Aprendiz?`)) {
                              promoteMutation.mutate({ id: u.id, rol: 'aprendiz' });
                            }
                          }}
                          disabled={promoteMutation.isPending}
                          className="text-xs text-dark-muted hover:text-amber-400 border border-dark-border hover:border-amber-500/30 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          → Aprendiz
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel de perfil lateral */}
      <AnimatePresence>
        {profileUserId !== null && (
          <UserProfileModal
            userId={profileUserId}
            onClose={() => setProfileUserId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
