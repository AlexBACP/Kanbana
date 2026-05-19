import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Section } from '../layouts/AdminDashboard';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, GraduationCap, Users, ShieldCheck,
  Bell, Settings, LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen, Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type MenuDef = { label: string; key: Section; icon: React.ElementType }[];

/**
 * Menús por rol efectivo:
 *   coordinador  → acceso total + líderes técnicos
 *   instructor   → sus fichas y proyectos
 *   lider        → su proyecto, su equipo (aprendiz con es_lider_tecnico)
 *
 * NOTA: Se eliminó la sección "Líderes" del menú del propio líder técnico
 * porque no tiene sentido que gestione a otros líderes. Solo el coordinador
 * puede ver y gestionar líderes técnicos.
 */
const MENUS: Record<string, MenuDef> = {
  coordinador: [
    { label: 'Panel de control', key: 'overview', icon: LayoutDashboard },
    { label: 'Proyectos', key: 'projects', icon: GraduationCap },
    { label: 'Fichas SENA', key: 'fichas', icon: GraduationCap },
    { label: 'Usuarios', key: 'users', icon: Users },
    { label: 'Líderes técnicos', key: 'leaders', icon: ShieldCheck },
  ],
  instructor: [
    { label: 'Panel de control', key: 'overview',  icon: LayoutDashboard },
    { label: 'Mis proyectos',    key: 'projects',  icon: GraduationCap },
    // ── CORREGIDO: se quitó 'Aprendices' con key 'users' porque:
    // 1. 'users' ya no está en allowedSections del instructor
    // 2. Los aprendices del instructor se gestionan desde Fichas → aside
    { label: 'Mis fichas',       key: 'fichas',    icon: GraduationCap },
  ],
  // Aprendiz con sub-rol de líder técnico
 lider: [
    { label: 'Panel de control', key: 'overview',  icon: LayoutDashboard },
    { label: 'Mi proyecto',      key: 'projects',  icon: GraduationCap },
    // ── CORREGIDO: key era 'users', debe ser 'equipo' para que
    // AdminDashboard renderice MiEquipoPanel en lugar de nada
    { label: 'Mi Equipo',        key: 'equipo',    icon: Users },
  ],
};

type Props = {
  setSection: (s: Section) => void;
  activeSection: Section;
  allowedSections?: string[];
};

// Breakpoint en px a partir del cual el sidebar se oculta automáticamente
const COLLAPSE_BREAKPOINT = 900;

export const Sidebar = ({ setSection, activeSection, allowedSections }: Props) => {
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // ── Colapso retráctil ─────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(false);
  // Auto-hidden: sidebar totalmente oculto en pantalla pequeña
  const [autoHidden, setAutoHidden] = useState(false);
  // Drawer abierto manualmente en mobile (encima del contenido)
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const small = window.innerWidth < COLLAPSE_BREAKPOINT;
      setAutoHidden(small);
      if (!small) setMobileOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Resize logic (solo cuando el sidebar está visible y no colapsado) ──
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    if (collapsed) return;
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.max(160, Math.min(340, e.clientX));
      setSidebarWidth(newW);
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
  // ──────────────────────────────────────────────────────────────

  // Determinar el menú según el rol efectivo
  const esLider = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const menuKey = esLider ? 'lider' : (user?.rol ?? 'lider');

  const rawMenu = MENUS[menuKey] ?? MENUS.lider;
  const menu = allowedSections
    ? rawMenu.filter(item => allowedSections.includes(item.key))
    : rawMenu;

  const rolLabel = esLider ? 'Líder técnico' : {
    coordinador: 'Coordinador',
    instructor: 'Instructor',
    aprendiz: 'Aprendiz',
  }[user?.rol ?? 'aprendiz'] ?? user?.rol;

  // Ancho efectivo del sidebar
  const effectiveWidth = collapsed ? 60 : sidebarWidth;

  // Navegar y cerrar el drawer mobile
  const navigate = (s: Section) => {
    setSection(s);
    setMobileOpen(false);
  };

  // ── Contenido interno del sidebar (reutilizado en normal y drawer) ──
  const SidebarContent = ({ isDrawer = false }: { isDrawer?: boolean }) => (
    <>
      {/* Brand */}
      <div className="px-4 py-3 ">
        <div className="flex items-center gap-2.5">
          <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
            {/* Fondo esmeralda */}
            <div className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle, #064e3b, #022c22)' }} />

            {/* Anillo exterior punteado */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="12" fill="none" stroke="#34d399" strokeWidth="0.6"
                strokeDasharray="4 6" opacity="0.4"
                style={{ transformOrigin: '14px 14px', animation: 'spin 10s linear infinite' }} />
              <circle cx="14" cy="14" r="9" fill="none" stroke="#065f46" strokeWidth="0.8" />

              {/* Punto teal */}
              <circle cx="14" cy="2" r="2" fill="#6ee7b7"
                style={{ transformOrigin: '14px 14px', animation: 'spin 10s linear infinite' }} />

              {/* Puntos ámbar */}
              <circle cx="26" cy="14" r="1.5" fill="#fcd34d" opacity="0.85"
                style={{ transformOrigin: '14px 14px', animation: 'spin 16s linear infinite reverse' }} />

              {/* Punto coral */}
              <circle cx="14" cy="26" r="1.2" fill="#fb7185" opacity="0.75"
                style={{ transformOrigin: '14px 14px', animation: 'spin 8s linear infinite' }} />
            </svg>

            {/* K */}
            <span className="relative z-10 text-sm font-bold"
              style={{
                fontFamily: 'Georgia, serif',
                background: 'linear-gradient(135deg, #6ee7b7, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'kcolor 6s ease-in-out infinite',
              }}>
              K
            </span>
          </div>

          <style>{`
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes kcolor { 0%,100% { filter: hue-rotate(0deg); } 50% { filter: hue-rotate(20deg); } }
`}</style>

          {/* Textos solo visibles cuando no está colapsado */}
          {(!collapsed || isDrawer) && (
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-ink-primary leading-none">Kanbana</p>
              <p className="text-[10px] text-ink-muted mt-0.5">SENA · ADSO</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="space-y-0.5 border-b border-zinc-600">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={collapsed && !isDrawer ? item.label : undefined}
                className={`nav-item ${isActive ? 'active' : ''} ${collapsed && !isDrawer ? 'justify-center px-0' : ''}`}
              >
                <Icon size={21} className="shrink-0" />
                {(!collapsed || isDrawer) && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {isActive && <ChevronRight size={12} className="text-primary-400 shrink-0" />}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3">
          {(!collapsed || isDrawer) && (
            <p className="px-2 text-[15px] font-medium text-ink-muted uppercase tracking-widest mb-2">Sistema</p>
          )}
          <div className="space-y-0.5">
            {[
              { label: 'Notificaciones', key: 'notifications' as Section, icon: Bell },
              { label: 'Configuración', key: 'settings' as Section, icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  title={collapsed && !isDrawer ? item.label : undefined}
                  className={`nav-item ${isActive ? 'active' : ''} ${collapsed && !isDrawer ? 'justify-center px-0' : ''}`}
                >
                  <Icon size={15} className="shrink-0" />
                  {(!collapsed || isDrawer) && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );

  // ── Pantalla pequeña: botón flotante + drawer overlay ─────────
  if (autoHidden) {
    return (
      <>
        {/* Botón hamburguesa flotante encima del contenido */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 p-2.5 rounded-xl bg-zinc-800 border border-surface-border shadow-lg hover:bg-zinc-700 transition-all"
          aria-label="Abrir menú"
        >
          <Menu size={18} className="text-white" />
        </button>

        {/* Drawer overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Fondo oscuro */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              />

              {/* Panel deslizante */}
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{ width: sidebarWidth }}
                className="fixed top-0 left-0 bottom-0 z-50 bg-[#1f1f21] border-r border-surface-border flex flex-col shadow-2xl"
              >
                <SidebarContent isDrawer />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Pantalla normal: sidebar fijo con colapso ─────────────────
  return (
    <aside
      style={{ width: effectiveWidth }}
      className="relative bg-zinc-900 border-r border-surface-border flex flex-col h-full shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden"
    >
      <SidebarContent />

      {/* Botón colapsar/expandir */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        className="absolute top-4 right-2 z-20 p-1 rounded-lg text-white hover:text-ink-primary hover:bg-zinc-700 transition-all"
      >
        {collapsed
          ? <PanelLeftOpen size={20} />
          : <PanelLeftClose size={20} />
        }
      </button>

      {/* Handle de redimensión (solo visible cuando está expandido) */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group flex items-center justify-center z-10"
        >
          <div className="w-0.5 h-10 rounded-full bg-surface-border group-hover:bg-primary-500 group-hover:h-16 transition-all duration-200" />
        </div>
      )}
    </aside>
  );
};