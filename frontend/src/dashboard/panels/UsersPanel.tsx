import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Users, UserPlus, Search, Trash2, ChevronDown,
  CheckCircle, XCircle, Eye,
} from 'lucide-react';
import { userService } from '../../services/user.service';
import { Modal } from '../../components/Modal';
import { UserProfileModal } from '../../components/UserProfileModal';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../store/auth.store';
import { AnimatePresence } from 'framer-motion';

const ROL_LABEL: Record<string, string> = {
  coordinador: 'Coordinador', instructor: 'Instructor',
  lider_tecnico: 'Líder técnico', aprendiz: 'Aprendiz',
};
const ROL_BADGE: Record<string, string> = {
  coordinador:   'badge badge-info',
  instructor:    'badge bg-surface-hover text-ink-secondary border-surface-border',
  lider_tecnico: 'badge badge-success',
  aprendiz:      'badge badge-warning',
};
const ROLES = ['coordinador', 'instructor', 'lider_tecnico', 'aprendiz'];

export const UsersPanel = () => {
  const { user: me } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => userService.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setIsModalOpen(false); reset(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, rol }: any) => userService.updateRole(id, rol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => userService.toggleStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { register, handleSubmit, reset } = useForm<any>();
  const onSubmit = (data: any) => createMutation.mutate(data);

  const usersArr = users as any[];
  const filtered = usersArr.filter(u => {
    const term = search.toLowerCase();
    const matchSearch = u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term);
    const matchGroup = activeGroup === 'all' || u.rol === activeGroup;
    return matchSearch && matchGroup;
  });

  const isAdmin = me?.rol === 'coordinador';
  const canViewProfiles = me?.rol === 'coordinador' || me?.rol === 'instructor';

  const tabs = [
    { key: 'all', label: 'Todos', count: usersArr.length },
    ...ROLES.map(r => ({ key: r, label: ROL_LABEL[r], count: usersArr.filter(u => u.rol === r).length })),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Usuarios</h2>
          <p className="section-subtitle">{usersArr.length} usuarios registrados</p>
        </div>
        {isAdmin && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={14} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="input-base pl-8 w-56 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-surface-hover border border-surface-border rounded-lg p-1">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeGroup === key ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {label} <span className="text-ink-muted ml-1">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(n => <div key={n} className="h-10 bg-surface-hover rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-ink-muted">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : filtered.map((u: any) => (
                <tr key={u.id}>
                  {/* Avatar + Nombre */}
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                        {u.avatar_url
                          ? <img src={userService.getAvatarUrl(u.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                          : <span className="text-[9px] font-semibold text-primary-400">{u.nombre?.slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <button
                        onClick={() => canViewProfiles && setProfileUserId(u.id)}
                        className={`text-sm font-medium text-ink-primary ${canViewProfiles ? 'hover:text-primary-400 cursor-pointer transition-colors' : ''}`}
                      >
                        {u.nombre}
                      </button>
                    </div>
                  </td>

                  {/* Correo */}
                  <td><span className="text-xs text-ink-muted">{u.correo}</span></td>

                  {/* Rol */}
                  <td>
                    {isAdmin ? (
                      <div className="relative inline-block">
                        <select
                          value={u.rol}
                          onChange={e => roleMutation.mutate({ id: u.id, rol: e.target.value })}
                          className={`${ROL_BADGE[u.rol]} pr-6 cursor-pointer outline-none appearance-none`}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <span className={ROL_BADGE[u.rol]}>{ROL_LABEL[u.rol]}</span>
                    )}
                  </td>

                  {/* Estado */}
                  <td>
                    <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ver perfil */}
                      {canViewProfiles && (
                        <button
                          onClick={() => setProfileUserId(u.id)}
                          className="btn-ghost text-xs flex items-center gap-1 hover:text-primary-500"
                          title="Ver perfil completo"
                        >
                          <Eye size={13} /> Perfil
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => toggleMutation.mutate(u.id)}
                            className={`btn-ghost text-xs flex items-center gap-1 ${u.activo ? 'hover:text-danger' : 'hover:text-success'}`}
                          >
                            {u.activo ? <XCircle size={13} /> : <CheckCircle size={13} />}
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => { if (confirm(`¿Eliminar a ${u.nombre}?`)) deleteMutation.mutate(u.id); }}
                            className="btn-ghost text-xs hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo usuario */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo usuario">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            { name: 'nombre',     label: 'Nombre completo', type: 'text',     ph: 'Juan García' },
            { name: 'correo',     label: 'Correo',          type: 'email',    ph: 'juan@sena.edu.co' },
            { name: 'contrasena', label: 'Contraseña',      type: 'password', ph: 'Mínimo 6 caracteres' },
          ].map(f => (
            <div key={f.name} className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary">{f.label}</label>
              <input {...register(f.name, { required: true })} type={f.type} placeholder={f.ph} className="input-base" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Rol</label>
            <select {...register('rol', { required: true })} className="input-base">
              {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
            ) : 'Crear usuario'}
          </button>
        </form>
      </Modal>

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
