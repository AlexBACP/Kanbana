/**
 * ProfilePage — Perfil propio con upload real de avatar y secciones
 * enriquecidas según el rol del usuario autenticado.
 * Rediseñado con layout estilo Atlassian Teams:
 *   - Banner de portada ancho (imagen por defecto según rol o subida por usuario)
 *   - Avatar circular superpuesto sobre el banner con edición
 *   - Tabs horizontales
 *   - Sección bio + detalles lateral
 */
import { useState, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import {
  User as UserIcon, Mail, Shield, Key, Save, CheckCircle2,
  Phone, FileText, GraduationCap, FolderKanban, Ticket,
  Hash, ExternalLink, Clock, AlertCircle, Camera,
} from 'lucide-react';
import { Button } from '../components/Button';
import { AvatarUploader } from '../components/AvatarUploader';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { userService } from '../services/user.service';
import { motion } from 'framer-motion';

const ROL_LABELS: Record<string, string> = {
  coordinador:   'Coordinador',
  instructor:    'Instructor',
  lider_tecnico: 'Líder Técnico',
  aprendiz:      'Aprendiz',
};
const ROL_COLORS: Record<string, string> = {
  coordinador:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  instructor:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  aprendiz:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
};
const STATUS_DOT: Record<string, string> = {
  to_do: 'bg-slate-500', in_progress: 'bg-blue-500',
  testing: 'bg-amber-500', done: 'bg-emerald-500',
};

// Portadas por defecto según rol (gradientes CSS únicos por rol)
const ROL_DEFAULT_BANNER: Record<string, string> = {
  coordinador:   'linear-gradient(135deg, #4c1d95 0%, #7c3aed 40%, #2e1065 100%)',
  instructor:    'linear-gradient(135deg, #1e3a5f 0%, #2563eb 40%, #0f172a 100%)',
  lider_tecnico: 'linear-gradient(135deg, #064e3b 0%, #059669 40%, #022c22 100%)',
  aprendiz:      'linear-gradient(135deg, #78350f 0%, #d97706 40%, #451a03 100%)',
};

type Tab = 'general' | 'actividad' | 'seguridad';

export const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(user?.banner_url || null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Perfil enriquecido (fichas, proyectos, tickets)
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: () => userService.getProfile(user!.id),
    enabled: !!user?.id,
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
      setTimeout(() => setPwdMsg(null), 3000);
    },
    onError: (err: any) => {
      setPwdMsg({ type: 'err', text: err?.response?.data?.message || 'Error al cambiar contraseña' });
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

  const onSave = (data: any) => updateMutation.mutate(data);

  const onChangePwd = (data: { actual: string; nueva: string; confirmar: string }) => {
    if (data.nueva !== data.confirmar) {
      setPwdMsg({ type: 'err', text: 'Las contraseñas no coinciden' });
      return;
    }
    pwdMutation.mutate({ actual: data.actual, nueva: data.nueva });
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    bannerMutation.mutate(file);
  };

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'general',   label: 'General',   icon: UserIcon },
    { id: 'actividad', label: 'Actividad', icon: FolderKanban },
    { id: 'seguridad', label: 'Seguridad', icon: Shield },
  ];

  const nueva = watchPwd('nueva');
  const bannerStyle = bannerUrl
    ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: ROL_DEFAULT_BANNER[user.rol] || ROL_DEFAULT_BANNER['aprendiz'] };
//flex-1 overflow-y-auto p-0
  return (
    <div className="max-w-100% ">

      {/* ── Banner de portada + Avatar superpuesto ──────────────────── */}
      <div className="bg-[#1f1f21] border border-dark-border overflow-hidden mt-0">

        {/* Banner */}
        <div className="relative h-40 w-full" style={bannerStyle}>
          {/* Overlay sutil para legibilidad */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Botón subir portada */}
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerMutation.isPending}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/20 transition-all"
          >
            <Camera size={11} />
            {bannerMutation.isPending ? 'Subiendo…' : 'Cambiar portada'}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerChange}
          />
        </div>

        {/* Avatar superpuesto + info */}
        <div className="px-6 pb-5">
          {/* Avatar con offset negativo para superposición */}
          <div className="flex flex-col items-start gap-4 -mt-16 ">
            <div className="ring-4 ring-dark-card rounded-full shrink-0">
              <AvatarUploader
                userId={user.id}
                currentUrl={user.avatar_url}
                nombre={user.nombre}
                size="xl"
                editable={true}
                onSuccess={(avatarUrl) => updateUser({ avatar_url: avatarUrl })}
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-black text-white tracking-tight">{user.nombre}</h2>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${ROL_COLORS[user.rol] || ''}`}>
                  {ROL_LABELS[user.rol] || user.rol}
                </span>
              </div>
              
            </div>
          </div>

          {/* Bio corta si existe */}
          {user.bio && (
            <p className="text-sm text-white-muted italic mb-4 line-clamp-2 border-l-2 border-dark-border pl-3">
              {user.bio}
            </p>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-[#1f1f21] rounded-xl p-1 ">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === id
                    ? 'bg-dark-card text-primary-400 border border-dark-border shadow'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                <Icon size={0} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Espaciado entre header y contenido de tab ──────────────── */}
      <div className="mt-0 space-y-5">

        {/* ── Tab: General ──────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Layout 2 columnas en pantallas medianas */}
            <div className="grid grid-cols-1 md:grid-cols-3 ">

              {/* Col izquierda: formulario datos personales */}
              <div className="md:col-span-2 border-r border-[#30363d] left-xl ">
                <form onSubmit={handleSubmit(onSave)} className="bg-[#1f1f21] p-6 space-y-5 items-start">
                  <h3 className="text-lg font-black  text-dark-muted uppercase tracking-widest flex items-center gap-2">
                    <UserIcon size={0} /> Datos personales
                  </h3>

                  {[
                    { label: 'Nombre completo', name: 'nombre',   type: 'text', icon: UserIcon, placeholder: 'Tu nombre' },
                    { label: 'Teléfono',        name: 'telefono', type: 'tel',  icon: Phone,    placeholder: '+57 300 000 0000' },
                  ].map(({ label, name, type, icon: Icon, placeholder }) => (
                    <div key={name} className="space-y-1.5">
                      <label className="text-[12px] font-black text-dark-muted uppercase tracking-widest ">{label}</label>
                      <div className="relative">
                        <Icon size={0} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                        <input
                          {...register(name as any)}
                          type={type}
                          placeholder={placeholder}
                          className="bg-[#1f1f21] p-1 w-120 hover:bg-[#3a3a3f] hover:rounded-lg hover:w-xl hover:p-1"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-black text-dark-muted uppercase tracking-widest">Biografía</label>
                    <div className="relative">
                      <FileText size={0} className="absolute left-3 top-3 text-dark-muted" />
                      <textarea
                        {...register('bio')}
                        rows={3}
                        placeholder="Cuéntanos algo sobre ti..."
                        className="bg-[#1f1f21] p-1 w-full resize-none hover:bg-[#3a3a3f] hover:rounded-lg hover:w-full hover:p-1"
                      />
                    </div>
                  </div>

                  {/* Correo (no editable) */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-black text-dark-muted uppercase tracking-widest">Correo electrónico</label>
                    <div className="relative">
                      <Mail size={0} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                      <input
                        value={user.correo}
                        disabled
                        className="w-80 bg-[#1f1f21] h-7 p-1 hover:bg-[#3a3a3f] hover:p-1 hover:w-xl hover:h-7 hover:rounded-lg cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[12px] text-dark-muted">El correo no puede cambiarse desde aquí</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={!isDirty}
                      isLoading={updateMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Save size={0} /> Guardar cambios
                    </Button>
                    {saved && (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-black">
                        <CheckCircle2 size={14} /> Guardado
                      </span>
                    )}
                  </div>
                </form>
              </div>

              {/* Col derecha: Detalles rápidos (estilo Atlassian sidebar) */}
              <div className=" items-center justify-center">
                <div className="bg-[#1f1f21] p-5 mx-full">
                  <h3 className="text-center font-black text-white-muted uppercase tracking-widest">Detalles</h3>

                  <div className="space-y-3 items-center justify-center text-center">
                    <div className="flex gap-2.5 justify-center">
                      <Mail size={0} className="text-dark-muted mt-0.5 shrink-0" />
                      <div className='mt-2'>
                        <p className="text-[9px] text-center text-dark-muted uppercase tracking-wider">Correo electrónico</p>
                        <p className="text-lg font-bold text-white-text break-all">{user.correo}</p>
                      </div>
                    </div>
                    {user.telefono && (
                      <div className="flex  gap-2.5 justify-center">
                        <Phone size={0} className="text-dark-muted mt-0.5 shrink-0" />
                        <div className='text center item-center'>
                          <p className="text-[9px] text-dark-muted uppercase tracking-wider">Teléfono</p>
                          <p className="text-lg font-bold text-white">{user.telefono}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2.5 justify-center">
                      <Shield size={0} className="text-dark-muted mt-0.5 shrink-0" />
                      <div className=''>
                        <p className="text-[9px] text-dark-muted uppercase tracking-wider">Rol</p>
                        <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${ROL_COLORS[user.rol] || ''}`}>
                          {ROL_LABELS[user.rol] || user.rol}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats rápidos según rol */}
                {profile?.stats && (
                  <div className="bg-[#1f1f21] mx-full p-2 space-y-3">
                    <h3 className="text-center font-black text-white-muted uppercase tracking-widest">Actividad</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {user.rol === 'aprendiz' && [
                        { label: 'Tickets',     value: profile.stats.tickets_total ?? 0 },
                        { label: 'Completados', value: profile.stats.tickets_completados ?? 0 },
                        { label: 'En progreso', value: profile.stats.tickets_en_progreso ?? 0 },
                        { label: 'Progreso',    value: `${profile.stats.progreso ?? 0}%` },
                      ].map(s => (
                        <div key={s.label} className="bg-dark-bg/60 rounded-xl border border-dark-border p-2.5 text-center">
                          <p className="text-sm font-black text-dark-text">{s.value}</p>
                          <p className="text-[9px] text-dark-muted uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                      {user.rol === 'instructor' && [
                        { label: 'Fichas',    value: profile.stats.fichas_count ?? 0 },
                        { label: 'Proyectos', value: profile.stats.proyectos_count ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="bg-dark-bg/60 rounded-xl border border-dark-border p-2.5 text-center">
                          <p className="text-sm font-black text-dark-text">{s.value}</p>
                          <p className="text-[9px] text-dark-muted uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                      {user.rol === 'aprendiz' && user.es_lider_tecnico && [
                        { label: 'Proyectos', value: profile.stats.proyectos_count ?? 0 },
                        { label: 'Equipo',    value: profile.stats.equipo_count ?? 0 },
                        { label: 'Tickets',   value: profile.stats.tickets_asignados ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="bg-dark-bg/60 rounded-xl border border-dark-border p-2.5 text-center">
                          <p className="text-sm font-black text-dark-text">{s.value}</p>
                          <p className="text-[9px] text-dark-muted uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                      {user.rol === 'coordinador' && [
                        { label: 'Usuarios',  value: profile.stats.totalUsers ?? 0 },
                        { label: 'Proyectos', value: profile.stats.totalProyectos ?? 0 },
                        { label: 'Fichas',    value: profile.stats.totalFichas ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="bg-dark-bg/60 rounded-xl border border-dark-border p-2.5 text-center">
                          <p className="text-sm font-black text-dark-text">{s.value}</p>
                          <p className="text-[9px] text-dark-muted uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Actividad ─────────────────────────────────────────────── */}
        {activeTab === 'actividad' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Trabajar conmigo / Bio completa */}
            {user.bio && (
              <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
                <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2 mb-3">
                  <UserIcon size={12} /> Trabajar conmigo
                </h3>
                <p className="text-sm text-dark-text leading-relaxed">{user.bio}</p>
              </div>
            )}

            {/* Fichas (instructor) */}
            {user.rol === 'instructor' && (
              <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
                <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap size={12} /> Mis Fichas ({profile?.fichas?.length ?? 0})
                </h3>
                {!profile?.fichas?.length ? (
                  <p className="text-xs text-dark-muted italic">No tienes fichas asignadas aún</p>
                ) : profile.fichas.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-dark-bg/60 rounded-xl border border-dark-border/50">
                    <div className="p-2 bg-primary-500/10 rounded-xl">
                      <Hash size={13} className="text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-dark-text">{f.programa}</p>
                      <p className="text-[10px] text-dark-muted">Ficha {f.codigo} · {f.fecha_inicio} → {f.fecha_fin}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Proyectos */}
            {profile?.proyectos?.length > 0 && (
              <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
                <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
                  <FolderKanban size={12} /> Mis Proyectos ({profile.proyectos.length})
                </h3>
                {profile.proyectos.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-dark-bg/60 rounded-xl border border-dark-border/50">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      p.estado === 'activo' ? 'bg-emerald-500' :
                      p.estado === 'pausado' ? 'bg-amber-500' : 'bg-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-dark-text truncate">{p.nombre}</p>
                      <p className="text-[10px] text-dark-muted capitalize">{p.estado} · {p.ficha?.codigo || ''}</p>
                    </div>
                    <a href={`/projects/${p.id}/kanban`} className="p-1.5 text-dark-muted hover:text-primary-400 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Tickets */}
            {profile?.tickets?.length > 0 && (
              <div className="bg-dark-card border border-dark-border rounded-[2rem] p-5 space-y-4">
                <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
                  <Ticket size={12} /> Mis Tickets ({profile.tickets.length})
                </h3>
                {/* Barra de progreso para aprendiz */}
                {user.rol === 'aprendiz' && profile.stats?.progreso !== undefined && (
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-dark-muted">Progreso</span>
                      <span className="text-primary-400 font-black">{profile.stats.progreso}%</span>
                    </div>
                    <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all"
                        style={{ width: `${profile.stats.progreso}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        { icon: CheckCircle2, label: 'Completados', value: profile.stats.tickets_completados, color: 'text-emerald-400' },
                        { icon: Clock,        label: 'En progreso', value: profile.stats.tickets_en_progreso,  color: 'text-blue-400'   },
                        { icon: AlertCircle,  label: 'Total',       value: profile.stats.tickets_total,         color: 'text-dark-text'  },
                      ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="bg-dark-bg/60 rounded-xl p-2.5 text-center border border-dark-border">
                          <Icon size={14} className={`${color} mx-auto mb-1`} />
                          <p className="text-sm font-black text-dark-text">{value}</p>
                          <p className="text-[9px] text-dark-muted">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {profile.tickets.slice(0, 15).map((t: any) => (
                    <a key={t.id} href={`/tickets/${t.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-dark-bg/60 border border-dark-border/50 hover:border-primary-500/30 transition-all group"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.estado] || 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-dark-text truncate group-hover:text-primary-400 transition-colors">{t.titulo}</p>
                        <p className="text-[10px] text-dark-muted capitalize">{t.prioridad} · {t.estado?.replace('_', ' ')}</p>
                      </div>
                      <ExternalLink size={11} className="text-dark-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!profile?.fichas?.length && !profile?.proyectos?.length && !profile?.tickets?.length && (
              <div className="text-center py-16 bg-dark-card/20 rounded-[2rem] border border-dashed border-dark-border">
                <FolderKanban size={28} className="mx-auto text-dark-muted mb-3 opacity-30" />
                <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin actividad registrada aún</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: Seguridad ─────────────────────────────────────────────── */}
        {activeTab === 'seguridad' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <form onSubmit={handlePwd(onChangePwd)} className="bg-dark-card border border-dark-border rounded-[2rem] p-6 space-y-5">
              <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
                <Key size={12} /> Cambiar contraseña
              </h3>

              {[
                { label: 'Contraseña actual',   name: 'actual',    rules: { required: 'Campo obligatorio' } },
                { label: 'Nueva contraseña',    name: 'nueva',     rules: { required: 'Campo obligatorio', minLength: { value: 6, message: 'Mínimo 6 caracteres' } } },
                { label: 'Confirmar contraseña', name: 'confirmar', rules: {
                  required: 'Campo obligatorio',
                  validate: (v: string) => v === nueva || 'Las contraseñas no coinciden',
                }},
              ].map(({ label, name, rules }) => (
                <div key={name} className="space-y-1.5">
                  <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{label}</label>
                  <div className="relative">
                    <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                    <input
                      {...regPwd(name as any, rules)}
                      type="password"
                      className="input-dark pl-9 w-full"
                      placeholder="••••••••"
                    />
                  </div>
                  {pwdErrors[name as keyof typeof pwdErrors] && (
                    <p className="text-xs text-rose-400">{(pwdErrors[name as keyof typeof pwdErrors] as any)?.message}</p>
                  )}
                </div>
              ))}

              {pwdMsg && (
                <p className={`text-xs ${pwdMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1.5`}>
                  {pwdMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {pwdMsg.text}
                </p>
              )}

              <Button type="submit" isLoading={pwdMutation.isPending} className="w-full py-3">
                Actualizar contraseña
              </Button>
            </form>
          </motion.div>
        )}

      </div>
    </div>
  );
};