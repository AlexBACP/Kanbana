import { useAuthStore, ThemeColor } from '../../store/auth.store';
import { motion } from 'framer-motion';
import { Palette, Bell, Zap, Globe, Monitor, Check } from 'lucide-react';

const THEME_COLORS: { value: ThemeColor; label: string; gradient: string; ring: string }[] = [
  { value: 'violet', label: 'Violeta', gradient: 'from-violet-600 to-indigo-700', ring: 'ring-violet-500' },
  { value: 'blue', label: 'Azul', gradient: 'from-blue-600 to-cyan-700', ring: 'ring-blue-500' },
  { value: 'emerald', label: 'Esmeralda', gradient: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-500' },
  { value: 'rose', label: 'Rosa', gradient: 'from-rose-600 to-pink-700', ring: 'ring-rose-500' },
  { value: 'amber', label: 'Ámbar', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-500' },
  { value: 'cyan', label: 'Cian', gradient: 'from-cyan-600 to-blue-700', ring: 'ring-cyan-500' },
];

export const SettingsPanel = () => {
  const { settings, updateSettings } = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Configuración</h2>
        <p className="text-dark-muted text-sm font-bold mt-1">Personaliza tu experiencia en Kanbana</p>
      </div>

      {/* Theme Color */}
      <SettingCard icon={<Palette size={20} />} title="Color de Acento" description="Cambia el color principal de la interfaz">
        <div className="flex gap-3 flex-wrap">
          {THEME_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => updateSettings({ themeColor: c.value })}
              className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} transition-all hover:scale-110 ${settings.themeColor === c.value ? `ring-2 ring-offset-2 ring-offset-dark-bg ${c.ring} scale-110` : ''}`}
              title={c.label}
            >
              {settings.themeColor === c.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check size={16} className="text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-dark-muted mt-2 font-bold">
          Seleccionado: <span className="text-dark-text capitalize">{settings.themeColor}</span>
        </p>
      </SettingCard>

      {/* Notifications */}
      <SettingCard icon={<Bell size={20} />} title="Notificaciones" description="Controla cuándo y cómo recibes alertas">
        <ToggleRow
          label="Notificaciones en tiempo real"
          description="Recibe alertas cuando te asignen tickets o haya actualizaciones"
          value={settings.notificationsEnabled}
          onChange={(v) => updateSettings({ notificationsEnabled: v })}
        />
      </SettingCard>

      {/* Animations */}
      <SettingCard icon={<Zap size={20} />} title="Rendimiento" description="Ajusta las animaciones y efectos visuales">
        <ToggleRow
          label="Animaciones de interfaz"
          description="Transiciones suaves y efectos de movimiento"
          value={settings.animationsEnabled}
          onChange={(v) => updateSettings({ animationsEnabled: v })}
        />
        <ToggleRow
          label="Sidebar compacto"
          description="Oculta las etiquetas del sidebar para más espacio"
          value={settings.sidebarCompact}
          onChange={(v) => updateSettings({ sidebarCompact: v })}
        />
      </SettingCard>

      {/* Language */}
      <SettingCard icon={<Globe size={20} />} title="Idioma" description="Cambia el idioma de la interfaz">
        <div className="flex gap-3">
          {(['es', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => updateSettings({ language: lang })}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                settings.language === lang
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text'
              }`}
            >
              {lang === 'es' ? '🇨🇴 Español' : '🇺🇸 English'}
            </button>
          ))}
        </div>
      </SettingCard>

      {/* Preview Card */}
      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor size={16} className="text-primary-400" />
          <span className="text-xs font-black text-dark-muted uppercase tracking-widest">Vista Previa</span>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm">
            K
          </div>
          <div>
            <p className="text-sm font-black text-dark-text">Kanbana</p>
            <p className="text-[10px] text-primary-400 font-bold">Tu color de acento activo</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingCard = ({
  icon, title, description, children
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-dark-card border border-dark-border rounded-[2rem] p-6 space-y-4"
  >
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-400">{icon}</div>
      <div>
        <h3 className="text-sm font-black text-dark-text">{title}</h3>
        <p className="text-xs text-dark-muted">{description}</p>
      </div>
    </div>
    {children}
  </motion.div>
);

const ToggleRow = ({
  label, description, value, onChange
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-bold text-dark-text">{label}</p>
      <p className="text-xs text-dark-muted">{description}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-dark-border'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : ''}`} />
    </button>
  </div>
);
