/**
 * ProfilePage — Rediseñado con el sistema visual de Kanbana.
 * Banner + avatar superpuesto, tabs modernos, formularios con el estilo
 * zinc/dark consistente con el resto de la app.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import {
  User as UserIcon, Mail, Shield, Key, Save, CheckCircle2,
  Phone, FileText, GraduationCap, FolderKanban, Ticket,
  Hash, ExternalLink, Clock, AlertCircle, Camera, Loader2, Compass,
} from 'lucide-react';
import { WelcomeTour } from '../components/WelcomeTour';
import { AvatarUploader } from '../components/AvatarUploader';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/user.service';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  coordinador:   'Coordinador',
  instructor:    'Instructor',
  lider_tecnico: 'Líder Técnico',
  aprendiz:      'Aprendiz',
};

const ROL_COLORS: Record<string, string> = {
  coordinador:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  instructor:    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  aprendiz:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const ROL_DEFAULT_BANNER: Record<string, string> = {
  coordinador:   'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #1e1b4b 100%)',
  instructor:    'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #0f172a 100%)',
  lider_tecnico: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #022c22 100%)',
  aprendiz:      'linear-gradient(135deg, #78350f 0%, #d97706 50%, #451a03 100%)',
};

const STATUS_DOT: Record<string, string> = {
  to_do: 'bg-slate-500', in_progress: 'bg-blue-500',
  testing: 'bg-amber-500', done: 'bg-emerald-500',
};

type Tab = 'general' | 'actividad' | 'seguridad';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-colors placeholder:text-zinc-600";
const inputIconCls = "w-full bg-zinc-800/60 border border-zinc-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-colors placeholder:text-zinc-600";

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab,  setActiveTab]  = useState<Tab>('general');
  const [saved,      setSaved]      = useState(false);
  const [pwdMsg,     setPwdMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [bannerUrl,  setBannerUrl]  = useState<string | null>(user?.banner_url || null);
  const [showTour,   setShowTour]   = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn:  () => userService.getProfile(user!.id),
    enabled:  !!user?.id,
    staleTime: 60_000,
  });

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      nombre:   user?.nombre   || '',
      telefono: user?.telefono || '',
      bio:      user?.bio      || '',
    },
  });

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors },
  } = useForm<{ actual: string; nueva: string; confirmar: string }>();

  const updateMutation = useMutation({
    mutationFn: (data: any) => userService.update(user!.id, data),
    onSuccess: (updated) => {
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const pwdMutation = useMutation({
    mutationFn: (data: { actual: string; nueva: string }) =>
      userService.changeOwnPassword(user!.id, data.actual, data.nueva),
    onSuccess: () => {
      setPwdMsg({ type: 'ok', text: 'Contraseña actualizada correctamente' });
      resetPwd();
      // Refrescar el contador de cambios del día
      qc.invalidateQueries({ queryKey: ['user-profile', user?.id] });
      setTimeout(() => setPwdMsg(null), 4000);
    },
    onError: (err: any) => {
      setPwdMsg({ type: 'err', text: err?.response?.data?.message || 'Error al cambiar contraseña' });
    },
  });

  // Crear contraseña por primera vez (usuarios Google/GitHub sin contraseña propia)
  const setPwdMutation = useMutation({
    mutationFn: (data: { nueva: string }) => userService.setInitialPassword(data.nueva),
    onSuccess: () => {
      setPwdMsg({ type: 'ok', text: 'Contraseña creada. Ya puedes iniciar sesión con tu correo desde la landing.' });
      resetPwd();
      updateUser({ password_set: true } as any);
      // Refrescar el contador de cambios del día
      qc.invalidateQueries({ queryKey: ['user-profile', user?.id] });
      setTimeout(() => setPwdMsg(null), 5000);
    },
    onError: (err: any) => {
      setPwdMsg({ type: 'err', text: err?.response?.data?.message || 'Error al crear la contraseña' });
    },
  });

  const bannerMutation = useMutation({
    mutationFn: (file: File) => userService.uploadBanner(user!.id, file),
    onSuccess: (data: any) => {
      const url = data?.banner_url || data?.url || null;
      setBannerUrl(url);
      updateUser({ banner_url: url });
    },
  });

  if (!user) return null;

  // Usuario de Google/GitHub que aún no ha creado su contraseña propia
  const needsCreatePwd = user.password_set === false;

  // ── Límite de cambios de contraseña ──────────────────────────────────────
  // Calculamos cuántos cambios usó el usuario HOY para mostrarlo proactivamente.
  const today = new Date().toISOString().slice(0, 10);
  const pwdLastDate = profile?.password_last_change_date
    ? new Date(profile.password_last_change_date).toISOString().slice(0, 10)
    : null;
  const changesUsedToday  = pwdLastDate === today ? (profile?.password_changes_today ?? 0) : 0;
  const changesRemaining  = Math.max(0, 2 - changesUsedToday);

  const nueva = watchPwd('nueva');
  const rolEfectivo = user.rol === 'aprendiz' && (user as any).es_lider_tecnico ? 'lider_tecnico' : user.rol;
  const bannerStyle = bannerUrl
    ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: ROL_DEFAULT_BANNER[rolEfectivo] || ROL_DEFAULT_BANNER.aprendiz };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general',   label: 'General',   icon: UserIcon    },
    { id: 'actividad', label: 'Actividad', icon: FolderKanban },
    { id: 'seguridad', label: 'Seguridad', icon: Shield      },
  ];

  // Stats según rol
  const stats = (() => {
    if (!profile?.stats) return [];
    if (user.rol === 'aprendiz' && !(user as any).es_lider_tecnico) return [
      { label: 'Tickets',     value: profile.stats.tickets_total      ?? 0 },
      { label: 'Completados', value: profile.stats.tickets_completados ?? 0 },
      { label: 'En progreso', value: profile.stats.tickets_en_progreso ?? 0 },
      { label: 'Progreso',    value: `${profile.stats.progreso ?? 0}%` },
    ];
    if ((user as any).es_lider_tecnico) return [
      { label: 'Proyectos', value: profile.stats.proyectos_count    ?? 0 },
      { label: 'Equipo',    value: profile.stats.equipo_count       ?? 0 },
      { label: 'Tickets',   value: profile.stats.tickets_asignados  ?? 0 },
    ];
    if (user.rol === 'instructor') return [
      { label: 'Fichas',    value: profile.stats.fichas_count    ?? 0 },
      { label: 'Proyectos', value: profile.stats.proyectos_count ?? 0 },
    ];
    if (user.rol === 'coordinador') return [
      { label: 'Usuarios',  value: profile.stats.totalUsers     ?? 0 },
      { label: 'Proyectos', value: profile.stats.totalProyectos ?? 0 },
      { label: 'Fichas',    value: profile.stats.totalFichas    ?? 0 },
    ];
    return [];
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-0">

      {/* ── Tarjeta superior: banner + avatar + info + tabs ─────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-black/30">

        {/* Banner */}
        <div className="relative h-44 w-full" style={bannerStyle}>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/70 via-transparent to-transparent" />
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerMutation.isPending}
            className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest rounded-xl border border-white/20 transition-all"
          >
            {bannerMutation.isPending
              ? <Loader2 size={11} className="animate-spin" />
              : <Camera size={11} />
            }
            {bannerMutation.isPending ? 'Subiendo…' : 'Cambiar portada'}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) bannerMutation.mutate(f); }}
          />
        </div>

        {/* Avatar + nombre + rol */}
        <div className="px-6 pb-0">
          <div className="flex items-end gap-5 -mt-12">
            {/* Avatar con borde que separa del banner */}
            <div className="ring-4 ring-zinc-900 rounded-full shrink-0 shadow-lg">
              <AvatarUploader
                userId={user.id}
                currentUrl={user.avatar_url}
                nombre={user.nombre}
                size="xl"
                editable={true}
                onSuccess={(avatarUrl) => updateUser({ avatar_url: avatarUrl })}
              />
            </div>

            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-[22px] font-black text-white tracking-tight leading-tight truncate">
                  {user.nombre}
                </h2>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest shrink-0 ${ROL_COLORS[rolEfectivo] || ROL_COLORS.aprendiz}`}>
                  {ROL_LABELS[rolEfectivo] || user.rol}
                </span>
              </div>
              {user.bio && (
                <p className="text-[13px] text-zinc-400 mt-1 line-clamp-1 italic">{user.bio}</p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 mt-4 border-t border-zinc-800/80">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-black border-b-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === id
                    ? 'text-white border-white'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido del tab activo ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── GENERAL ─────────────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <motion.div
            key="general"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5"
          >
            {/* Formulario datos personales */}
            <div className="md:col-span-2">
              <form onSubmit={handleSubmit(d => updateMutation.mutate(d))}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-md shadow-black/20"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <UserIcon size={15} className="text-zinc-500" />
                  <h3 className="text-[12px] font-black text-zinc-400 uppercase tracking-widest">Datos personales</h3>
                </div>

                <Field label="Nombre completo">
                  <div className="relative">
                    <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      {...register('nombre')}
                      type="text"
                      placeholder="Tu nombre completo"
                      className={inputIconCls}
                    />
                  </div>
                </Field>

                <Field label="Teléfono">
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      {...register('telefono')}
                      type="tel"
                      placeholder="+57 300 000 0000"
                      className={inputIconCls}
                    />
                  </div>
                </Field>

                <Field label="Biografía">
                  <div className="relative">
                    <FileText size={14} className="absolute left-3 top-3.5 text-zinc-500 pointer-events-none" />
                    <textarea
                      {...register('bio')}
                      rows={3}
                      placeholder="Cuéntanos algo sobre ti..."
                      className={`${inputIconCls} resize-none`}
                    />
                  </div>
                </Field>

                <Field label="Correo electrónico">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      value={user.correo}
                      disabled
                      className="w-full bg-zinc-800/30 border border-zinc-700/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 ml-1">El correo no puede cambiarse desde aquí</p>
                </Field>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={!isDirty || updateMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20"
                  >
                    {updateMutation.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                      : <><Save size={13} /> Guardar cambios</>
                    }
                  </button>
                  <AnimatePresence>
                    {saved && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-emerald-400 text-[12px] font-bold"
                      >
                        <CheckCircle2 size={14} /> Guardado
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </div>

            {/* Panel lateral: detalles + stats */}
            <div className="space-y-4">
              {/* Detalles */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md shadow-black/20 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <Shield size={14} className="text-zinc-500" />
                  <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Detalles</h3>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Correo</p>
                    <p className="text-[13px] font-semibold text-zinc-200 break-all">{user.correo}</p>
                  </div>
                  {user.telefono && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Teléfono</p>
                      <p className="text-[13px] font-semibold text-zinc-200">{user.telefono}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Rol</p>
                    <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${ROL_COLORS[rolEfectivo] || ''}`}>
                      {ROL_LABELS[rolEfectivo] || user.rol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              {stats.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md shadow-black/20">
                  <div className="flex items-center gap-2 pb-3 border-b border-zinc-800 mb-4">
                    <Ticket size={14} className="text-zinc-500" />
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Actividad</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {stats.map(s => (
                      <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center border border-zinc-700/40">
                        <p className="text-[20px] font-black text-zinc-100 leading-tight">{s.value}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── ACTIVIDAD ────────────────────────────────────────────────────── */}
        {activeTab === 'actividad' && (
          <motion.div
            key="actividad"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-4 pt-5"
          >
            {/* Bio / "Trabajar conmigo" */}
            {user.bio && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md shadow-black/20">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <UserIcon size={13} /> Trabajar conmigo
                </h3>
                <p className="text-[14px] text-zinc-300 leading-relaxed">{user.bio}</p>
              </div>
            )}

            {/* Fichas (instructor) */}
            {user.rol === 'instructor' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md shadow-black/20 space-y-3">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap size={13} /> Mis Fichas ({profile?.fichas?.length ?? 0})
                </h3>
                {!profile?.fichas?.length ? (
                  <p className="text-[13px] text-zinc-600 italic">No tienes fichas asignadas aún</p>
                ) : profile.fichas.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 p-3.5 bg-zinc-800/50 rounded-xl border border-zinc-700/40 hover:border-zinc-600 transition-colors">
                    <div className="w-8 h-8 bg-primary-500/10 rounded-lg flex items-center justify-center shrink-0">
                      <Hash size={14} className="text-primary-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-zinc-200">{f.programa}</p>
                      <p className="text-[11px] text-zinc-500">Ficha {f.codigo} · {f.fecha_inicio} → {f.fecha_fin}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Proyectos */}
            {profile?.proyectos?.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md shadow-black/20 space-y-3">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <FolderKanban size={13} /> Mis Proyectos ({profile.proyectos.length})
                </h3>
                {profile.proyectos.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3.5 bg-zinc-800/50 rounded-xl border border-zinc-700/40 hover:border-zinc-600 transition-colors group">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      p.estado === 'activo' ? 'bg-emerald-500' :
                      p.estado === 'pausado' ? 'bg-amber-500' : 'bg-zinc-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-zinc-200 truncate">{p.nombre}</p>
                      <p className="text-[11px] text-zinc-500 capitalize">{p.estado} · {p.ficha?.codigo || '—'}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/projects/${p.id}/kanban`)}
                      className="p-2 text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tickets */}
            {profile?.tickets?.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md shadow-black/20 space-y-4">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Ticket size={13} /> Mis Tickets ({profile.tickets.length})
                </h3>

                {/* Barra de progreso para aprendiz */}
                {user.rol === 'aprendiz' && profile.stats?.progreso !== undefined && (
                  <div>
                    <div className="flex justify-between text-[11px] mb-2">
                      <span className="text-zinc-500 font-medium">Progreso general</span>
                      <span className="text-blue-400 font-black">{profile.stats.progreso}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${profile.stats.progreso}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        { icon: CheckCircle2, label: 'Completados', value: profile.stats.tickets_completados, color: 'text-emerald-400' },
                        { icon: Clock,        label: 'En progreso', value: profile.stats.tickets_en_progreso,  color: 'text-blue-400'   },
                        { icon: AlertCircle,  label: 'Total',       value: profile.stats.tickets_total,        color: 'text-zinc-300'   },
                      ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="bg-zinc-800/50 rounded-xl p-3 text-center border border-zinc-700/40">
                          <Icon size={15} className={`${color} mx-auto mb-1.5`} />
                          <p className="text-[16px] font-black text-zinc-100">{value}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {profile.tickets.slice(0, 15).map((t: any) => (
                    <a
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 transition-all group"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.estado] || 'bg-zinc-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-zinc-300 truncate group-hover:text-zinc-100 transition-colors">{t.titulo}</p>
                        <p className="text-[11px] text-zinc-600 capitalize">{t.prioridad} · {t.estado?.replace('_', ' ')}</p>
                      </div>
                      <ExternalLink size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!profile?.fichas?.length && !profile?.proyectos?.length && !profile?.tickets?.length && (
              <div className="text-center py-20 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl">
                <FolderKanban size={32} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-[13px] font-black text-zinc-600 uppercase tracking-widest">Sin actividad registrada aún</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── SEGURIDAD ────────────────────────────────────────────────────── */}
        {activeTab === 'seguridad' && (
          <motion.div
            key="seguridad"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="pt-5 max-w-lg"
          >
            <form
              onSubmit={handlePwd(data => {
                if (data.nueva !== data.confirmar) {
                  setPwdMsg({ type: 'err', text: 'Las contraseñas no coinciden' });
                  return;
                }
                if (needsCreatePwd) {
                  // Crear contraseña por primera vez (sin "actual")
                  setPwdMutation.mutate({ nueva: data.nueva });
                  return;
                }
                if (data.nueva === data.actual) {
                  setPwdMsg({ type: 'err', text: 'La nueva contraseña es igual a la actual. Elige una diferente.' });
                  return;
                }
                pwdMutation.mutate({ actual: data.actual, nueva: data.nueva });
              })}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-md shadow-black/20"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <Key size={15} className="text-zinc-500" />
                <h3 className="text-[12px] font-black text-zinc-400 uppercase tracking-widest">
                  {needsCreatePwd ? 'Crear contraseña' : 'Cambiar contraseña'}
                </h3>
              </div>

              {/* Indicador de cambios de contraseña restantes hoy */}
              {!needsCreatePwd && (
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-[11px] font-semibold ${
                  changesUsedToday === 0
                    ? 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500'
                    : changesUsedToday === 1
                      ? 'bg-amber-500/8 border-amber-500/25 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="shrink-0" />
                    <span>
                      {changesUsedToday === 0
                        ? '2 cambios disponibles hoy'
                        : changesUsedToday === 1
                          ? '1 de 2 cambios usados hoy'
                          : 'Límite diario alcanzado'}
                    </span>
                  </div>
                  {/* Indicador visual de "slots" */}
                  <div className="flex items-center gap-1">
                    {[1, 2].map(n => (
                      <div
                        key={n}
                        className={`w-3 h-3 rounded-full border ${
                          n <= changesUsedToday
                            ? changesRemaining === 0
                              ? 'bg-rose-500 border-rose-500'
                              : 'bg-amber-500 border-amber-500'
                            : 'bg-transparent border-zinc-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Botón: volver a ver el tour de bienvenida */}
              <button
                type="button"
                onClick={() => setShowTour(true)}
                className="w-full flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/30 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                    <Compass size={16} className="text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-black text-zinc-200">Ver tutorial</p>
                    <p className="text-[11px] text-zinc-500">Recorrido guiado por la plataforma</p>
                  </div>
                </div>
                <ExternalLink size={14} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
              </button>

              {/* Aviso para usuarios de Google/GitHub */}
              {needsCreatePwd && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                  <AlertCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-blue-300/90 leading-relaxed">
                    Entraste con Google/GitHub. Crea una contraseña para también poder
                    iniciar sesión con tu correo desde la página de inicio de Kanbana.
                  </p>
                </div>
              )}

              {[
                ...(needsCreatePwd ? [] : [{ label: 'Contraseña actual', name: 'actual', rules: { required: 'Campo obligatorio' } }]),
                { label: 'Nueva contraseña',     name: 'nueva',     rules: {
                  required: 'Campo obligatorio',
                  validate: (v: string, formValues: any) => {
                    if (v.length < 7)     return 'Mínimo 7 caracteres';
                    if (!/[A-Z]/.test(v)) return 'Incluye al menos una letra mayúscula';
                    if (!/[0-9]/.test(v)) return 'Incluye al menos un número';
                    // Check inmediato: nueva igual a actual
                    if (formValues?.actual && v === formValues.actual) {
                      return 'La nueva contraseña es igual a la actual. Elige una diferente.';
                    }
                    return true;
                  },
                }},
                { label: 'Confirmar contraseña', name: 'confirmar', rules: {
                  required: 'Campo obligatorio',
                  validate: (v: string) => v === nueva || 'Las contraseñas no coinciden',
                }},
              ].map(({ label, name, rules }) => (
                <div key={name} className="space-y-1.5">
                  <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      {...regPwd(name as any, rules)}
                      type="password"
                      placeholder="••••••••"
                      className={inputIconCls}
                    />
                  </div>
                  {pwdErrors[name as keyof typeof pwdErrors] ? (
                    <p className="text-[11px] text-rose-400 ml-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      {(pwdErrors[name as keyof typeof pwdErrors] as any)?.message}
                    </p>
                  ) : name === 'nueva' ? (
                    <p className="text-[11px] text-zinc-600 ml-1">Mínimo 7 caracteres, una mayúscula y un número.</p>
                  ) : null}
                </div>
              ))}

              <AnimatePresence>
                {pwdMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-[12px] font-semibold ${
                      pwdMsg.type === 'ok'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {pwdMsg.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {pwdMsg.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={pwdMutation.isPending || setPwdMutation.isPending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl text-[12px] transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {(pwdMutation.isPending || setPwdMutation.isPending)
                  ? <><Loader2 size={14} className="animate-spin" /> {needsCreatePwd ? 'Creando…' : 'Actualizando…'}</>
                  : <><Key size={14} /> {needsCreatePwd ? 'Crear contraseña' : 'Actualizar contraseña'}</>
                }
              </button>
            </form>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Tour de bienvenida forzado (cuando el usuario clic "Ver tutorial") */}
      {showTour && <WelcomeTour forced onClose={() => setShowTour(false)} />}
    </div>
  );
};
