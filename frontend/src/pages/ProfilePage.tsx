/**
 * ProfilePage — Perfil propio con upload real de avatar y secciones
 * enriquecidas según el rol del usuario autenticado.
 */
import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import {
  User as UserIcon, Mail, Shield, Key, Save, CheckCircle2,
  Phone, FileText, GraduationCap, FolderKanban, Ticket,
  Hash, ExternalLink, Clock, AlertCircle,
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

type Tab = 'general' | 'actividad' | 'seguridad';

export const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  const onSave = (data: any) => updateMutation.mutate(data);

  const onChangePwd = (data: { actual: string; nueva: string; confirmar: string }) => {
    if (data.nueva !== data.confirmar) {
      setPwdMsg({ type: 'err', text: 'Las contraseñas no coinciden' });
      return;
    }
    pwdMutation.mutate({ actual: data.actual, nueva: data.nueva });
  };

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'general',   label: 'General',   icon: UserIcon },
    { id: 'actividad', label: 'Actividad', icon: FolderKanban },
    { id: 'seguridad', label: 'Seguridad', icon: Shield },
  ];

  const nueva = watchPwd('nueva');

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header con avatar ──────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <div className="flex items-center gap-5">
          <AvatarUploader
            userId={user.id}
            currentUrl={user.avatar_url}
            nombre={user.nombre}
            size="lg"
            editable={true}
            onSuccess={(avatarUrl) => updateUser({ avatar_url: avatarUrl })}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-white tracking-tight">{user.nombre}</h2>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${ROL_COLORS[user.rol] || ''}`}>
                {ROL_LABELS[user.rol] || user.rol}
              </span>
            </div>
            <p className="text-sm text-dark-muted mt-1">{user.correo}</p>
            {user.bio && <p className="text-xs text-dark-muted mt-1 line-clamp-2 italic">{user.bio}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 bg-dark-bg/60 rounded-xl p-1 border border-dark-border">
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
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: General ──────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <form onSubmit={handleSubmit(onSave)} className="bg-dark-card border border-dark-border rounded-[2rem] p-6 space-y-5">
            <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest flex items-center gap-2">
              <UserIcon size={12} /> Datos personales
            </h3>

            {[
              { label: 'Nombre completo', name: 'nombre', type: 'text', icon: UserIcon, placeholder: 'Tu nombre' },
              { label: 'Teléfono',        name: 'telefono', type: 'tel', icon: Phone, placeholder: '+57 300 000 0000' },
            ].map(({ label, name, type, icon: Icon, placeholder }) => (
              <div key={name} className="space-y-1.5">
                <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{label}</label>
                <div className="relative">
                  <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input
                    {...register(name as any)}
                    type={type}
                    placeholder={placeholder}
                    className="input-dark pl-9 w-full"
                  />
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Biografía</label>
              <div className="relative">
                <FileText size={13} className="absolute left-3 top-3 text-dark-muted" />
                <textarea
                  {...register('bio')}
                  rows={3}
                  placeholder="Cuéntanos algo sobre ti..."
                  className="input-dark pl-9 w-full resize-none"
                />
              </div>
            </div>

            {/* Correo (no editable) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">Correo electrónico</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  value={user.correo}
                  disabled
                  className="input-dark pl-9 w-full opacity-50 cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-dark-muted">El correo no puede cambiarse desde aquí</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={!isDirty}
                isLoading={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save size={14} /> Guardar cambios
              </Button>
              {saved && (
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-black">
                  <CheckCircle2 size={14} /> Guardado
                </span>
              )}
            </div>
          </form>
        </motion.div>
      )}

      {/* ── Tab: Actividad ─────────────────────────────────────────────── */}
      {activeTab === 'actividad' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

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
  );
};
