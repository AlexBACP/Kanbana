/**
 * InstructorEquipo — Aprendices del instructor agrupados por ficha.
 * ✅ Solo muestra aprendices vinculados a las fichas del instructor (rol === 'aprendiz').
 * ✅ Promoción / degradación de sub-rol líder técnico vía fichaService (es_lider_tecnico).
 * ✅ Desvinculación masiva con checkbox + filtro local por ficha.
 * ✅ Ver perfil de cada usuario.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { userService } from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { UserProfileModal } from '../../components/UserProfileModal';
import { AddAprendizModal } from '../../components/AddAprendizModal';
import {
  Users, Search, Eye, Hash, ChevronRight, Crown,
  Trash2, CheckSquare, Square, AlertTriangle, X, Loader2,
  UserPlus, Mail, Clock, CheckCircle2,
} from 'lucide-react';

const ROL_BADGE: Record<string, string> = {
  aprendiz:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

// ── Modal confirmación desvinculación masiva ───────────────────────────────────
const BulkUnlinkModal = ({
  selected, fichaId, fichaCode, onClose, onSuccess,
}: {
  selected: any[];
  fichaId: number;
  fichaCode: string;
  onClose: () => void;
  onSuccess: (removedIds: number[]) => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      const ids = selected.map(u => u.id);
      await fichaService.removeMembers(fichaId, ids);
      qc.invalidateQueries({ queryKey: ['users', 'my-context'] });
      onSuccess(ids);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al desvincular aprendices');
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle size={15} className="text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Confirmar desvinculación</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-500">
            Se van a desvincular{' '}
            <span className="text-zinc-100 font-semibold">{selected.length} aprendice{selected.length !== 1 ? 's' : ''}</span>
            {' '}de la ficha{' '}
            <span className="text-primary-400 font-semibold">#{fichaCode}</span>.
            Sus cuentas no serán eliminadas.
          </p>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
            {selected.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/40 last:border-0">
                <div className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center shrink-0">
                  {u.avatar_url
                    ? <img src={userService.getAvatarUrl(u.avatar_url) || ''} className="w-full h-full object-cover rounded-full" alt="" />
                    : <span className="text-[8px] font-semibold text-primary-400">{u.nombre?.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-100 truncate">{u.nombre}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{u.correo}</p>
                </div>
                {/* ── muestra si es líder técnico ── */}
                {u.es_lider_tecnico && (
                  <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">
                    <Crown size={8} /> Líder
                  </span>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertTriangle size={12} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2.5 text-xs font-bold border border-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isPending
                ? <><Loader2 size={12} className="animate-spin" /> Desvinculando...</>
                : <><Trash2 size={12} /> Desvincular {selected.length}</>
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Tabla de usuarios reutilizable ────────────────────────────────────────────
const UserTable = ({
  users, ficha, selectedIds, onToggleUser, onViewProfile,
  onBulkUnlink, onPromote, onDemote, showResend, resendingId, onResend,
}: any) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-zinc-800/50">
        <th className="px-4 py-2.5 w-8"></th>
        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Nombre</th>
        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Correo</th>
        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Sub-rol</th>
        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Estado</th>
        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">Acciones</th>
      </tr>
    </thead>
    <tbody>
      {users.map((u: any) => {
        const isSelected = (selectedIds as number[]).includes(u.id);
        const esLider    = u.es_lider_tecnico === true;
        return (
          <tr
            key={u.id}
            className={`border-b border-zinc-800/30 last:border-0 transition-colors group ${
              isSelected ? 'bg-primary-500/5' : 'hover:bg-zinc-950/30'
            }`}
          >
            <td className="px-4 py-2.5">
              <button
                onClick={() => onToggleUser(u.id, !isSelected)}
                className="text-zinc-500 hover:text-primary-400 transition-colors"
              >
                {isSelected
                  ? <CheckSquare size={14} className="text-primary-400" />
                  : <Square size={14} />
                }
              </button>
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar_url
                    ? <img src={userService.getAvatarUrl(u.avatar_url) || ''} className="w-full h-full object-cover" alt="" />
                    : <span className="text-[9px] font-semibold text-primary-400">{u.nombre?.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <button
                  onClick={() => onViewProfile(u.id)}
                  className="font-medium text-zinc-100 text-sm hover:text-primary-400 transition-colors text-left"
                >
                  {u.nombre}
                </button>
              </div>
            </td>
            <td className="px-4 py-2.5 text-xs text-zinc-500">{u.correo}</td>
            <td className="px-4 py-2.5">
              {esLider ? (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20 w-fit">
                  <Crown size={10} /> Líder técnico
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-md border font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
                  Aprendiz
                </span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`text-xs ${u.activo ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {showResend && (
                  <button
                    onClick={() => onResend(u.id)}
                    disabled={resendingId === u.id}
                    className="text-xs text-zinc-500 hover:text-sky-400 border border-zinc-800 hover:border-sky-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {resendingId === u.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Mail size={11} />
                    }
                    Reenviar
                  </button>
                )}
                <button
                  onClick={() => onViewProfile(u.id)}
                  className="text-xs text-zinc-500 hover:text-primary-400 border border-zinc-800 hover:border-primary-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
                >
                  <Eye size={11} /> Perfil
                </button>
                <button
                  onClick={() => onBulkUnlink(ficha, [u])}
                  className="text-xs text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={11} /> Desvincular
                </button>
                {!esLider ? (
                  <button
                    onClick={() =>
                      confirm(`¿Asignar a ${u.nombre} como Líder Técnico de esta ficha?`) &&
                      onPromote(ficha.id, u.id)
                    }
                    className="text-xs text-zinc-500 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
                  >
                    <Crown size={11} /> Hacer líder
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      confirm(`¿Quitar el sub-rol de Líder Técnico a ${u.nombre}?`) &&
                      onDemote(ficha.id, u.id)
                    }
                    className="text-xs text-zinc-500 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/30 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
                  >
                    <Crown size={11} /> Quitar líder
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ── Bloque por ficha ───────────────────────────────────────────────────────────
const FichaBlock = ({
  ficha, users, globalSearch,
  onPromote, onDemote,
  onViewProfile, selectedIds, onToggleUser, onBulkUnlink,
  onResend,
}: any) => {
  const [open, setOpen] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [resendingId, setResendingId] = useState<number | null>(null);

  const searchTerm = globalSearch || localSearch;
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return users;
    return users.filter((u: any) =>
      u.nombre?.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const fichaSelectedIds = (selectedIds as number[]).filter(id =>
    users.some((u: any) => u.id === id)
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u: any) => (selectedIds as number[]).includes(u.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      filtered.forEach((u: any) => onToggleUser(u.id, false));
    } else {
      filtered.forEach((u: any) => onToggleUser(u.id, true));
    }
  };

  const confirmados  = filtered.filter((u: any) => u.cuenta_confirmada);
  const pendientes   = filtered.filter((u: any) => !u.cuenta_confirmada);

  const handleResend = async (userId: number) => {
    setResendingId(userId);
    try {
      await onResend(ficha.id, userId);
    } finally {
      setResendingId(null);
    }
  };

  // Contadores de sub-roles para el encabezado del bloque
  const lideresCount   = users.filter((u: any) => u.es_lider_tecnico).length;
  const aprendizCount  = users.length - lideresCount;
  const pendientesCount = users.filter((u: any) => !u.cuenta_confirmada).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-950/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
            <Hash size={14} className="text-primary-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-100">Ficha {ficha.codigo}</p>
            <p className="text-[10px] text-zinc-500">{ficha.programa}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {fichaSelectedIds.length > 0 && (
            <button
              onClick={e => {
                e.stopPropagation();
                onBulkUnlink(ficha, users.filter((u: any) => fichaSelectedIds.includes(u.id)));
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 size={10} /> Desvincular ({fichaSelectedIds.length})
            </button>
          )}
          <span className="text-xs text-zinc-500">
            {aprendizCount} aprendice{aprendizCount !== 1 ? 's' : ''} · {lideresCount} líder{lideresCount !== 1 ? 'es' : ''}
            {pendientesCount > 0 && (
              <span className="ml-2 text-amber-400">· {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}</span>
            )}
          </span>
          <ChevronRight size={14} className={`text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            {/* Barra de búsqueda local + select-all */}
            <div className="px-4 py-2.5 border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-950/20">
              <div className="relative flex-1 max-w-xs">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={localSearch}
                  onChange={e => setLocalSearch(e.target.value)}
                  placeholder="Filtrar en esta ficha..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-primary-500/40 transition-colors placeholder:text-zinc-500/40"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {filtered.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); toggleAll(); }}
                  className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-primary-400 transition-colors whitespace-nowrap"
                >
                  {allFilteredSelected
                    ? <CheckSquare size={13} className="text-primary-400" />
                    : <Square size={13} />
                  }
                  {allFilteredSelected ? 'Deseleccionar' : 'Seleccionar'} todos ({filtered.length})
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">Sin coincidencias</div>
            ) : (
              <>
                {/* ── Pendientes de confirmación ── */}
                {pendientes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border-b border-amber-500/10">
                      <Clock size={11} className="text-amber-400" />
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                        Pendientes de confirmación ({pendientes.length})
                      </span>
                    </div>
                    <UserTable
                      users={pendientes}
                      ficha={ficha}
                      selectedIds={selectedIds}
                      onToggleUser={onToggleUser}
                      onViewProfile={onViewProfile}
                      onBulkUnlink={onBulkUnlink}
                      onPromote={onPromote}
                      onDemote={onDemote}
                      showResend
                      resendingId={resendingId}
                      onResend={handleResend}
                    />
                  </div>
                )}

                {/* ── Confirmados ── */}
                {confirmados.length > 0 && (
                  <div>
                    {pendientes.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border-b border-t border-emerald-500/10">
                        <CheckCircle2 size={11} className="text-emerald-400" />
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                          Confirmados ({confirmados.length})
                        </span>
                      </div>
                    )}
                    <UserTable
                      users={confirmados}
                      ficha={ficha}
                      selectedIds={selectedIds}
                      onToggleUser={onToggleUser}
                      onViewProfile={onViewProfile}
                      onBulkUnlink={onBulkUnlink}
                      onPromote={onPromote}
                      onDemote={onDemote}
                      showResend={false}
                      resendingId={resendingId}
                      onResend={handleResend}
                    />
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Panel principal ────────────────────────────────────────────────────────────
export const InstructorEquipo = () => {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [filterLider, setFilterLider] = useState<'all' | 'aprendiz' | 'lider'>('all');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTarget, setBulkTarget]  = useState<{ ficha: any; users: any[] } | null>(null);
  const [addTarget, setAddTarget]    = useState<{ id: number; codigo: string } | null>(null);

  const { data: context, isLoading } = useQuery({
    queryKey: ['users', 'my-context'],
    queryFn: userService.getMyContext,
    staleTime: 60_000,
  });

  // ▼ CAMBIO: mutaciones separadas usando fichaService (es_lider_tecnico), no userService.updateRole
  const promoteMutation = useMutation({
    mutationFn: ({ fichaId, userId }: { fichaId: number; userId: number }) =>
      fichaService.promoteToLider(fichaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'my-context'] }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(`No se pudo promover: ${Array.isArray(msg) ? msg.join(', ') : (msg || 'Error desconocido')}`);
    },
  });

  const demoteMutation = useMutation({
    mutationFn: ({ fichaId, userId }: { fichaId: number; userId: number }) =>
      fichaService.demoteToAprendiz(fichaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'my-context'] }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      alert(`No se pudo quitar el rol: ${Array.isArray(msg) ? msg.join(', ') : (msg || 'Error desconocido')}`);
    },
  });

  const handleResend = async (fichaId: number, userId: number) => {
    try {
      await fichaService.reenviarInvitacion(fichaId, userId);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      alert(`No se pudo reenviar: ${Array.isArray(msg) ? msg.join(', ') : (msg || 'Error desconocido')}`);
    }
  };

  const rawUsers: any[]  = (context as any)?.users  ?? [];
  const fichas:   any[]  = (context as any)?.fichas  ?? [];

  // ▼ CAMBIO: solo aprendices (rol === 'aprendiz') — excluye instructores, coordinadores y cualquier otro rol.
  // La relación instructor-ficha viene del backend que ya filtra por fichas del instructor.
  const soloAprendices = rawUsers.filter(u => u.rol === 'aprendiz');

  // Filtro adicional por sub-rol para los tabs
  const visibles = soloAprendices.filter(u => {
    if (filterLider === 'lider')    return u.es_lider_tecnico === true;
    if (filterLider === 'aprendiz') return !u.es_lider_tecnico;
    return true;
  });

  const totalLideres   = soloAprendices.filter(u => u.es_lider_tecnico).length;
  const totalAprendices = soloAprendices.filter(u => !u.es_lider_tecnico).length;

  // Agrupar por ficha del instructor
  const fichaGroups = useMemo(() => {
    const byFicha = fichas.map(f => ({
      ficha: f,
      // ▼ CAMBIO: compara ficha por id (el backend retorna u.ficha como objeto con id)
      users: visibles.filter(u => u.ficha?.id === f.id),
    })).filter(g => g.users.length > 0);
    return byFicha;
  }, [visibles, fichas]);

  const toggleUser = (id: number, add: boolean) => {
    setSelectedIds(prev => add ? [...prev.filter(x => x !== id), id] : prev.filter(x => x !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Mis Aprendices</h2>
          <p className="section-subtitle">
            {soloAprendices.length} aprendice{soloAprendices.length !== 1 ? 's' : ''} en {fichas.length} ficha{fichas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {fichas.length > 0 && (
            <div className="flex gap-2">
              {fichas.map((f: any) => (
                <button
                  key={f.id}
                  onClick={() => setAddTarget({ id: f.id, codigo: f.codigo })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-400 border border-primary-500/30 hover:bg-primary-500/10 rounded-xl px-3 py-1.5 transition-colors"
                >
                  <UserPlus size={12} /> Agregar a #{f.codigo}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <CheckSquare size={13} className="text-rose-400" />
            <span className="text-xs text-rose-400 font-medium">
              {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[10px] text-rose-400/70 hover:text-rose-400 underline ml-1"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar aprendiz..."
            className="bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 outline-none focus:border-primary-500/40 transition-colors w-60 placeholder:text-zinc-500/50"
          />
        </div>
        {/* ▼ CAMBIO: tabs filtran por sub-rol (es_lider_tecnico), no por rol base */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {([
            { key: 'all'      as const, label: `Todos (${soloAprendices.length})` },
            { key: 'aprendiz' as const, label: `Aprendices (${totalAprendices})` },
            { key: 'lider'    as const, label: `Líderes (${totalLideres})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterLider(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterLider === key
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-zinc-500 hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(n => <div key={n} className="h-16 bg-zinc-900 rounded-xl animate-pulse border border-zinc-800" />)}
        </div>
      ) : soloAprendices.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <Users size={28} className="mx-auto text-zinc-500 mb-3 opacity-30" />
          <p className="text-sm text-zinc-500">No hay aprendices vinculados a tus fichas aún</p>
        </div>
      ) : fichaGroups.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <Users size={28} className="mx-auto text-zinc-500 mb-3 opacity-30" />
          <p className="text-sm text-zinc-500">Sin resultados para este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fichaGroups.map(({ ficha, users }) => (
            <FichaBlock
              key={ficha.id}
              ficha={ficha}
              users={users}
              globalSearch={search}
              onPromote={(fichaId: number, userId: number) =>
                promoteMutation.mutate({ fichaId, userId })
              }
              onDemote={(fichaId: number, userId: number) =>
                demoteMutation.mutate({ fichaId, userId })
              }
              onViewProfile={setProfileUserId}
              selectedIds={selectedIds}
              onToggleUser={toggleUser}
              onBulkUnlink={(f: any, us: any[]) => setBulkTarget({ ficha: f, users: us })}
              onResend={(fichaId: number, userId: number) => handleResend(fichaId, userId)}
            />
          ))}
        </div>
      )}

      {/* Modal bulk unlink */}
      <AnimatePresence>
        {bulkTarget && (
          <BulkUnlinkModal
            selected={bulkTarget.users}
            fichaId={bulkTarget.ficha.id}
            fichaCode={bulkTarget.ficha.codigo}
            onClose={() => setBulkTarget(null)}
            onSuccess={removedIds => {
              setBulkTarget(null);
              setSelectedIds(prev => prev.filter(id => !removedIds.includes(id)));
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileUserId !== null && (
          <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addTarget && (
          <AddAprendizModal
            fichaId={addTarget.id}
            fichaCode={addTarget.codigo}
            onClose={() => setAddTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};