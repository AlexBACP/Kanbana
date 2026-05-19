/**
 * UsersPanel — Usuarios organizados por fichas.
 * Roles disponibles: coordinador, instructor, aprendiz.
 * El sub-rol de Líder Técnico se gestiona con es_lider_tecnico sobre aprendices.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  Users, UserPlus, Search, Trash2, ChevronDown,
  Eye, Shield, GraduationCap, BookOpen,
  Filter, X, UserCheck, UserX, Crown,
  AlertTriangle, Hash, FolderOpen, ChevronRight,
} from 'lucide-react';
import { userService } from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { Modal } from '../../components/Modal';
import { UserProfileModal } from '../../components/UserProfileModal';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../store/auth.store';
import { AnimatePresence, motion } from 'framer-motion';

const ROL_CONFIG: Record<string, {
  label: string; badge: string; icon: any;
  color: string; bg: string; border: string;
}> = {
  coordinador: { label: 'Coordinador', badge: 'badge badge-info',                                                icon: Shield,        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  instructor:  { label: 'Instructor',  badge: 'badge bg-surface-hover text-ink-secondary border-surface-border', icon: GraduationCap, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  aprendiz:    { label: 'Aprendiz',    badge: 'badge badge-warning',                                             icon: BookOpen,      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
};

// Roles que se pueden asignar desde el formulario de creación
const ROLES = ['coordinador', 'instructor', 'aprendiz'] as const;

const RoleChangeConfirmModal = ({
  isOpen, onClose, onConfirm, targetName, isPending,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  targetName: string; isPending: boolean;
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Confirmar cambio de rol">
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-ink-primary">
            Estás a punto de asignar el rol de <span className="font-bold text-primary-400">Coordinador</span> a{' '}
            <span className="font-bold">"{targetName}"</span>.
          </p>
          <p className="text-xs text-ink-muted mt-1.5">
            Un coordinador tiene acceso completo al sistema. Asegúrate de que esta persona debe tener este nivel de acceso.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-ghost text-sm px-4 py-2" disabled={isPending}>Cancelar</button>
        <button onClick={onConfirm} disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:opacity-60 flex items-center gap-2 transition-colors"
        >
          {isPending
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Cambiando...</>
            : <><Shield size={13} /> Confirmar</>
          }
        </button>
      </div>
    </div>
  </Modal>
);

const UserRow = ({ u, isAdmin, canViewProfiles, onViewProfile, onRoleChange, toggleMutation, deleteMutation, liderMutation }: any) => {
  const cfg = ROL_CONFIG[u.rol] ?? ROL_CONFIG.aprendiz;
  const isAprendiz = u.rol === 'aprendiz';
  return (
    <tr className="group">
      <td>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center overflow-hidden shrink-0 ${cfg.bg} ${cfg.border}`}>
            {u.avatar_url
              ? <img src={userService.getAvatarUrl(u.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
              : <span className={`text-[9px] font-bold ${cfg.color}`}>{u.nombre?.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div className="min-w-0">
            <button
              onClick={() => canViewProfiles && onViewProfile(u.id)}
              className={`text-sm font-medium text-ink-primary leading-tight block truncate max-w-[160px] ${canViewProfiles ? 'hover:text-primary-400 cursor-pointer transition-colors' : ''}`}
              title={u.nombre}
            >{u.nombre}</button>
            <p className="text-[10px] text-ink-muted truncate max-w-[160px]">{u.correo}</p>
          </div>
        </div>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          {isAdmin ? (
            <div className="relative inline-block">
              <select
                value={u.rol}
                onChange={e => onRoleChange(u.id, u.nombre, e.target.value)}
                className={`${cfg.badge} pr-5 cursor-pointer outline-none appearance-none text-xs`}
              >
                {ROLES.map(r => <option key={r} value={r}>{ROL_CONFIG[r].label}</option>)}
              </select>
              <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
            </div>
          ) : (
            <span className={`${cfg.badge} text-xs`}>{cfg.label}</span>
          )}
          {/* Sub-rol de líder técnico — solo visible en aprendices */}
          {isAprendiz && (
            <div
              onClick={() => isAdmin && liderMutation.mutate(u.id)}
              title={isAdmin ? (u.es_lider_tecnico ? 'Quitar sub-rol Líder Técnico' : 'Asignar sub-rol Líder Técnico') : undefined}
              className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all w-fit ${
                u.es_lider_tecnico
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20'
                  : isAdmin
                    ? 'bg-surface-hover text-ink-muted border-surface-border cursor-pointer hover:border-emerald-500/30 hover:text-emerald-400'
                    : 'bg-surface-hover text-ink-muted border-surface-border'
              }`}
            >
              <Crown size={8} />
              {u.es_lider_tecnico ? 'Líder técnico' : 'Sin sub-rol'}
            </div>
          )}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-success' : 'bg-danger'}`} />
          <span className={`text-xs ${u.activo ? 'text-success' : 'text-danger'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canViewProfiles && (
            <button onClick={() => onViewProfile(u.id)} className="btn-ghost text-xs flex items-center gap-1 hover:text-primary-500">
              <Eye size={12} /> Ver
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => toggleMutation.mutate(u.id)}
                className={`btn-ghost text-xs flex items-center gap-1 ${u.activo ? 'hover:text-danger' : 'hover:text-success'}`}
              >
                {u.activo ? <UserX size={12} /> : <UserCheck size={12} />}
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button
                onClick={() => { if (confirm(`¿Eliminar a ${u.nombre}?`)) deleteMutation.mutate(u.id); }}
                className="btn-ghost text-xs hover:text-danger"
              ><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

const UsersTable = ({ users, isAdmin, canViewProfiles, onViewProfile, onRoleChange, toggleMutation, deleteMutation, liderMutation }: any) => {
  if (users.length === 0) {
    return (
      <div className="py-8 text-center">
        <Users size={22} className="mx-auto text-ink-muted mb-2 opacity-30" />
        <p className="text-xs text-ink-muted">Sin usuarios en esta categoría</p>
      </div>
    );
  }
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Rol</th>
          <th>Estado</th>
          <th className="text-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u: any) => (
          <UserRow key={u.id} u={u} isAdmin={isAdmin} canViewProfiles={canViewProfiles}
            onViewProfile={onViewProfile} onRoleChange={onRoleChange}
            toggleMutation={toggleMutation} deleteMutation={deleteMutation} liderMutation={liderMutation}
          />
        ))}
      </tbody>
    </table>
  );
};

const FichaBlock = ({ ficha, users, isAdmin, canViewProfiles, search, onViewProfile, onRoleChange, toggleMutation, deleteMutation, liderMutation }: any) => {
  const [open, setOpen] = useState(true);
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return users;
    return users.filter((u: any) => u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term));
  }, [users, search]);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
            <Hash size={14} className="text-primary-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-ink-primary">Ficha {ficha.codigo}</p>
            <p className="text-[10px] text-ink-muted">{ficha.programa}</p>
          </div>
          {ficha.instructor && (
            <span className="ml-2 text-[10px] text-ink-muted border border-surface-border rounded px-1.5 py-0.5">
              {ficha.instructor.nombre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
          <ChevronRight size={14} className={`text-ink-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-surface-border"
          >
            <UsersTable users={filtered} isAdmin={isAdmin} canViewProfiles={canViewProfiles}
              onViewProfile={onViewProfile} onRoleChange={onRoleChange}
              toggleMutation={toggleMutation} deleteMutation={deleteMutation} liderMutation={liderMutation}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const UsersPanel = () => {
  const { user: me } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'fichas' | 'roles'>('fichas');
  const [activeRolTab, setActiveRolTab] = useState<'all' | typeof ROLES[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [roleConfirm, setRoleConfirm] = useState<{ userId: number; nombre: string; newRole: string } | null>(null);
  const qc = useQueryClient();

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
    staleTime: 60_000,
  });
  const { data: fichas = [], isLoading: loadingFichas } = useQuery({
    queryKey: ['fichas'],
    queryFn: () => fichaService.getAll(),
    staleTime: 60_000,
  });

  const usersArr = users as any[];
  const fichasArr = fichas as any[];

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setRoleConfirm(null); },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => userService.toggleStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const liderMutation = useMutation({
    mutationFn: (id: number) => userService.toggleLiderTecnico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { register, handleSubmit, reset, watch } = useForm<any>({ defaultValues: { rol: 'aprendiz' } });
  const watchedRol = watch('rol');

  const onSubmit = (data: any) => {
    const dto: any = { ...data };
    if (!dto.fichaId || dto.fichaId === '') delete dto.fichaId;
    else dto.fichaId = Number(dto.fichaId);
    createMutation.mutate(dto);
  };

  const handleRoleChange = (userId: number, nombre: string, newRole: string) => {
    if (newRole === 'coordinador') setRoleConfirm({ userId, nombre, newRole });
    else roleMutation.mutate({ id: userId, rol: newRole });
  };

  const isAdmin = me?.rol === 'coordinador';
  const canViewProfiles = me?.rol === 'coordinador' || me?.rol === 'instructor';

  const applyFilters = (list: any[]) => list.filter(u =>
    (activeRolTab === 'all' || u.rol === activeRolTab) &&
    (statusFilter === 'all' || (statusFilter === 'activo' ? u.activo : !u.activo))
  );

  const fichaGroups = useMemo(() => {
    const filtered = applyFilters(usersArr);
    const byFicha = fichasArr.map(f => ({
      ficha: f,
      users: filtered.filter(u => u.ficha?.id === f.id || u.fichaId === f.id),
    })).filter(g => g.users.length > 0);
    const sinFicha = filtered.filter(u => !u.ficha && !u.fichaId);
    return { byFicha, sinFicha };
  }, [usersArr, fichasArr, activeRolTab, statusFilter]);

  const filteredByRole = useMemo(() => {
    const term = search.toLowerCase().trim();
    return applyFilters(usersArr).filter(u =>
      !term || u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term)
    );
  }, [usersArr, search, activeRolTab, statusFilter]);

  const countByRol = useMemo(() => {
    const c: Record<string, number> = {};
    ROLES.forEach(r => { c[r] = usersArr.filter(u => u.rol === r).length; });
    return c;
  }, [usersArr]);

  const isLoading = loadingUsers || loadingFichas;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Usuarios</h2>
          <p className="section-subtitle">
            {usersArr.length} registrados · {usersArr.filter(u => u.activo).length} activos · {fichasArr.length} fichas
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={14} /> Nuevo usuario
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface-hover border border-surface-border rounded-lg p-1 shrink-0">
          <button onClick={() => setViewMode('fichas')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'fichas' ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>
            <FolderOpen size={11} /> Por fichas
          </button>
          <button onClick={() => setViewMode('roles')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'roles' ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>
            <Users size={11} /> Por roles
          </button>
        </div>

        <div className="flex gap-1 bg-surface-hover border border-surface-border rounded-lg p-1 flex-wrap">
          <button onClick={() => setActiveRolTab('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeRolTab === 'all' ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>
            Todos
          </button>
          {ROLES.map(r => (
            <button key={r} onClick={() => setActiveRolTab(activeRolTab === r ? 'all' : r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeRolTab === r ? `${ROL_CONFIG[r].bg} ${ROL_CONFIG[r].color}` : 'text-ink-muted hover:text-ink-secondary'}`}>
              {ROL_CONFIG[r].label} <span className="opacity-50">({countByRol[r] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..." className="input-base pl-8 w-full text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-surface-hover border border-surface-border rounded-lg p-1">
          {(['all', 'activo', 'inactivo'] as const).map(k => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === k ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>
              {k === 'all' ? 'Todos' : k === 'activo' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
        {(search || activeRolTab !== 'all' || statusFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setActiveRolTab('all'); setStatusFilter('all'); }}
            className="btn-ghost text-xs flex items-center gap-1 text-ink-muted">
            <Filter size={12} /> Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-16 bg-surface-hover rounded-xl animate-pulse" />)}</div>
      ) : viewMode === 'fichas' ? (
        <div className="space-y-3">
          {fichaGroups.byFicha.length === 0 && fichaGroups.sinFicha.length === 0 && (
            <div className="card p-10 text-center">
              <Users size={28} className="mx-auto text-ink-muted mb-3 opacity-30" />
              <p className="text-sm text-ink-muted">No hay usuarios que coincidan con los filtros</p>
            </div>
          )}
          {fichaGroups.byFicha.map(({ ficha, users: fUsers }) => (
            <FichaBlock key={ficha.id} ficha={ficha} users={fUsers}
              isAdmin={isAdmin} canViewProfiles={canViewProfiles} search={search}
              onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
              toggleMutation={toggleMutation} deleteMutation={deleteMutation} liderMutation={liderMutation}
            />
          ))}
          {fichaGroups.sinFicha.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 border-b border-surface-border bg-surface-hover/30">
                <div className="w-8 h-8 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center">
                  <Users size={14} className="text-ink-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-secondary">Sin ficha asignada</p>
                  <p className="text-[10px] text-ink-muted">{fichaGroups.sinFicha.length} usuario{fichaGroups.sinFicha.length !== 1 ? 's' : ''} pendientes</p>
                </div>
              </div>
              <UsersTable
                users={fichaGroups.sinFicha.filter((u: any) => {
                  const term = search.toLowerCase().trim();
                  return !term || u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term);
                })}
                isAdmin={isAdmin} canViewProfiles={canViewProfiles}
                onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
                toggleMutation={toggleMutation} deleteMutation={deleteMutation} liderMutation={liderMutation}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <UsersTable users={filteredByRole} isAdmin={isAdmin} canViewProfiles={canViewProfiles}
            onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
            toggleMutation={toggleMutation} deleteMutation={deleteMutation} liderMutation={liderMutation}
          />
          {filteredByRole.length > 0 && (
            <div className="px-4 py-2.5 border-t border-surface-border bg-surface-hover/40">
              <p className="text-xs text-ink-muted">
                Mostrando <span className="font-medium text-ink-secondary">{filteredByRole.length}</span> de{' '}
                <span className="font-medium text-ink-secondary">{usersArr.length}</span> usuarios
              </p>
            </div>
          )}
        </div>
      )}

      <RoleChangeConfirmModal
        isOpen={roleConfirm !== null} onClose={() => setRoleConfirm(null)}
        onConfirm={() => roleConfirm && roleMutation.mutate({ id: roleConfirm.userId, rol: roleConfirm.newRole })}
        targetName={roleConfirm?.nombre ?? ''} isPending={roleMutation.isPending}
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); reset(); }} title="Nuevo usuario">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Nombre completo</label>
            <input {...register('nombre', { required: true })} type="text" placeholder="Juan García" className="input-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Correo electrónico</label>
            <input {...register('correo', { required: true })} type="email" placeholder="juan@sena.edu.co" className="input-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Contraseña</label>
            <input {...register('contrasena', { required: true })} type="password" placeholder="Mínimo 6 caracteres" className="input-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Rol</label>
            <select {...register('rol', { required: true })} className="input-base">
              {ROLES.map(r => <option key={r} value={r}>{ROL_CONFIG[r].label}</option>)}
            </select>
          </div>
          {watchedRol === 'aprendiz' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary">
                Ficha de formación <span className="text-ink-muted font-normal">(opcional)</span>
              </label>
              <select {...register('fichaId')} className="input-base">
                <option value="">— Sin ficha asignada —</option>
                {fichasArr.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.codigo} · {f.programa}</option>
                ))}
              </select>
              <p className="text-[10px] text-ink-muted">Puedes asignarla ahora o más tarde desde el panel de Fichas.</p>
            </div>
          )}
          {createMutation.isError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <p className="text-xs text-danger">{(createMutation.error as any)?.response?.data?.message || 'Error al crear usuario'}</p>
            </div>
          )}
          <button type="submit" disabled={createMutation.isPending}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {createMutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
              : 'Crear usuario'}
          </button>
        </form>
      </Modal>

      <AnimatePresence>
        {profileUserId !== null && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
