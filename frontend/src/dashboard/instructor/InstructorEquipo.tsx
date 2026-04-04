/**
 * InstructorEquipo
 * El instructor ve SOLO los usuarios de sus proyectos.
 * Puede cambiar rol aprendiz → lider_tecnico.
 * NO puede ver usuarios de otras fichas.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { userService } from '../../services/user.service';
import { projectService } from '../../services/project.service';
import { Users, ShieldCheck, GraduationCap, Search } from 'lucide-react';

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

  // Traer usuarios del contexto del instructor (solo sus fichas)
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
  // El instructor no debe ver otros instructores/coordinadores en esta vista
  const relevantes = users.filter((u: any) =>
    u.rol === 'aprendiz' || u.rol === 'lider_tecnico'
  );

  const filtered = relevantes.filter((u: any) => {
    const matchSearch = u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
                        u.correo?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || u.rol === filter;
    return matchSearch && matchFilter;
  });

  const aprendices = relevantes.filter((u: any) => u.rol === 'aprendiz').length;
  const lideres    = relevantes.filter((u: any) => u.rol === 'lider_tecnico').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-dark-text">Mi equipo</h2>
          <p className="text-sm text-dark-muted mt-0.5">
            {aprendices} aprendiz{aprendices !== 1 ? 'ces' : ''} · {lideres} líder{lideres !== 1 ? 'es' : ''} técnico{lideres !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar miembro..."
            className="input-dark pl-9 text-sm py-2 w-48"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-bg border border-dark-border rounded-lg p-1 w-fit">
        {([
          { key: 'all',          label: `Todos (${relevantes.length})` },
          { key: 'aprendiz',     label: `Aprendices (${aprendices})` },
          { key: 'lider_tecnico',label: `Líderes (${lideres})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-dark-card text-dark-text'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            {label}
          </button>
        ))}
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
                <th className="text-right px-4 py-3 text-xs font-medium text-dark-muted">Acción</th>
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
                          ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                          : <span className="text-[9px] font-semibold text-primary-400">{u.nombre?.slice(0,2).toUpperCase()}</span>
                        }
                      </div>
                      <span className="font-medium text-dark-text text-sm">{u.nombre}</span>
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
                        → Líder técnico
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};