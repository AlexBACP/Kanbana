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
  Crown, TrendingUp, Activity,
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
  coordinador: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  instructor:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  aprendiz:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
};
const STATUS_DOT: Record<string, string> = {
  to_do:       'bg-slate-500',
  in_progress: 'bg-blue-500',
  testing:     'bg-amber-500',
  done:        'bg-emerald-500',
};

// Portadas por defecto según rol — paleta neutral, profesional, visible y sin connotaciones de género
const ROL_DEFAULT_BANNER: Record<string, string> = {
  coordinador:  'linear-gradient(135deg, #0f2744 0%, #1a4f96 40%, #0a1e36 100%)',  // azul acero
  instructor:   'linear-gradient(135deg, #083a38 0%, #0e7a70 40%, #052828 100%)',  // cian profundo (matches instructor badge)
  lider_tecnico:'linear-gradient(135deg, #0a2e18 0%, #16653a 40%, #061a0e 100%)',  // verde pizarra
  aprendiz:     'linear-gradient(135deg, #382a07 0%, #8a6517 40%, #1c1408 100%)',  // ámbar slate
};

// ── Formateador de hora en formato 12h con am/pm ──────────────────────────────
const fmt12h = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date} · ${time}`;
};
const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
                  // Política de contraseña — mismas reglas que el backend
                  if (pwd.length < 7)     { setMsg({ type: 'err', text: 'Mínimo 7 caracteres' }); return; }
                  if (!/[A-Z]/.test(pwd)) { setMsg({ type: 'err', text: 'Incluye al menos una letra mayúscula' }); return; }
                  if (!/[0-9]/.test(pwd)) { setMsg({ type: 'err', text: 'Incluye al menos un número' }); return; }
                  if (pwd !== confirm)    { setMsg({ type: 'err', text: 'Las contraseñas no coinciden' }); return; }
                  // Solo cuando es self-change podemos comparar con la actual aquí.
                  // (En admin-change no tenemos la actual; el backend valida igual con bcrypt.)
                  if (isOwnProfile && actual && pwd === actual) {
                    setMsg({ type: 'err', text: 'La nueva contraseña es igual a la actual. Elige una diferente.' });
                    return;
                  }
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
  const [bannerLoading,  setBannerLoading]  = useState(false);
  const [bannerDeleting, setBannerDeleting] = useState(false);

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

  const handleDeleteBanner = async () => {
    if (!profile || bannerDeleting) return;
    setBannerDeleting(true);
    try {
      await userService.update(profile.id, { banner_url: null as unknown as undefined });
      if (isOwnProfile) updateUser({ banner_url: undefined });
      await queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    } finally {
      setBannerDeleting(false);
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
              <div className="relative h-36 w-full group" style={bannerStyle} data-testid="profile-banner">
                <div className="absolute inset-0 bg-black/25" />

                {isOwnProfile && (
                  <>
                    {/* Overlay hover con acciones */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                      {(bannerLoading || bannerDeleting) ? (
                        <Loader2 size={20} className="text-white animate-spin" />
                      ) : (
                        <>
                          {/* Cambiar portada */}
                          <button
                            onClick={() => bannerInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-[11px] font-black rounded-lg border border-white/20 backdrop-blur-sm transition-all"
                          >
                            <Camera size={13} /> Cambiar
                          </button>

                          {/* Eliminar portada — solo si hay foto subida */}
                          {bannerSrc && (
                            <button
                              onClick={handleDeleteBanner}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/70 hover:bg-rose-600/90 text-white text-[11px] font-black rounded-lg border border-rose-400/30 backdrop-blur-sm transition-all"
                            >
                              <X size={13} /> Eliminar portada
                            </button>
                          )}
                        </>
                      )}
                    </div>

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
                      onDelete={() => {
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
                    { icon: Calendar, label: 'Miembro desde',   value: fmt12h(profile.creado_en) },
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

                {/* ── Panel inteligente por rol ──────────────────────── */}

                {/* ─ COORDINADOR ──────────────────────────────────── */}
                {profile.rol === 'coordinador' && profile.stats && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Usuarios',  value: profile.stats.totalUsers    ?? 0, Icon: Users,       color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
                        { label: 'Proyectos', value: profile.stats.totalProyectos ?? 0, Icon: FolderKanban,color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                        { label: 'Fichas',    value: profile.stats.totalFichas    ?? 0, Icon: GraduationCap,color:'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20' },
                      ].map(({ label, value, Icon, color, bg, border }) => (
                        <div key={label} className={`rounded-xl border p-3 text-center ${bg} ${border}`}>
                          <Icon size={14} className={`mx-auto mb-1 ${color}`} />
                          <p className={`text-xl font-black ${color}`}>{value}</p>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Indicador de salud del sistema */}
                    <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                        <Activity size={11} /> Salud del sistema
                      </p>
                      {(() => {
                        const total = profile.stats.totalUsers ?? 0;
                        const fichas = profile.stats.totalFichas ?? 0;
                        const proyectos = profile.stats.totalProyectos ?? 0;
                        const ratio = fichas > 0 ? Math.round((proyectos / fichas) * 10) / 10 : 0;
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-zinc-400">Promedio proyectos/ficha</span>
                              <span className={`font-black ${ratio >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{ratio}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-zinc-400">Total de usuarios registrados</span>
                              <span className="font-black text-sky-400">{total}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* ─ INSTRUCTOR ───────────────────────────────────── */}
                {profile.rol === 'instructor' && profile.stats && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Fichas',    value: profile.stats.fichas_count     ?? 0, color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
                        { label: 'Proyectos', value: profile.stats.proyectos_count  ?? 0, color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
                        { label: 'Activos',   value: profile.stats.proyectos_activos ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                      ].map(({ label, value, color, bg, border }) => (
                        <div key={label} className={`rounded-xl border p-3 text-center ${bg} ${border}`}>
                          <p className={`text-xl font-black ${color}`}>{value}</p>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Estado de proyectos en barra */}
                    {(profile.proyectos?.length ?? 0) > 0 && (
                      <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                          <TrendingUp size={11} /> Estado de proyectos
                        </p>
                        {['activo', 'pausado', 'finalizado'].map(estado => {
                          const count = profile.proyectos.filter((p: any) => p.estado === estado).length;
                          if (!count) return null;
                          const pct = Math.round((count / profile.proyectos.length) * 100);
                          const col = estado === 'activo' ? 'bg-emerald-500' : estado === 'pausado' ? 'bg-amber-500' : 'bg-slate-500';
                          const txt = estado === 'activo' ? 'text-emerald-400' : estado === 'pausado' ? 'text-amber-400' : 'text-slate-400';
                          return (
                            <div key={estado} className="flex items-center gap-2 mb-1.5 last:mb-0">
                              <span className={`text-[10px] w-16 capitalize font-bold ${txt}`}>{estado}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                                <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-zinc-400 w-4 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ─ LÍDER TÉCNICO ────────────────────────────────── */}
                {(profile.rol === 'aprendiz' && profile.es_lider_tecnico) && profile.stats && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Proyectos',   value: profile.stats.proyectos_count    ?? 0, Icon: FolderKanban, color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
                        { label: 'Equipo',      value: profile.stats.equipo_count        ?? 0, Icon: Users,        color: 'text-cyan-400',  bg: 'bg-cyan-500/10',  border: 'border-cyan-500/20' },
                        { label: 'Asignadas',   value: profile.stats.tickets_asignados   ?? 0, Icon: Ticket,       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
                        { label: 'Completadas', value: profile.stats.tickets_completados ?? 0, Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                      ].map(({ label, value, Icon, color, bg, border }) => (
                        <div key={label} className={`rounded-xl border p-3 flex items-center gap-2.5 ${bg} ${border}`}>
                          <Icon size={14} className={`${color} shrink-0`} />
                          <div>
                            <p className={`text-base font-black leading-tight ${color}`}>{value}</p>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Barra de tasa de completado */}
                    {(profile.stats.tickets_asignados ?? 0) > 0 && (
                      <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <TrendingUp size={11} /> Tasa de completado
                          </p>
                          {(() => {
                            const pct = Math.round(((profile.stats.tickets_completados ?? 0) / (profile.stats.tickets_asignados ?? 1)) * 100);
                            return <span className={`text-sm font-black ${pct >= 75 ? 'text-emerald-400' : pct >= 40 ? 'text-sky-400' : 'text-amber-400'}`}>{pct}%</span>;
                          })()}
                        </div>
                        {(() => {
                          const pct = Math.round(((profile.stats.tickets_completados ?? 0) / (profile.stats.tickets_asignados ?? 1)) * 100);
                          return (
                            <>
                              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : pct >= 40 ? 'bg-gradient-to-r from-sky-600 to-sky-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                <span>{profile.stats.tickets_completados ?? 0} completadas</span>
                                <span>{profile.stats.tickets_asignados ?? 0} totales</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {/* Alerta de tareas en revisión */}
                    {(() => {
                      const pending = (profile.tickets ?? []).filter((t: any) => t.estado === 'testing').length;
                      return pending > 0 ? (
                        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <Crown size={14} className="text-amber-400 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-amber-400">{pending} tarea{pending > 1 ? 's' : ''} en revisión</p>
                            <p className="text-[10px] text-zinc-500">Esperando tu aprobación como líder</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <p className="text-xs font-black text-emerald-400">Sin tareas pendientes de revisión</p>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ─ APRENDIZ ─────────────────────────────────────── */}
                {(profile.rol === 'aprendiz' && !profile.es_lider_tecnico) && profile.stats && (
                  <>
                    {/* Barra de progreso con color dinámico */}
                    <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-3">
                      {(() => {
                        const pct = profile.stats.progreso ?? 0;
                        const colorBar = pct >= 80 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                          : pct >= 50 ? 'bg-gradient-to-r from-sky-600 to-sky-400'
                          : 'bg-gradient-to-r from-amber-600 to-amber-400';
                        const colorTxt = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-sky-400' : 'text-amber-400';
                        const label = pct >= 80 ? '¡Excelente ritmo!' : pct >= 50 ? 'Buen avance' : 'Necesita impulso';
                        return (
                          <>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity size={11} /> Progreso general
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold ${colorTxt}`}>{label}</span>
                                <span className={`text-sm font-black ${colorTxt}`}>{pct}%</span>
                              </div>
                            </div>
                            <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${colorBar}`} style={{ width: `${pct}%` }} />
                            </div>
                            {/* Mini breakdown */}
                            <div className="grid grid-cols-3 gap-1 mt-2.5">
                              {(() => {
                                const total = profile.stats.tickets_total ?? 0;
                                const done  = profile.stats.tickets_completados ?? 0;
                                const prog  = profile.stats.tickets_en_progreso ?? 0;
                                const pend  = Math.max(0, total - done - prog);
                                return [
                                  { label: 'Pendientes',  value: pend, color: 'text-zinc-400' },
                                  { label: 'En progreso', value: prog, color: 'text-sky-400'  },
                                  { label: 'Completadas', value: done, color: 'text-emerald-400' },
                                ].map(s => (
                                  <div key={s.label} className="text-center">
                                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                                    <p className="text-[9px] text-zinc-600">{s.label}</p>
                                  </div>
                                ));
                              })()}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {/* Alerta de tareas críticas */}
                    {(() => {
                      const critical = (profile.tickets ?? []).filter((t: any) =>
                        (t.prioridad === 'critica' || t.prioridad === 'alta') && t.estado !== 'done'
                      ).length;
                      return critical > 0 ? (
                        <div className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                          <AlertCircle size={14} className="text-rose-400 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-rose-400">{critical} tarea{critical > 1 ? 's' : ''} de alta prioridad pendiente{critical > 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-zinc-500">Requieren atención pronto</p>
                          </div>
                        </div>
                      ) : (profile.stats.tickets_total ?? 0) > 0 ? (
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <p className="text-xs font-black text-emerald-400">Sin tareas urgentes pendientes ✓</p>
                        </div>
                      ) : null;
                    })()}
                  </>
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
                  <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 p-4 space-y-2">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Ticket size={12} /> Tareas recientes ({profile.tickets.length})
                    </h4>
                    {profile.tickets.slice(0, 8).map((t: any) => {
                      const priorityColor = t.prioridad === 'critica' ? 'text-rose-400' : t.prioridad === 'alta' ? 'text-amber-400' : 'text-zinc-500';
                      return (
                        <div key={t.id}
                          className="flex items-center gap-3 p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-700/40"
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.estado] || 'bg-slate-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-200 truncate">{t.titulo}</p>
                            <p className="text-[10px] capitalize">
                              <span className={`font-bold ${priorityColor}`}>{t.prioridad}</span>
                              <span className="text-zinc-600"> · {t.estado?.replace('_', ' ')}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
