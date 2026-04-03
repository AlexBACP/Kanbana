import { useState, useRef, ChangeEvent } from 'react';
import { useAuthStore } from '../store/auth.store';
import { User as UserIcon, Mail, Shield, Key, Save, CheckCircle2, Camera, Phone, FileText } from 'lucide-react';
import { Button } from '../components/Button';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { userService } from '../services/user.service';
import { motion } from 'framer-motion';

const ROL_LABELS: Record<string, string> = {
  coordinador: 'Coordinador',
  instructor: 'Instructor',
  lider_tecnico: 'Líder Técnico',
  aprendiz: 'Aprendiz',
};

const ROL_COLORS: Record<string, string> = {
  coordinador: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  instructor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  lider_tecnico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  aprendiz: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'seguridad' | 'actividad'>('general');
  const [isSaved, setIsSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      nombre: user?.nombre || '',
      telefono: user?.telefono || '',
      bio: user?.bio || '',
    },
  });

  const { register: registerPwd, handleSubmit: handleSubmitPwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm<{
    actual: string; nueva: string; confirmar: string;
  }>();

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => {
      if (!user?.id) throw new Error('No autenticado');
      return userService.update(user.id, data);
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
  });

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      setAvatarPreview(url);
      updateUser({ avatar_url: url });
      // In a real implementation: upload to server and get URL back
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: any) => updateProfileMutation.mutate(data);

  const onChangePassword = (data: { actual: string; nueva: string; confirmar: string }) => {
    if (data.nueva !== data.confirmar) return;
    // Call API to change password
    console.log('Change password:', data.actual, data.nueva);
    resetPwd();
  };

  const gradientClass = 'from-primary-600 to-indigo-700';

  const tabs = [
    { id: 'general', label: 'General', icon: UserIcon },
    { id: 'seguridad', label: 'Seguridad', icon: Key },
    { id: 'actividad', label: 'Actividad', icon: Shield },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-card border border-dark-border rounded-[2.5rem] overflow-hidden"
      >
        {/* Banner */}
        <div className={`h-24 bg-gradient-to-r ${gradientClass} opacity-80`} />

        {/* Avatar + Info */}
        <div className="px-8 pb-8 -mt-12 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-end gap-5">
            {/* Avatar with upload */}
            <div className="relative group">
              <div className={`w-24 h-24 rounded-[1.5rem] bg-gradient-to-br ${gradientClass} flex items-center justify-center border-4 border-dark-card shadow-xl overflow-hidden`}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-white">
                    {user?.nombre?.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-[1.5rem] bg-dark-bg/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera size={22} className="text-white" />
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="mb-2">
              <h2 className="text-2xl font-black text-dark-text">{user?.nombre}</h2>
              <p className="text-dark-muted text-sm">{user?.correo}</p>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-3">
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${ROL_COLORS[user?.rol || 'aprendiz']}`}>
              {ROL_LABELS[user?.rol || 'aprendiz']}
            </span>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${user?.activo ? 'text-emerald-400' : 'text-rose-400'}`}>
              <div className={`w-2 h-2 rounded-full ${user?.activo ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              {user?.activo ? 'Activo' : 'Inactivo'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 bg-dark-card border border-dark-border rounded-2xl p-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === id
                ? 'bg-primary-600/15 text-primary-400 border border-primary-500/20'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatedTabContent>
        {activeTab === 'general' && (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-dark-card border border-dark-border rounded-[2rem] p-8 space-y-6">
            <h3 className="text-lg font-black text-dark-text uppercase tracking-widest">Información Personal</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nombre Completo" icon={<UserIcon size={16} />}>
                <input
                  {...register('nombre', { required: true })}
                  className="input-dark"
                  placeholder="Tu nombre completo"
                />
              </Field>

              <Field label="Correo Electrónico" icon={<Mail size={16} />}>
                <input
                  value={user?.correo}
                  disabled
                  className="input-dark opacity-50 cursor-not-allowed"
                />
              </Field>

              <Field label="Teléfono (opcional)" icon={<Phone size={16} />}>
                <input
                  {...register('telefono')}
                  className="input-dark"
                  placeholder="+57 300 000 0000"
                />
              </Field>

              <Field label="Rol del Sistema" icon={<Shield size={16} />}>
                <input
                  value={ROL_LABELS[user?.rol || 'aprendiz']}
                  disabled
                  className="input-dark opacity-50 cursor-not-allowed"
                />
              </Field>
            </div>

            <Field label="Biografía / Descripción" icon={<FileText size={16} />} fullWidth>
              <textarea
                {...register('bio')}
                rows={3}
                className="input-dark resize-none"
                placeholder="Cuéntanos algo sobre ti..."
              />
            </Field>

            <div className="flex items-center justify-between pt-2">
              {isSaved && (
                <span className="flex items-center gap-2 text-sm text-emerald-400 font-bold">
                  <CheckCircle2 size={16} />
                  Cambios guardados
                </span>
              )}
              <div className="ml-auto">
                <Button
                  type="submit"
                  isLoading={updateProfileMutation.isPending}
                  disabled={!isDirty}
                  className="flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'seguridad' && (
          <form onSubmit={handleSubmit(onChangePassword as any)} className="bg-dark-card border border-dark-border rounded-[2rem] p-8 space-y-6">
            <h3 className="text-lg font-black text-dark-text uppercase tracking-widest">Cambiar Contraseña</h3>

            <Field label="Contraseña Actual" icon={<Key size={16} />}>
              <input
                {...registerPwd('actual', { required: true })}
                type="password"
                className="input-dark"
                placeholder="••••••••"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nueva Contraseña" icon={<Key size={16} />}>
                <input
                  {...registerPwd('nueva', { required: true, minLength: 8 })}
                  type="password"
                  className="input-dark"
                  placeholder="Mínimo 8 caracteres"
                />
              </Field>
              <Field label="Confirmar Nueva Contraseña" icon={<Key size={16} />}>
                <input
                  {...registerPwd('confirmar', { required: true })}
                  type="password"
                  className="input-dark"
                  placeholder="Repite la contraseña"
                />
              </Field>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-400 font-bold">
              La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.
            </div>

            <Button type="submit" className="flex items-center gap-2">
              <Key size={16} />
              Actualizar Contraseña
            </Button>
          </form>
        )}

        {activeTab === 'actividad' && (
          <div className="bg-dark-card border border-dark-border rounded-[2rem] p-8 space-y-4">
            <h3 className="text-lg font-black text-dark-text uppercase tracking-widest">Actividad Reciente</h3>
            <p className="text-dark-muted text-sm">
              Miembro desde: <span className="text-dark-text font-bold">{user?.creado_en ? new Date(user.creado_en).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
            </p>
            <div className="space-y-3 mt-4">
              {[
                { text: 'Iniciaste sesión', time: 'Hace 2 minutos' },
                { text: 'Actualizaste tu perfil', time: 'Ayer' },
                { text: 'Creaste un ticket', time: 'Hace 3 días' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-dark-bg/40 rounded-2xl border border-dark-border/50">
                  <span className="text-sm font-bold text-dark-text">{item.text}</span>
                  <span className="text-xs text-dark-muted">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatedTabContent>
    </div>
  );
};

// Helper components
const AnimatedTabContent = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    key={children?.toString()}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);

const Field = ({
  label, icon, children, fullWidth,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
}) => (
  <div className={`space-y-2 ${fullWidth ? 'col-span-2' : ''}`}>
    <label className="flex items-center gap-1.5 text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">
      {icon}
      {label}
    </label>
    {children}
  </div>
);
