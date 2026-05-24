import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore, ThemeColor, ThemeMode } from '../../store/auth.store';
import { Sun, Moon, Contrast, Bell, Sidebar, Languages, Palette, Check, ShieldCheck } from 'lucide-react';
import { TwoFactorModal } from '../../components/TwoFactorModal';

/* ── Colores de acento ──────────────────────────────────────────────────── */
const ACCENT_COLORS: { key: ThemeColor; label: string; hex: string }[] = [
  { key: 'blue',    label: 'Azul',    hex: '#2563eb' },
  { key: 'violet',  label: 'Violeta', hex: '#7c3aed' },
  { key: 'emerald', label: 'Verde',   hex: '#059669' },
  { key: 'rose',    label: 'Rojo',    hex: '#e11d48' },
  { key: 'amber',   label: 'Ámbar',   hex: '#d97706' },
  { key: 'cyan',    label: 'Cian',    hex: '#0891b2' },
];

/* ── Modos de tema ──────────────────────────────────────────────────────── */
const THEME_MODES: { key: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { key: 'dark',  label: 'Oscuro',   desc: 'Zinc-950 · Modo noche',         icon: Moon     },
  { key: 'dim',   label: 'Atenuado', desc: 'Zinc-900 · Contraste reducido',  icon: Contrast },
  { key: 'light', label: 'Claro',    desc: 'Blanco · Modo día',              icon: Sun      },
];

/* ── Toggle genérico ────────────────────────────────────────────────────── */
const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
      on ? 'bg-blue-600' : 'bg-zinc-700'
    }`}
  >
    <span
      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
        on ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export const SettingsPanel = () => {
  const { settings, updateSettings, user } = useAuthStore();
  const [show2fa, setShow2fa] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Cabecera */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-base font-black text-zinc-100 uppercase tracking-widest">Configuración</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Personaliza tu experiencia en Kanbana · Los cambios se guardan automáticamente.</p>
      </div>

      {/* ── TEMA: modo claro/oscuro ──────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sun size={14} className="text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Modo de tema</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ key, label, desc, icon: Icon }) => {
            const active = (settings.themeMode ?? 'dark') === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ themeMode: key })}
                className={`relative flex flex-col items-center gap-2.5 px-3 py-4 rounded-xl border transition-all text-center ${
                  active
                    ? 'border-blue-600 bg-blue-600/10 text-blue-400'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </span>
                )}
                <Icon size={20} />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">{label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COLOR DE ACENTO ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Color de acento</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(({ key, label, hex }) => {
            const active = settings.themeColor === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ themeColor: key })}
                title={label}
                className={`relative w-9 h-9 rounded-full transition-all duration-200 hover:scale-110 ${
                  active ? 'ring-2 ring-offset-2 ring-offset-zinc-900 scale-110' : ''
                }`}
                style={{ backgroundColor: hex, ...(active ? { '--tw-ring-color': hex } as any : {}) }}
              >
                {active && (
                  <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-600">El color de acento se aplica en botones, indicadores y elementos activos.</p>
      </div>

      {/* ── PREFERENCIAS ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
        {([
          {
            icon: Bell,
            key: 'notificationsEnabled' as const,
            label: 'Notificaciones',
            desc: 'Alertas del sistema en tiempo real',
          },
          {
            icon: Sidebar,
            key: 'sidebarCompact' as const,
            label: 'Sidebar compacto',
            desc: 'Reduce el ancho del menú lateral',
          },
        ] as const).map(({ icon: Icon, key, label, desc }, i, arr) => (
          <div
            key={key}
            className={`flex items-center justify-between px-5 py-4 ${
              i < arr.length - 1 ? 'border-b border-zinc-800' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Icon size={14} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
            </div>
            <Toggle
              on={settings[key] as boolean}
              onToggle={() => updateSettings({ [key]: !settings[key] })}
            />
          </div>
        ))}
      </div>

      {/* ── IDIOMA ──────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Languages size={14} className="text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Idioma</h3>
        </div>
        <div className="flex gap-2">
          {(['es', 'en'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => updateSettings({ language: lang })}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                settings.language === lang
                  ? 'bg-blue-600/15 text-blue-400 border-blue-600/40'
                  : 'text-zinc-400 border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {lang === 'es' ? '🇨🇴 Español' : '🇺🇸 English'}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEGURIDAD — 2FA ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Seguridad</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              (user as any)?.totp_enabled ? 'bg-emerald-500/15' : 'bg-zinc-800'
            }`}>
              <ShieldCheck size={14} className={
                (user as any)?.totp_enabled ? 'text-emerald-400' : 'text-zinc-500'
              } />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Autenticación en dos pasos</p>
              <p className="text-xs text-zinc-500">
                {(user as any)?.totp_enabled
                  ? 'Activa — tu cuenta está protegida con Google Authenticator'
                  : 'Inactiva — protege tu cuenta con un código adicional al iniciar sesión'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShow2fa(true)}
            className={`shrink-0 px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              (user as any)?.totp_enabled
                ? 'text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
                : 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
            }`}
          >
            {(user as any)?.totp_enabled ? 'Gestionar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Modal de 2FA */}
      <AnimatePresence>
        {show2fa && <TwoFactorModal onClose={() => setShow2fa(false)} />}
      </AnimatePresence>

    </div>
  );
};
