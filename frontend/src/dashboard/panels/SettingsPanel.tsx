import { useAuthStore, ThemeColor } from '../../store/auth.store';

const COLORS: { key: ThemeColor; label: string; hex: string }[] = [
  { key: 'violet',  label: 'Violeta', hex: '#4f46e5' },
  { key: 'blue',    label: 'Azul',    hex: '#2563eb' },
  { key: 'emerald', label: 'Verde',   hex: '#059669' },
  { key: 'rose',    label: 'Rojo',    hex: '#e11d48' },
  { key: 'amber',   label: 'Ámbar',   hex: '#d97706' },
  { key: 'cyan',    label: 'Cian',    hex: '#0891b2' },
];

export const SettingsPanel = () => {
  const { settings, updateSettings } = useAuthStore();

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="section-title">Configuración</h2>
        <p className="section-subtitle">Personaliza tu experiencia en Kanbana</p>
      </div>

      {/* Color de acento */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-medium text-ink-primary">Color de acento</h3>
        <div className="flex gap-3">
          {COLORS.map(({ key, label, hex }) => (
            <button
              key={key}
              onClick={() => updateSettings({ themeColor: key })}
              title={label}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                settings.themeColor === key ? 'ring-2 ring-offset-2 ring-offset-surface-card scale-110' : ''
              }`}
              style={{ backgroundColor: hex, '--tw-ring-color': hex } as any}
            />
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="card p-5 space-y-1 divide-y divide-surface-border">
        {[
          {
            key: 'animationsEnabled' as const,
            label: 'Animaciones',
            desc: 'Transiciones y efectos de movimiento',
          },
          {
            key: 'notificationsEnabled' as const,
            label: 'Notificaciones',
            desc: 'Alertas del sistema en tiempo real',
          },
          {
            key: 'sidebarCompact' as const,
            label: 'Sidebar compacto',
            desc: 'Reduce el ancho del menú lateral',
          },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-ink-primary">{label}</p>
              <p className="text-xs text-ink-muted">{desc}</p>
            </div>
            <button
              onClick={() => updateSettings({ [key]: !settings[key] })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings[key] ? 'bg-primary-600' : 'bg-surface-hover border border-surface-border'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  settings[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Idioma */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink-primary">Idioma</h3>
        <div className="flex gap-2">
          {(['es', 'en'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => updateSettings({ language: lang })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                settings.language === lang
                  ? 'bg-primary-600/15 text-primary-400 border-primary-500/30'
                  : 'text-ink-secondary border-surface-border hover:border-surface-border bg-surface-hover'
              }`}
            >
              {lang === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
