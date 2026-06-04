/**
 * UsersPanel — Usuarios organizados por fichas.
 * Diseño alineado con ProjectsPanel / FichasPanel (zinc global).
 *
 * Header: [Todos los usuarios] [Nuevo usuario]  ← tabs inline, sin modal
 *
 * "Todos":
 *   · Barra de búsqueda grande (igual que ProjectsPanel)
 *   · Filtros por rol, estado y vista (fichas / roles)
 *   · Grupos colapsables por ficha
 *
 * "Nuevo usuario":
 *   · Formulario inline — dos modos:
 *     - Invitación por correo  (nombre + correo + cédula → email de activación)
 *     - Manual con contraseña  (nombre + correo + contraseña)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  Users, UserPlus, Search, Trash2, ChevronDown,
  Eye, Shield, GraduationCap, BookOpen,
  X, UserCheck, UserX, Crown,
  AlertTriangle, Hash, FolderOpen, ChevronRight,
  Plus, Mail, Lock, Send, CheckCircle2, Check,
} from 'lucide-react';
import { userService }  from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { UserProfileModal } from '../../components/UserProfileModal';
import { Modal } from '../../components/Modal';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../store/auth.store';
import { AnimatePresence, motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const ROL_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: any;
}> = {
  coordinador: { label: 'Coordinador', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Shield        },
  instructor:  { label: 'Instructor',  color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: GraduationCap },
  aprendiz:    { label: 'Aprendiz',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: BookOpen      },
};

const ROLES = ['coordinador', 'instructor', 'aprendiz'] as const;

const INP = 'w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-200 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600';

// ═══════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ═══════════════════════════════════════════════════════════════════════════════

const RoleBadge = ({ rol }: { rol: string }) => {
  const cfg = ROL_CONFIG[rol] ?? ROL_CONFIG.aprendiz;
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
};

// ── Confirmación de promoción a Coordinador ───────────────────────────────────
const RoleChangeConfirmModal = ({
  isOpen, onClose, onConfirm, targetName, isPending,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  targetName: string; isPending: boolean;
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Confirmar cambio de rol">
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            Estás a punto de asignar el rol de{' '}
            <span className="font-black text-blue-400">Coordinador</span> a{' '}
            <span className="font-bold text-white">"{targetName}"</span>.
          </p>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            Un coordinador tiene acceso total al sistema. Confirma que esta persona debe tener este nivel de acceso.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} disabled={isPending}
          className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={isPending}
          className="px-4 py-2 text-[13px] font-black bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-all flex items-center gap-2 active:scale-95">
          {isPending
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Cambiando...</>
            : <><Shield size={13} /> Confirmar</>}
        </button>
      </div>
    </div>
  </Modal>
);

// ── Fila de usuario ───────────────────────────────────────────────────────────
const UserRow = ({
  u, isAdmin, canConfirm, canViewProfiles, onViewProfile, onRoleChange,
  toggleMutation, deleteMutation, liderMutation, confirmMutation,
  selected, onSelect, isMe,
}: any) => {
  const cfg = ROL_CONFIG[u.rol] ?? ROL_CONFIG.aprendiz;
  const isAprendiz = u.rol === 'aprendiz';

  return (
    <tr className={`group hover:bg-zinc-800/30 transition-colors border-b border-zinc-600/40 last:border-0 ${selected ? 'bg-blue-500/5' : ''}`}>
      {/* Checkbox */}
      <td className="pl-4 pr-1 py-3.5 w-10">
        {!isMe ? (
          <button
            onClick={onSelect}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
              selected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-zinc-600 bg-zinc-800/80 text-transparent hover:border-blue-500'
            }`}
          >
            <Check size={11} />
          </button>
        ) : (
          <div className="w-5 h-5" />
        )}
      </td>
      {/* Usuario */}
      <td className="px-6 py-3.5">
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
              className={`text-sm font-medium text-zinc-100 leading-tight block truncate max-w-[160px] ${canViewProfiles ? 'hover:text-blue-400 cursor-pointer transition-colors' : ''}`}
              title={u.nombre}
            >{u.nombre}</button>
            <p className="text-[10px] text-zinc-500 truncate max-w-[160px]">{u.correo}</p>
          </div>
          {/* Badge pendiente de confirmación */}
          {u.cuenta_confirmada === false && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 uppercase tracking-widest shrink-0 flex items-center gap-1">
              <Mail size={8} /> Pendiente
            </span>
          )}
        </div>
      </td>

      {/* Rol */}
      <td className="px-6 py-3.5">
        <div className="flex flex-col gap-1.5">
          {isAdmin ? (
            <div className="relative inline-block">
              <select
                value={u.rol}
                onChange={e => onRoleChange(u.id, u.nombre, e.target.value)}
                className={`cursor-pointer outline-none appearance-none rounded-md px-2.5 pr-6 py-1 text-[10px] uppercase font-black tracking-wider border transition-all ${cfg.bg} ${cfg.color} ${cfg.border}`}
              >
                {ROLES.map(r => <option key={r} value={r} className="bg-zinc-900 text-zinc-200">{ROL_CONFIG[r].label}</option>)}
              </select>
              <ChevronDown size={9} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${cfg.color} opacity-70`} />
            </div>
          ) : (
            <RoleBadge rol={u.rol} />
          )}
          {/* Sub-rol líder técnico (aprendices) */}
          {isAprendiz && (
            <div
              onClick={() => isAdmin && liderMutation.mutate(u.id)}
              className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all w-fit ${
                u.es_lider_tecnico
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20'
                  : isAdmin
                    ? 'bg-zinc-800 text-zinc-500 border-zinc-600 cursor-pointer hover:border-emerald-500/30 hover:text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-600'
              }`}
            >
              <Crown size={8} />
              {u.es_lider_tecnico ? 'Líder técnico' : 'Sin sub-rol'}
            </div>
          )}
        </div>
      </td>

      {/* Estado */}
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className={`text-xs font-medium ${u.activo ? 'text-emerald-400' : 'text-rose-400'}`}>
            {u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </td>

      {/* Acciones */}
      <td className="px-6 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canViewProfiles && (
            <button onClick={() => onViewProfile(u.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-zinc-600">
              <Eye size={12} /> Ver
            </button>
          )}
          {/* Confirmar cuenta — coordinador puede hacerlo con cualquiera; instructor solo con los de su ficha */}
          {canConfirm && u.cuenta_confirmada === false && (
            <button
              onClick={() => {
                if (confirm(`¿Confirmar manualmente la cuenta de ${u.nombre}?\nEsto le permitirá iniciar sesión sin pasar por el correo de activación.`)) {
                  confirmMutation.mutate(u.id);
                }
              }}
              disabled={confirmMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-all border border-amber-500/20 text-amber-400 hover:text-white hover:bg-amber-500/10 hover:border-amber-500/40 disabled:opacity-50"
              title="Confirmar cuenta manualmente (sin correo)"
            >
              <UserCheck size={12} /> Confirmar
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => toggleMutation.mutate(u.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-all border border-transparent hover:border-zinc-600 ${
                  u.activo
                    ? 'text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5'
                    : 'text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/5'
                }`}
              >
                {u.activo ? <><UserX size={12} /> Desactivar</> : <><UserCheck size={12} /> Activar</>}
              </button>
              <button
                onClick={() => { if (confirm(`¿Eliminar a ${u.nombre}?`)) deleteMutation.mutate(u.id); }}
                title={`Eliminar a ${u.nombre}`}
                aria-label={`Eliminar a ${u.nombre}`}
                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-md transition-all"
              ><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Tabla de usuarios ─────────────────────────────────────────────────────────
const UsersTable = ({
  users, isAdmin, canConfirm, canViewProfiles, onViewProfile, onRoleChange,
  toggleMutation, deleteMutation, liderMutation, confirmMutation,
  selectedIds, onSelect, onSelectGroup, onDeselectGroup, meId,
}: any) => {
  if (users.length === 0) {
    return (
      <div className="py-10 text-center">
        <Users size={22} className="mx-auto text-zinc-600 mb-2 opacity-40" />
        <p className="text-xs text-zinc-500">Sin usuarios en esta categoría</p>
      </div>
    );
  }
  const selectableIds: number[] = users.filter((u: any) => u.id !== meId).map((u: any) => u.id);
  const allSelected  = selectableIds.length > 0 && selectableIds.every((id: number) => selectedIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id: number) => selectedIds.has(id));

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-zinc-600 bg-zinc-950/40">
          {/* Checkbox select-all */}
          <th className="pl-4 pr-1 py-3 w-10">
            {selectableIds.length > 0 && (
              <button
                onClick={() => allSelected ? onDeselectGroup(selectableIds) : onSelectGroup(selectableIds)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  allSelected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : someSelected
                      ? 'bg-blue-600/40 border-blue-500/60 text-blue-300'
                      : 'border-zinc-600 bg-zinc-800/80 text-transparent hover:border-blue-500'
                }`}
              >
                {allSelected
                  ? <Check size={11} />
                  : someSelected
                    ? <span className="w-2 h-0.5 bg-current rounded-full block" />
                    : null}
              </button>
            )}
          </th>
          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Usuario</th>
          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Rol</th>
          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Estado</th>
          <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/40 font-medium text-[12px]">
        {users.map((u: any) => (
          <UserRow key={u.id} u={u} isAdmin={isAdmin} canConfirm={canConfirm} canViewProfiles={canViewProfiles}
            onViewProfile={onViewProfile} onRoleChange={onRoleChange}
            toggleMutation={toggleMutation} deleteMutation={deleteMutation}
            liderMutation={liderMutation} confirmMutation={confirmMutation}
            selected={selectedIds.has(u.id)}
            onSelect={() => onSelect(u.id)}
            isMe={u.id === meId}
          />
        ))}
      </tbody>
    </table>
  );
};

// ── Bloque colapsable por ficha ───────────────────────────────────────────────
const FichaBlock = ({
  ficha, users, isAdmin, canConfirm, canViewProfiles, search,
  onViewProfile, onRoleChange, toggleMutation, deleteMutation, liderMutation, confirmMutation,
  selectedIds, onSelect, onSelectGroup, onDeselectGroup, meId,
}: any) => {
  const [open, setOpen] = useState(true);
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return users;
    return users.filter((u: any) =>
      u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term)
    );
  }, [users, search]);

  return (
    <div className="bg-zinc-900/95 border border-zinc-600/80 rounded-md overflow-hidden shadow-lg mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors text-left bg-zinc-950/20 border-b border-zinc-600/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Hash size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">Ficha {ficha.codigo}</p>
            <p className="text-[11px] text-zinc-400 font-medium">{ficha.programa}</p>
          </div>
          {ficha.instructor && (
            <div className="ml-3 flex flex-col leading-tight bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
              <span className="text-[10px] font-black text-cyan-400">{ficha.instructor.nombre}</span>
              <span className="text-[9px] text-zinc-500">{ficha.instructor.correo}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-zinc-500">
            {users.length} usuario{users.length !== 1 ? 's' : ''}
          </span>
          <ChevronRight size={14} className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden bg-zinc-900/40"
          >
            <div className="overflow-x-auto">
              <UsersTable users={filtered} isAdmin={isAdmin} canConfirm={canConfirm} canViewProfiles={canViewProfiles}
                onViewProfile={onViewProfile} onRoleChange={onRoleChange}
                toggleMutation={toggleMutation} deleteMutation={deleteMutation}
                liderMutation={liderMutation} confirmMutation={confirmMutation}
                selectedIds={selectedIds} onSelect={onSelect}
                onSelectGroup={onSelectGroup} onDeselectGroup={onDeselectGroup} meId={meId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Formulario inline de creación ─────────────────────────────────────────────
const CreateUserForm = ({
  fichas, createMutation, inviteMutation, onCancel,
}: {
  fichas: any[];
  createMutation: any;
  inviteMutation: any;
  onCancel: () => void;
}) => {
  const [mode, setMode] = useState<'invitacion' | 'manual'>('invitacion');
  const { register, handleSubmit, reset, watch } = useForm<any>({
    defaultValues: { rol: 'aprendiz', nombre: '', correo: '', contrasena: '', cedula_documento: '', fichaId: '' },
  });
  const watchedRol = watch('rol');
  const isPending = createMutation.isPending || inviteMutation.isPending;
  const error = createMutation.error || inviteMutation.error;

  const onSubmit = (data: any) => {
    const dto: any = { ...data };
    if (!dto.fichaId || dto.fichaId === '') delete dto.fichaId;
    else dto.fichaId = Number(dto.fichaId);

    if (mode === 'invitacion') {
      delete dto.contrasena;
      inviteMutation.mutate({ ...dto, enviar_invitacion: true });
    } else {
      delete dto.cedula_documento;
      createMutation.mutate(dto);
    }
  };

  return (
    <div className="px-6 py-6 bg-zinc-900 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
      {/* Título */}
      <div className="border-b border-zinc-600/80 pb-3">
        <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <UserPlus className="text-blue-400" size={18} />
          Registrar nuevo usuario
        </h2>
        <p className="text-[13px] text-zinc-400 mt-0.5">
          Crea una cuenta manual o envía una invitación de activación por correo.
        </p>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2 bg-zinc-950 border border-zinc-700 rounded-md p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('invitacion')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-[13px] font-bold transition-all ${
            mode === 'invitacion' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Send size={13} /> Invitación por correo
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-[13px] font-bold transition-all ${
            mode === 'manual' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Lock size={13} /> Manual (contraseña)
        </button>
      </div>

      {/* Info box */}
      {mode === 'invitacion' ? (
        <div className="flex items-start gap-3 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-md max-w-3xl">
          <Mail size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-blue-300">Invitación por correo electrónico</p>
            <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">
              El usuario recibirá un correo con un enlace de activación. Su número de documento se usará como contraseña temporal hasta que la actualice desde su perfil.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3.5 bg-zinc-800/50 border border-zinc-700 rounded-md max-w-3xl">
          <Lock size={16} className="text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            La cuenta se crea directamente con la contraseña que indiques. El usuario puede acceder de inmediato.
          </p>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-3xl bg-zinc-900 p-6 rounded-md border border-zinc-700/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Nombre completo</label>
            <input {...register('nombre', { required: true })} type="text" placeholder="Juan García" className={INP} />
          </div>
          {/* Correo */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Correo electrónico</label>
            <input {...register('correo', { required: true })} type="email" placeholder="juan@sena.edu.co" className={INP} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Rol */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Rol</label>
            <select {...register('rol', { required: true })} className={INP + ' cursor-pointer'}>
              {ROLES.map(r => (
                <option key={r} value={r} className="bg-zinc-900">{ROL_CONFIG[r].label}</option>
              ))}
            </select>
          </div>
          {/* Ficha (solo aprendiz) */}
          {watchedRol === 'aprendiz' && (
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">
                Ficha de formación{' '}
                <span className="text-zinc-600 font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <select {...register('fichaId')} className={INP + ' cursor-pointer'}>
                <option value="" className="bg-zinc-900">— Sin ficha asignada —</option>
                {fichas.map((f: any) => (
                  <option key={f.id} value={f.id} className="bg-zinc-900">
                    {f.codigo} · {f.programa}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Campo diferencial según modo */}
        {mode === 'invitacion' ? (
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">
              Número de documento (CC / TI)
            </label>
            <input
              {...register('cedula_documento', { required: mode === 'invitacion' })}
              type="text"
              placeholder="1234567890"
              className={INP}
            />
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Se usará como contraseña temporal. El usuario podrá cambiarla desde su perfil.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Contraseña</label>
            <input
              {...register('contrasena', { required: mode === 'manual' })}
              type="password"
              placeholder="Mínimo 6 caracteres"
              className={INP}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md">
            <p className="text-xs text-rose-400">
              {(error as any)?.response?.data?.message || 'Error al crear usuario'}
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-600/60">
          <button type="button" onClick={() => { onCancel(); reset(); }}
            className="px-4 py-2 text-[14px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className={`px-5 py-2 text-[14px] font-black rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2 ${
              mode === 'invitacion'
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white'
            }`}
          >
            {isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
              : mode === 'invitacion'
                ? <><Send size={14} /> Enviar invitación</>
                : <><CheckCircle2 size={14} /> Crear usuario</>
            }
          </button>
        </div>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Panel principal
// ═══════════════════════════════════════════════════════════════════════════════

export const UsersPanel = () => {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();

  const [tab,            setTab]            = useState<'todos' | 'nuevo'>('todos');
  const [profileUserId,  setProfileUserId]  = useState<number | null>(null);
  const [search,         setSearch]         = useState('');
  const [viewMode,       setViewMode]       = useState<'fichas' | 'roles'>('fichas');
  const [activeRolTab,   setActiveRolTab]   = useState<'all' | typeof ROLES[number]>('all');
  const [statusFilter,   setStatusFilter]   = useState<'all' | 'activo' | 'inactivo'>('all');
  const [roleConfirm,    setRoleConfirm]    = useState<{ userId: number; nombre: string; newRole: string } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const { data: users = [],  isLoading: loadingUsers  } = useQuery({
    queryKey: ['users'],
    queryFn:  () => userService.getAll(),
    staleTime: 60_000,
  });
  const { data: fichas = [], isLoading: loadingFichas } = useQuery({
    queryKey: ['fichas'],
    queryFn:  () => fichaService.getAll(),
    staleTime: 60_000,
  });

  const usersArr  = users  as any[];
  const fichasArr = fichas as any[];

  // Mutaciones ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (dto: any) => userService.create(dto),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setTab('todos'); },
  });
  const inviteMutation = useMutation({
    mutationFn: (dto: any) => userService.create({ ...dto, enviar_invitacion: true }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setTab('todos'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, rol }: any) => userService.updateRole(id, rol),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setRoleConfirm(null); },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => userService.toggleStatus(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const liderMutation = useMutation({
    mutationFn: (id: number) => userService.toggleLiderTecnico(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const confirmMutation = useMutation({
    mutationFn: (id: number) => userService.confirmAccountManual(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  // ─── Mutaciones masivas ──────────────────────────────────────────────────────
  const bulkConfirmMutation = useMutation({
    mutationFn: (ids: number[]) => userService.confirmBulk(ids),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setSelectedUserIds(new Set()); },
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => userService.delete(id))); },
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setSelectedUserIds(new Set()); },
  });
  const bulkToggleMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => userService.toggleStatus(id))); },
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setSelectedUserIds(new Set()); },
  });

  // Helpers ────────────────────────────────────────────────────────────────────
  const handleRoleChange = (userId: number, nombre: string, newRole: string) => {
    if (newRole === 'coordinador') setRoleConfirm({ userId, nombre, newRole });
    else roleMutation.mutate({ id: userId, rol: newRole });
  };

  // Selección masiva ────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) =>
    setSelectedUserIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectGroup = (ids: number[]) =>
    setSelectedUserIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
  const deselectGroup = (ids: number[]) =>
    setSelectedUserIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
  const clearSelection = () => setSelectedUserIds(new Set());

  // ── Permisos derivados del usuario actual ────────────────────────────────
  // IMPORTANTE: estos derivados se calculan ANTES de `selectedUsers` porque
  // `visibleUsers` depende de `isInstructor` y `selectedUsers` depende de
  // `visibleUsers`. Si se invierte el orden, se produce un ReferenceError
  // por temporal dead zone (acceder a una `const` antes de su declaración).
  const isAdmin         = me?.rol === 'coordinador';
  const isInstructor    = me?.rol === 'instructor';
  const canConfirm      = isAdmin || isInstructor;
  const canViewProfiles = isAdmin || isInstructor;

  // Instructores solo ven usuarios de sus propias fichas
  const instructorFichaIds = useMemo(
    () => isInstructor ? new Set(fichasArr.map((f: any) => f.id)) : null,
    [isInstructor, fichasArr],
  );
  const visibleUsers = useMemo(
    () => isInstructor && instructorFichaIds
      ? usersArr.filter((u: any) => instructorFichaIds.has(u.ficha?.id ?? u.fichaId))
      : usersArr,
    [isInstructor, instructorFichaIds, usersArr],
  );

  const selectedUsers = useMemo(() => visibleUsers.filter((u: any) => selectedUserIds.has(u.id)), [visibleUsers, selectedUserIds]);
  const hasPending    = selectedUsers.some(u => u.cuenta_confirmada === false);
  const hasInactive   = selectedUsers.some(u => !u.activo);
  const hasActive     = selectedUsers.some(u => u.activo);
  const bulkPending   = bulkConfirmMutation.isPending || bulkDeleteMutation.isPending || bulkToggleMutation.isPending;

  const applyFilters = (list: any[]) => list.filter(u =>
    (activeRolTab === 'all' || u.rol === activeRolTab) &&
    (statusFilter === 'all' || (statusFilter === 'activo' ? u.activo : !u.activo))
  );

  const fichaGroups = useMemo(() => {
    const filtered = applyFilters(visibleUsers);
    const byFicha  = fichasArr.map((f: any) => ({
      ficha: f,
      users: filtered.filter((u: any) => u.ficha?.id === f.id || u.fichaId === f.id),
    })).filter((g: any) => g.users.length > 0);
    // "Sin ficha" no se muestra: coordinadores e instructores no tienen ficha
    // y los aprendices sin ficha están en proceso de vinculación (ya lo gestionan desde Fichas).
    const sinFicha: any[] = [];
    return { byFicha, sinFicha };
  }, [visibleUsers, fichasArr, activeRolTab, statusFilter, isInstructor]);

  const filteredByRole = useMemo(() => {
    const term = search.toLowerCase().trim();
    return applyFilters(visibleUsers).filter((u: any) =>
      !term || u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term)
    );
  }, [visibleUsers, search, activeRolTab, statusFilter]);

  const countByRol = useMemo(() => {
    const c: Record<string, number> = {};
    ROLES.forEach(r => { c[r] = visibleUsers.filter((u: any) => u.rol === r).length; });
    return c;
  }, [visibleUsers]);

  const isLoading = loadingUsers || loadingFichas;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full text-zinc-100 bg-zinc-900 min-h-screen">

      {/* ── Header con tabs (igual que ProjectsPanel) ──────────────────── */}
      <div className="flex items-start bg-zinc-900 pt-10 pl-10 gap-4 flex-col border-b border-zinc-600/60">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Usuarios</h2>
          <p className="text-[12px] font-semibold text-zinc-400 mt-0.5">
            {visibleUsers.length} registrados · {visibleUsers.filter((u: any) => u.activo).length} activos · {fichasArr.length} fichas
          </p>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          {/* Tab: todos */}
          <button
            onClick={() => setTab('todos')}
            className={`inline-flex items-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${
              tab === 'todos'
                ? 'text-blue-400 border-white'
                : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
            }`}
          >
            Todos los usuarios
          </button>
          {/* Tab: nuevo */}
          {isAdmin && (
            <button
              onClick={() => setTab('nuevo')}
              className={`inline-flex items-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${
                tab === 'nuevo'
                  ? 'text-blue-400 border-white'
                  : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
              }`}
            >
              <Plus size={16} /> Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido dinámico ─────────────────────────────────────────── */}
      {tab === 'nuevo' ? (
        <CreateUserForm
          fichas={fichasArr}
          createMutation={createMutation}
          inviteMutation={inviteMutation}
          onCancel={() => setTab('todos')}
        />
      ) : (
        <>
          {/* Búsqueda y filtros */}
          <div className="flex bg-zinc-900 flex-col pt-6 gap-4">
            {/* Barra de búsqueda */}
            <div className="relative mx-10">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="w-full bg-zinc-900 border border-zinc-400 rounded-lg pl-10 py-3.5 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  title="Limpiar búsqueda" aria-label="Limpiar búsqueda"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filtros rápidos */}
            <div className="flex mx-10 items-center gap-3 flex-wrap">
              {/* Vista */}
              <div className="flex gap-1 bg-zinc-950 border border-zinc-700 rounded-md p-1 shrink-0">
                <button onClick={() => setViewMode('fichas')}
                  className={`px-3 py-1.5 rounded text-[12px] font-bold transition-colors flex items-center gap-1.5 ${viewMode === 'fichas' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <FolderOpen size={11} /> Por fichas
                </button>
                <button onClick={() => setViewMode('roles')}
                  className={`px-3 py-1.5 rounded text-[12px] font-bold transition-colors flex items-center gap-1.5 ${viewMode === 'roles' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Users size={11} /> Por roles
                </button>
              </div>

              {/* Rol */}
              <div className="flex gap-1 bg-zinc-950 border border-zinc-700 rounded-md p-1 flex-wrap">
                <button onClick={() => setActiveRolTab('all')}
                  className={`px-3 py-1.5 rounded text-[12px] font-bold transition-colors ${activeRolTab === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  Todos
                </button>
                {ROLES.map(r => (
                  <button key={r} onClick={() => setActiveRolTab(activeRolTab === r ? 'all' : r)}
                    className={`px-3 py-1.5 rounded text-[12px] font-bold transition-colors ${
                      activeRolTab === r
                        ? `${ROL_CONFIG[r].bg} ${ROL_CONFIG[r].color} border ${ROL_CONFIG[r].border}`
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {ROL_CONFIG[r].label} <span className="opacity-50">({countByRol[r] ?? 0})</span>
                  </button>
                ))}
              </div>

              {/* Estado */}
              <div className="flex gap-1 bg-zinc-950 border border-zinc-700 rounded-md p-1">
                {(['all', 'activo', 'inactivo'] as const).map(k => (
                  <button key={k} onClick={() => setStatusFilter(k)}
                    className={`px-3 py-1.5 rounded text-[12px] font-bold transition-colors ${statusFilter === k ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {k === 'all' ? 'Todos' : k === 'activo' ? 'Activos' : 'Inactivos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contador */}
          <div className="px-10 pt-8 pb-2.5 bg-zinc-900 flex items-center justify-between text-lg font-bold text-zinc-300 shrink-0">
            <span>
              Hay <strong className="text-zinc-300">{usersArr.length}</strong> usuarios
            </span>
          </div>

          {/* Contenido principal */}
          <div className="pb-12">
            {isLoading ? (
              <div className="space-y-3 mx-4">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-16 bg-zinc-900 border border-zinc-600/40 rounded-md animate-pulse" />
                ))}
              </div>
            ) : viewMode === 'fichas' ? (
              <div className="space-y-0 mx-4 bg-zinc-900">
                {fichaGroups.byFicha.length === 0 && fichaGroups.sinFicha.length === 0 && (
                  <div className="py-12 text-center text-[13px] text-zinc-500 italic bg-zinc-900 border border-zinc-600/60 rounded-md">
                    No hay usuarios con los filtros actuales.
                  </div>
                )}
                {fichaGroups.byFicha.map(({ ficha, users: fUsers }: any) => (
                  <FichaBlock key={ficha.id} ficha={ficha} users={fUsers}
                    isAdmin={isAdmin} canConfirm={canConfirm} canViewProfiles={canViewProfiles} search={search}
                    onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
                    toggleMutation={toggleMutation} deleteMutation={deleteMutation}
                    liderMutation={liderMutation} confirmMutation={confirmMutation}
                    selectedIds={selectedUserIds} onSelect={toggleSelect}
                    onSelectGroup={selectGroup} onDeselectGroup={deselectGroup} meId={me?.id}
                  />
                ))}
                {fichaGroups.sinFicha.length > 0 && (
                  <div className="bg-zinc-900/95 border border-zinc-600/80 rounded-md overflow-hidden shadow-lg mb-3">
                    <div className="px-5 py-4 bg-zinc-950/20 border-b border-zinc-600/40 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-600 flex items-center justify-center">
                        <Users size={14} className="text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white tracking-tight">Sin ficha asignada</p>
                        <p className="text-[11px] text-zinc-400">
                          {fichaGroups.sinFicha.length} usuario{fichaGroups.sinFicha.length !== 1 ? 's' : ''} pendientes
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto bg-zinc-900/40">
                      <UsersTable
                        users={fichaGroups.sinFicha.filter((u: any) => {
                          const term = search.toLowerCase().trim();
                          return !term || u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term);
                        })}
                        isAdmin={isAdmin} canConfirm={canConfirm} canViewProfiles={canViewProfiles}
                        onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
                        toggleMutation={toggleMutation} deleteMutation={deleteMutation}
                        liderMutation={liderMutation} confirmMutation={confirmMutation}
                        selectedIds={selectedUserIds} onSelect={toggleSelect}
                        onSelectGroup={selectGroup} onDeselectGroup={deselectGroup} meId={me?.id}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-700/60 rounded-md mx-4 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <UsersTable users={filteredByRole} isAdmin={isAdmin} canConfirm={canConfirm} canViewProfiles={canViewProfiles}
                    onViewProfile={setProfileUserId} onRoleChange={handleRoleChange}
                    toggleMutation={toggleMutation} deleteMutation={deleteMutation}
                    liderMutation={liderMutation} confirmMutation={confirmMutation}
                    selectedIds={selectedUserIds} onSelect={toggleSelect}
                    onSelectGroup={selectGroup} onDeselectGroup={deselectGroup} meId={me?.id}
                  />
                </div>
                {filteredByRole.length > 0 && (
                  <div className="px-6 py-2.5 border-t border-zinc-700/60 bg-zinc-950/20">
                    <p className="text-xs text-zinc-500">
                      Mostrando <span className="font-medium text-zinc-300">{filteredByRole.length}</span> de{' '}
                      <span className="font-medium text-zinc-300">{usersArr.length}</span> usuarios
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Barra flotante de acciones masivas ────────────────────────── */}
      <AnimatePresence>
        {selectedUserIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3
                       bg-zinc-900 border border-zinc-600/80 rounded-2xl shadow-2xl shadow-black/60"
          >
            {/* Contador */}
            <div className="flex items-center gap-2 pr-3 border-r border-zinc-700">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                <Check size={11} className="text-white" />
              </div>
              <span className="text-[13px] font-black text-white">
                {selectedUserIds.size} seleccionado{selectedUserIds.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Confirmar — solo si hay cuentas pendientes */}
            {hasPending && (
              <button
                onClick={() => {
                  const pendingIds = selectedUsers.filter(u => u.cuenta_confirmada === false).map(u => u.id);
                  if (confirm(`¿Confirmar ${pendingIds.length} cuenta${pendingIds.length !== 1 ? 's' : ''} pendiente${pendingIds.length !== 1 ? 's' : ''}?`)) {
                    bulkConfirmMutation.mutate(pendingIds);
                  }
                }}
                disabled={bulkPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-black rounded-lg
                           bg-amber-500/15 text-amber-400 border border-amber-500/30
                           hover:bg-amber-500/25 hover:border-amber-500/50
                           disabled:opacity-50 transition-all"
              >
                <UserCheck size={13} />
                Confirmar {selectedUsers.filter(u => u.cuenta_confirmada === false).length > 1
                  ? `(${selectedUsers.filter(u => u.cuenta_confirmada === false).length})`
                  : ''}
              </button>
            )}

            {/* Activar — solo si hay inactivos */}
            {hasInactive && (
              <button
                onClick={() => {
                  const inactiveIds = selectedUsers.filter(u => !u.activo).map(u => u.id);
                  bulkToggleMutation.mutate(inactiveIds);
                }}
                disabled={bulkPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-black rounded-lg
                           bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                           hover:bg-emerald-500/25 hover:border-emerald-500/50
                           disabled:opacity-50 transition-all"
              >
                <UserCheck size={13} />
                Activar {selectedUsers.filter(u => !u.activo).length > 1
                  ? `(${selectedUsers.filter(u => !u.activo).length})`
                  : ''}
              </button>
            )}

            {/* Desactivar — solo si hay activos */}
            {hasActive && (
              <button
                onClick={() => {
                  const activeIds = selectedUsers.filter(u => u.activo).map(u => u.id);
                  bulkToggleMutation.mutate(activeIds);
                }}
                disabled={bulkPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-black rounded-lg
                           bg-zinc-800 text-zinc-300 border border-zinc-600
                           hover:bg-zinc-700 hover:text-white hover:border-zinc-500
                           disabled:opacity-50 transition-all"
              >
                <UserX size={13} />
                Desactivar {selectedUsers.filter(u => u.activo).length > 1
                  ? `(${selectedUsers.filter(u => u.activo).length})`
                  : ''}
              </button>
            )}

            {/* Eliminar — siempre */}
            <button
              onClick={() => {
                const n = selectedUserIds.size;
                if (confirm(`¿Eliminar ${n} usuario${n !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedUserIds));
                }
              }}
              disabled={bulkPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-black rounded-lg
                         bg-rose-500/15 text-rose-400 border border-rose-500/30
                         hover:bg-rose-500/25 hover:border-rose-500/50
                         disabled:opacity-50 transition-all"
            >
              <Trash2 size={13} />
              Eliminar
            </button>

            {/* Separador + limpiar */}
            <div className="pl-3 border-l border-zinc-700">
              <button
                onClick={clearSelection}
                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-all"
                title="Deseleccionar todo"
              >
                <X size={15} />
              </button>
            </div>

            {/* Spinner */}
            {bulkPending && (
              <span className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin ml-1" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal confirmación cambio a coordinador ─────────────────────── */}
      <RoleChangeConfirmModal
        isOpen={roleConfirm !== null} onClose={() => setRoleConfirm(null)}
        onConfirm={() => roleConfirm && roleMutation.mutate({ id: roleConfirm.userId, rol: roleConfirm.newRole })}
        targetName={roleConfirm?.nombre ?? ''} isPending={roleMutation.isPending}
      />

      {/* ── Modal perfil de usuario ────────────────────────────────────── */}
      <AnimatePresence>
        {profileUserId !== null && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
