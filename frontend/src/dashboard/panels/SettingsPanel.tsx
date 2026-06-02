import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, ThemeColor, ThemeMode } from '../../store/auth.store';
import {
  Sun, Moon, Contrast, Bell, BellOff, Sidebar, Palette, Check,
  ShieldCheck, Github, Zap, Monitor,
} from 'lucide-react';
import { TwoFactorModal } from '../../components/TwoFactorModal';
import { githubService } from '../../services/github.service';

/* ── Colores de acento ──────────────────────────────────────────────────────── */
const ACCENT_COLORS: { key: ThemeColor; label: string; hex: string }[] = [
  { key: 'blue',    label: 'Azul',    hex: '#2563eb' },
  { key: 'violet',  label: 'Violeta', hex: '#7c3aed' },
  { key: 'emerald', label: 'Verde',   hex: '#059669' },
  { key: 'rose',    label: 'Rojo',    hex: '#e11d48' },
  { key: 'amber',   label: 'Ámbar',   hex: '#d97706' },
  { key: 'cyan',    label: 'Cian',    hex: '#0891b2' },
];

/* ── Modos de tema ──────────────────────────────────────────────────────────── */
const THEME_MODES: { key: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { key: 'dark',  label: 'Oscuro',   desc: 'Zinc-950 · Modo noche',        icon: Moon     },
  { key: 'dim',   label: 'Atenuado', desc: 'Zinc-900 · Contraste reducido', icon: Contrast },
  { key: 'light', label: 'Claro',    desc: 'Blanco · Modo día',             icon: Sun      },
];

/* ── Toggle pill estilo iOS ─────────────────────────────────────────────────── */
const Toggle = ({ on, onToggle, color = 'bg-primary-600' }: { on: boolean; onToggle: () => void; color?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onToggle}
    className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-primary-500 ${
      on ? color : 'bg-zinc-700'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
        on ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

/* ── Fila de preferencia ────────────────────────────────────────────────────── */
const PrefRow = ({
  icon: Icon, label, desc, on, onToggle, color, last = false,
}: {
  icon: React.ElementType; label: string; desc: string;
  on: boolean; onToggle: () => void; color?: string; last?: boolean;
}) => (
  <div className={`flex items-center justify-between gap-4 px-5 py-4 ${!last ? 'border-b border-zinc-800/80' : ''}`}>
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
        on ? 'bg-primary-500/10 border-primary-500/20' : 'bg-zinc-800 border-zinc-700'
      }`}>
        <Icon size={15} className={on ? 'text-primary-400' : 'text-zinc-500'} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-zinc-200 leading-tight">{label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{desc}</p>
      </div>
    </div>
    <Toggle on={on} onToggle={onToggle} color={color} />
  </div>
);

/* ── Sección contenedora ────────────────────────────────────────────────────── */
const Section = ({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
      <Icon size={13} className="text-zinc-500" />
      <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{title}</h3>
    </div>
    {children}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════════ */
export const SettingsPanel = () => {
  const { settings, updateSettings, user } = useAuthStore();
  const [show2fa, setShow2fa] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const qc = useQueryClient();

  // Estado del permiso de notificaciones del browser
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
  };

  // ── GitHub ────────────────────────────────────────────────────────────────
  const { data: ghStatus } = useQuery({
    queryKey: ['github-status'],
    queryFn:  githubService.getStatus,
  });

  const connectMut = useMutation({
    mutationFn: githubService.connect,
    onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo iniciar la conexión con GitHub'),
  });

  const disconnectMut = useMutation({
    mutationFn: githubService.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-status'] }),
  });

  const [ghMsg, setGhMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gh = params.get('github');
    if (gh === 'connected') {
      setGhMsg({ ok: true, text: `GitHub vinculado${params.get('login') ? ` (@${params.get('login')})` : ''}.` });
      qc.invalidateQueries({ queryKey: ['github-status'] });
    } else if (gh === 'error') {
      setGhMsg({ ok: false, text: `Error al conectar GitHub: ${params.get('msg') ?? 'desconocido'}` });
    }
    if (gh) window.history.replaceState({}, '', window.location.pathname);
  }, [qc]);

  const totpEnabled = (user as any)?.totp_enabled;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-4 max-w-2xl">

        {/* ── Cabecera ──────────────────────────────────────────────────── */}
        <div className="pb-4 border-b border-zinc-800">
          <h2 className="text-[15px] font-black text-zinc-100 tracking-tight">Configuración</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Personaliza tu experiencia · Los cambios se guardan automáticamente.
          </p>
        </div>

        {/* ── TEMA ──────────────────────────────────────────────────────── */}
        <Section icon={Monitor} title="Apariencia">
          <div className="p-5 space-y-5">
            {/* Modo */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Modo de tema</p>
              <div className="grid grid-cols-3 gap-2.5">
                {THEME_MODES.map(({ key, label, desc, icon: Icon }) => {
                  const active = (settings.themeMode ?? 'dark') === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updateSettings({ themeMode: key })}
                      className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all text-center ${
                        active
                          ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center">
                          <Check size={9} className="text-white" />
                        </span>
                      )}
                      <Icon size={18} />
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest">{label}</p>
                        <p className="text-[10px] mt-0.5 opacity-60 leading-tight">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color de acento */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Palette size={11} /> Color de acento
              </p>
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
              <p className="text-[10px] text-zinc-600">
                Aplicado en botones, indicadores activos y elementos de énfasis.
              </p>
            </div>
          </div>
        </Section>

        {/* ── NOTIFICACIONES ────────────────────────────────────────────── */}
        <Section icon={Bell} title="Notificaciones">
          <PrefRow
            icon={settings.notificationsEnabled ? Bell : BellOff}
            label="Notificaciones en la app"
            desc={settings.notificationsEnabled
              ? 'Recibes alertas de tareas, revisiones y más'
              : 'Las alertas están silenciadas'}
            on={settings.notificationsEnabled}
            onToggle={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            color="bg-emerald-600"
          />
          {/* Notificaciones del navegador */}
          <div className={`flex items-center justify-between gap-4 px-5 py-4 ${
            settings.notificationsEnabled ? '' : 'opacity-40 pointer-events-none'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                browserPermission === 'granted'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-zinc-800 border-zinc-700'
              }`}>
                <Monitor size={15} className={
                  browserPermission === 'granted' ? 'text-emerald-400' : 'text-zinc-500'
                } />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-zinc-200 leading-tight">Notificaciones del sistema</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                  {browserPermission === 'granted'
                    ? 'Activadas — recibes alertas aunque la pestaña esté en segundo plano'
                    : browserPermission === 'denied'
                      ? 'Bloqueadas — actívalas desde la configuración del navegador'
                      : 'Permiso no concedido — haz clic en "Activar" para habilitarlas'}
                </p>
              </div>
            </div>
            {browserPermission !== 'denied' && (
              <button
                onClick={requestBrowserPermission}
                disabled={browserPermission === 'granted'}
                className={`shrink-0 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                  browserPermission === 'granted'
                    ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10 cursor-default'
                    : 'border-zinc-600 text-zinc-300 bg-zinc-800 hover:border-primary-500/40 hover:text-primary-400'
                }`}
              >
                {browserPermission === 'granted' ? '✓ Activo' : 'Activar'}
              </button>
            )}
          </div>
        </Section>

        {/* ── INTERFAZ ──────────────────────────────────────────────────── */}
        <Section icon={Sidebar} title="Interfaz">
          <PrefRow
            icon={Sidebar}
            label="Sidebar compacto"
            desc="Reduce el menú lateral a solo iconos"
            on={settings.sidebarCompact}
            onToggle={() => updateSettings({ sidebarCompact: !settings.sidebarCompact })}
          />
          <PrefRow
            icon={Zap}
            label="Animaciones"
            desc="Transiciones y efectos de movimiento"
            on={settings.animationsEnabled}
            onToggle={() => updateSettings({ animationsEnabled: !settings.animationsEnabled })}
            last
          />
        </Section>

        {/* ── SEGURIDAD ─────────────────────────────────────────────────── */}
        <Section icon={ShieldCheck} title="Seguridad">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                totpEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-zinc-800 border-zinc-700'
              }`}>
                <ShieldCheck size={15} className={totpEnabled ? 'text-emerald-400' : 'text-zinc-500'} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-zinc-200 leading-tight">
                  Autenticación en dos pasos
                  {totpEnabled && (
                    <span className="ml-2 text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest align-middle">
                      Activa
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                  {totpEnabled
                    ? 'Tu cuenta está protegida con Google Authenticator'
                    : 'Agrega un segundo factor al iniciar sesión'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShow2fa(true)}
              className={`shrink-0 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                totpEnabled
                  ? 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  : 'border-primary-500/30 text-primary-400 bg-primary-500/10 hover:bg-primary-500/20'
              }`}
            >
              {totpEnabled ? 'Gestionar' : 'Activar'}
            </button>
          </div>
        </Section>

        {/* ── INTEGRACIONES — GitHub ────────────────────────────────────── */}
        <Section icon={Github} title="Integraciones">
          {ghMsg && (
            <div className={`mx-4 mt-4 text-[11px] rounded-xl px-3 py-2.5 border font-bold ${
              ghMsg.ok
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {ghMsg.text}
            </div>
          )}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                ghStatus?.conectado
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-zinc-800 border-zinc-700'
              }`}>
                <Github size={15} className={ghStatus?.conectado ? 'text-emerald-400' : 'text-zinc-500'} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-zinc-200 leading-tight">GitHub</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                  {!ghStatus?.configurado
                    ? 'No disponible · Contacta al administrador'
                    : ghStatus?.conectado
                      ? `Vinculado como @${ghStatus.github_login}`
                      : 'Conecta para enlazar commits y PRs con tus tareas'}
                </p>
              </div>
            </div>
            {ghStatus?.conectado ? (
              <button
                onClick={() => window.confirm('¿Desvincular tu cuenta de GitHub?') && disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
                className="shrink-0 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border border-zinc-700 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400 transition-all disabled:opacity-40"
              >
                {disconnectMut.isPending ? 'Desvinculando...' : 'Desvincular'}
              </button>
            ) : (
              <button
                onClick={() => connectMut.mutate()}
                disabled={!ghStatus?.configurado || connectMut.isPending}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border border-primary-500/30 text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Github size={12} />
                {connectMut.isPending ? 'Redirigiendo...' : 'Conectar'}
              </button>
            )}
          </div>
        </Section>

      </div>

      {/* Modal 2FA */}
      <AnimatePresence>
        {show2fa && <TwoFactorModal onClose={() => setShow2fa(false)} />}
      </AnimatePresence>
    </div>
  );
};