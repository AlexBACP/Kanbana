/**
 * UserProfileModal — Panel lateral de perfil de cualquier usuario.
 * Se abre desde UsersPanel, LeadersPanel, FichasPanel, etc.
 *
 * Muestra:
 *   - Banner de portada con imagen por defecto según el rol (o subida por el usuario)
 *   - Avatar circular superpuesto sobre el banner
 *   - Datos personales y sección dinámica según rol
 *       instructor   → fichas asignadas + proyectos supervisados
 *       lider_tecnico→ proyecto + equipo + tickets
 *       aprendiz     → proyecto + tickets + progreso
 *   - Cambio de contraseña (coordinador → cualquiera; instructor → sus aprendices/líderes)
 *
 * Rediseñado con estilo zinc/moderno (sin dark-card/dark-border/dark-bg).
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, Phone, FileText, Calendar, Shield,
  GraduationCap, FolderKanban, Ticket, Users,
  CheckCircle2, Clock, AlertCircle, Hash,
  Key, Eye, EyeOff, Loader2, Lock, Camera,
} from 'lucide-react';
import { userService } from '../services/user.service';
import { AvatarUploader } from './AvatarUploader';
import { useAuthStore } from '../store/auth.store';

interface UserProfileModalProps {
  userId: number;
  onClose: () => void;
}

const ROL_LABEL: Record<string, string> = {
  coordinador: 'Coordinador',
  instructor: 'Instructor',
  lider_tecnico: 'Líder Técnico',
  aprendiz: 'Aprendiz',
};
const ROL_COLOR: Record<string, string> = {
  coordinador: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  instructor:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  aprendiz:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
};
const STATUS_DOT: Record<string, string> = {
  to_do:       'bg-slate-500',
  in_progress: 'bg-blue-500',
  testing:     'bg-amber-500',
  done:        'bg-emerald-500',
};

// Portadas por defecto según rol (gradientes únicos por rol)
const ROL_DEFAULT_BANNER: Record<string, string> = {
  coordinador:  'linear-gradient(135deg, #4c1d95 0%, #7c3aed 40%, #2e1065 100%)',
  instructor:   'linear-gradient(135deg, #1e3a5f 0%, #2563eb 40%, #0f172a 100%)',
  lider_tecnico:'linear-gradient(135deg, #064e3b 0%, #059669 40%, #022c22 100%)',
  aprendiz:     'linear-gradient(135deg, #78350f 0%, #d97706 40%, #451a03 100%)',
};

// ── Sección de cambio de contraseña ──────────────────────────────────────────
const PasswordSection = ({ targetId, canAdmin }: { targetId: number; canAdmin: boolean }) => {
  const { user: me } = useAuthStore();
  const [open, setOpen]       = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [actual, setActual]   = useState('');
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isOwnProfile = me?.id === targetId;

  const mutation = useMutation({
    mutationFn: () => {
      if (isOwnProfile) return userService.changeOwnPassword(targetId, actual, pwd);
      return userService.changePasswordAsAdmin(targetId, pwd);
    },
    onSuccess: () => {
      setMsg({ type: 'ok', text: 'Contraseña actualizada correctamente' });
      setPwd(''); setConfirm(''); setActual('');
      setTimeout(() => { setMsg(null); setOpen(false); }, 2000);
    },
    onError: (err: any) => {
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Error al cambiar contraseña' });
    },
  });

  const canChange = isOwnProfile || canAdmin;
  if (!canChange) return null;

  return (
    <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-200 transition-colors"
      >
        <span className="flex items-center gap-2"><Key size={13} /> Cambiar contraseña</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {isOwnProfile && (
                <div className="relative">
                  <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Contraseña actual"
                    value={actual}
                    onChange={e => setActual(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600"
                  />
                </div>
              )}
              <div className="relative">
                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Nueva contraseña"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-8 py-2 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Confirmar nueva contraseña"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary-500/50 placeholder:text-zinc-600"
                />
              </div>
              {msg && (
                <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {msg.text}
                </p>
              )}
              <button
                onClick={() => {
                  if (pwd.length < 6) { setMsg({ type: 'err', text: 'Mínimo 6 caracteres' }); return; }
                  if (pwd !== confirm) { setMsg({ type: 'err', text: 'Las contraseñas no coinciden' }); return; }
                  mutation.mutate();
                }}
                disabled={mutation.isPending}
                className="w-full py-2 bg-primary-600/15 border border-primary-500/25 text-primary-400 text-xs font-black rounded-xl hover:bg-primary-600/25 transition-all flex items-center justify-center gap-2"
              >
                {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
                Actualizar contraseña
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
export const UserProfileModal = ({ userId, onClose }: UserProfileModalProps) => {
  const { user: me, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerLoading, setBannerLoading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userService.getProfile(userId),
    staleTime: 30_000,
  });

  // Determinar si el visor puede cambiar la contraseña del target
  const canAdminPassword =
    me?.rol === 'coordinador' ||
    (me?.rol === 'instructor' && profile?.rol === 'aprendiz'); // lider_tecnico es sub-rol de aprendiz

  const isOwnProfile = me?.id === userId;

  // Banner: imagen subida o gradiente por defecto según rol
  const bannerRawUrl = profile?.banner_url;
  const bannerSrc = userService.getAvatarUrl(bannerRawUrl);
  const bannerStyle = bannerSrc
    ? { backgroundImage: `url(${bannerSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: ROL_DEFAULT_BANNER[profile?.rol] || ROL_DEFAULT_BANNER['aprendiz'] };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) return;
    setBannerLoading(true);
    try {
      const { banner_url } = await userService.uploadBanner(profile.id, file);
      if (isOwnProfile) updateUser({ banner_url });
      await queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    } finally {
      setBannerLoading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel lateral derecho */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md h-full bg-zinc-900 border-l border-zinc-800 overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Botón cerrar flotante sobre el banner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white border border-white/10 transition-all"
        >
          <X size={16} />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="text-primary-400 animate-spin" />
          </div>
        ) : !profile ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Usuario no encontrado</div>
        ) : (
          <>
            {/* ── Banner + Avatar superpuesto ──────────────────────── */}
            <div className="shrink-0">
              {/* Banner */}
              <div className="relative h-36 w-full group" style={bannerStyle}>
                <div className="absolute inset-0 bg-black/25" />
                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={bannerLoading}
                      className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 group-hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100 text-white text-xs font-bold"
                    >
                      {bannerLoading
                        ? <Loader2 size={18} className="animate-spin" />
                        : <><Camera size={16} /> Cambiar portada</>
                      }
                    </button>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleBannerFile}
                    />
                  </>
                )}
              </div>

              {/* Avatar superpuesto + nombre */}
              <div className="px-5 pb-5 bg-zinc-900">
                <div className="flex items-end gap-3 -mt-9 mb-3">
                  <div className="ring-4 ring-zinc-900 rounded-full shrink-0">
                    <AvatarUploader
                      userId={userId}
                      currentUrl={profile.avatar_url}
                      nombre={profile.nombre}
                      size="lg"
                      editable={isOwnProfile}
                      onSuccess={(avatar_url) => {
                        if (isOwnProfile) updateUser({ avatar_url });
                        queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
                      }}
                    />
                  </div>
                  <div className="pb-1 flex-1 min-w-0">
                    <h3 className="text-base font-black text-white leading-tight truncate">{profile.nombre}</h3>
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mt-0.5 ${profile.activo ? 'text-emerald-400' : 'text-rose-400'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${profile.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {profile.activo ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>

                {/* Badge de rol */}
                <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${ROL_COLOR[profile.rol] || ''}`}>
                  {ROL_LABEL[profile.rol] || profile.rol}
                </span>

                {/* Bio corta */}
                {profile.bio && (
                  <p className="text-xs text-zinc-500 italic mt-2.5 line-clamp-2 border-l-2 border-zinc-700 pl-2.5">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* ── Contenido scrollable ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">

                {/* ── Datos personales ─────────────────────────────── */}
                <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-3">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={12} /> Información personal
                  </h4>
                  {[
                    { icon: Mail,     label: 'Correo',          value: profile.correo },
                    { icon: Phone,    label: 'Teléfono',        value: profile.telefono || '—' },
                    { icon: Calendar, label: 'Miembro desde',   value: profile.creado_en ? new Date(profile.creado_en).toLocaleDateString('es-CO') : '—' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon size={13} className="text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-bold text-zinc-200">{value}</p>
                      </div>
                    </div>
                  ))}
                  {profile.bio && (
                    <div className="flex items-start gap-3">
                      <FileText size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Bio</p>
                        <p className="text-xs text-zinc-300 leading-relaxed">{profile.bio}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Stats rápidos ─────────────────────────────────── */}
                {profile.stats && (
                  <div className="grid grid-cols-2 gap-2">
                    {profile.rol === 'coordinador' && [
                      { label: 'Usuarios',  value: profile.stats.totalUsers    ?? 0, icon: '👥' },
                      { label: 'Proyectos', value: profile.stats.totalProyectos ?? 0, icon: '📁' },
                      { label: 'Fichas',    value: profile.stats.totalFichas    ?? 0, icon: '📋' },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3 text-center">
                        <p className="text-base mb-0.5">{s.icon}</p>
                        <p className="text-lg font-black text-zinc-100">{s.value}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                    {profile.rol === 'instructor' && [
                      { label: 'Fichas',    value: profile.stats.fichas_count     ?? 0 },
                      { label: 'Proyectos', value: profile.stats.proyectos_count  ?? 0 },
                      { label: 'Activos',   value: profile.stats.proyectos_activos ?? 0 },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3 text-center">
                        <p className="text-lg font-black text-zinc-100">{s.value}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                    {(profile.rol === 'aprendiz' && profile.es_lider_tecnico) && [
                      { label: 'Proyectos',    value: profile.stats.proyectos_count   ?? 0 },
                      { label: 'Equipo',       value: profile.stats.equipo_count       ?? 0 },
                      { label: 'Tareas',       value: profile.stats.tickets_asignados  ?? 0 },
                      { label: 'Completados',  value: profile.stats.tickets_completados ?? 0 },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3 text-center">
                        <p className="text-lg font-black text-zinc-100">{s.value}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                    {profile.rol === 'aprendiz' && [
                      { label: 'Tareas',      value: profile.stats.tickets_total       ?? 0 },
                      { label: 'Completados', value: profile.stats.tickets_completados  ?? 0 },
                      { label: 'En progreso', value: profile.stats.tickets_en_progreso  ?? 0 },
                      { label: 'Progreso',    value: `${profile.stats.progreso ?? 0}%` },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3 text-center">
                        <p className="text-lg font-black text-zinc-100">{s.value}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Fichas (instructor) ───────────────────────────── */}
                {profile.rol === 'instructor' && profile.fichas?.length > 0 && (
                  <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <GraduationCap size={12} /> Fichas asignadas ({profile.fichas.length})
                    </h4>
                    {profile.fichas.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-700/40">
                        <div className="p-1.5 bg-primary-500/10 rounded-lg">
                          <Hash size={12} className="text-primary-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-200">{f.programa}</p>
                          <p className="text-[10px] text-zinc-500">Ficha {f.codigo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Proyectos ────────────────────────────────────── */}
                {profile.proyectos?.length > 0 && (
                  <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <FolderKanban size={12} /> Proyectos ({profile.proyectos.length})
                    </h4>
                    {profile.proyectos.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-700/40">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          p.estado === 'activo'     ? 'bg-emerald-500' :
                          p.estado === 'pausado'    ? 'bg-amber-500'   : 'bg-slate-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-200 truncate">{p.nombre}</p>
                          <p className="text-[10px] text-zinc-500 capitalize">{p.estado}</p>
                        </div>
                        <a href={`/projects/${p.id}/kanban`} className="text-[10px] text-primary-400 hover:text-primary-300 font-bold uppercase tracking-widest">
                          Ver →
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Equipo (líder técnico) ────────────────────────── */}
                {(profile.rol === 'aprendiz' && profile.es_lider_tecnico) && profile.equipo?.length > 0 && (
                  <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <Users size={12} /> Equipo ({profile.equipo.length})
                    </h4>
                    {profile.equipo.slice(0, 6).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {m.nombre?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-200 truncate">{m.nombre}</p>
                          <p className="text-[10px] text-zinc-500 capitalize">{ROL_LABEL[m.rol] || m.rol}</p>
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full ${m.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Tickets recientes ─────────────────────────────── */}
                {profile.tickets?.length > 0 && (
                  <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <Ticket size={12} /> Tareas ({profile.tickets.length})
                    </h4>
                    {/* Progress bar para aprendiz */}
                    {profile.rol === 'aprendiz' && profile.stats?.progreso !== undefined && (
                      <div>
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                          <span>Progreso general</span>
                          <span className="text-primary-400 font-black">{profile.stats.progreso}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full"
                            style={{ width: `${profile.stats.progreso}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {profile.tickets.slice(0, 8).map((t: any) => (
                      <a key={t.id} href={`/tickets/${t.id}`}
                        className="flex items-center gap-3 p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-700/40 hover:border-primary-500/30 transition-all group"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.estado] || 'bg-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-200 truncate group-hover:text-primary-400 transition-colors">{t.titulo}</p>
                          <p className="text-[10px] text-zinc-500 capitalize">{t.prioridad} · {t.estado?.replace('_', ' ')}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* ── Cambio de contraseña ──────────────────────────── */}
                <PasswordSection targetId={userId} canAdmin={canAdminPassword} />

              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
