import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ShieldCheck,
  ClipboardList,
  History,
  Bell,
  Settings,
  LayoutGrid,
  Ticket,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { Section } from '../layouts/AdminDashboard';
import { motion } from 'framer-motion';

type Props = {
  setSection: (section: Section) => void;
  activeSection: Section;
};

interface MenuItem {
  label: string;
  key: Section;
  icon: React.ElementType;
}

const menuByRole: Record<string, MenuItem[]> = {
  coordinador: [
    { label: 'Resumen', key: 'overview', icon: LayoutDashboard },
    { label: 'Usuarios', key: 'users', icon: Users },
    { label: 'Proyectos', key: 'projects', icon: FolderKanban },
    { label: 'Líderes', key: 'leaders', icon: ShieldCheck },
    { label: 'Tickets', key: 'tickets', icon: ClipboardList },
    { label: 'Bitácora', key: 'audit', icon: History },
  ],
  instructor: [
    { label: 'Resumen', key: 'overview', icon: LayoutDashboard },
    { label: 'Mis Proyectos', key: 'projects', icon: FolderKanban },
    { label: 'Aprendices', key: 'users', icon: Users },
    { label: 'Tickets', key: 'tickets', icon: ClipboardList },
  ],
  lider_tecnico: [
    { label: 'Resumen', key: 'overview', icon: LayoutDashboard },
    { label: 'Mi Proyecto', key: 'projects', icon: FolderKanban },
    { label: 'Mi Equipo', key: 'leaders', icon: ShieldCheck },
    { label: 'Tickets', key: 'tickets', icon: ClipboardList },
  ],
  aprendiz: [
    { label: 'Mi Tablero', key: 'kanban', icon: LayoutGrid },
    { label: 'Mis Tickets', key: 'mytickets', icon: Ticket },
    { label: 'Notificaciones', key: 'notifications', icon: Bell },
  ],
};

const themeColorMap: Record<string, string> = {
  violet: 'from-violet-600 to-indigo-700',
  blue: 'from-blue-600 to-cyan-700',
  emerald: 'from-emerald-600 to-teal-700',
  rose: 'from-rose-600 to-pink-700',
  amber: 'from-amber-500 to-orange-600',
  cyan: 'from-cyan-600 to-blue-700',
};

export const Sidebar = ({ setSection, activeSection }: Props) => {
  const { user, settings } = useAuthStore();
  const rol = user?.rol || 'aprendiz';
  const menu = menuByRole[rol] || menuByRole.aprendiz;
  const gradientClass = themeColorMap[settings.themeColor] || themeColorMap.violet;

  const avatarContent = user?.avatar_url ? (
    <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
  ) : (
    <span className="text-sm font-black text-white">
      {user?.nombre?.slice(0, 2).toUpperCase() || 'KA'}
    </span>
  );

  return (
    <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col h-full shadow-2xl z-20 shrink-0">
      {/* BRANDING */}
      <div className="px-6 py-7 border-b border-dark-border">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className={`w-10 h-10 bg-gradient-to-br ${gradientClass} rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:rotate-6 transition-transform duration-300`}>
            K
          </div>
          <div>
            <h1 className="text-lg font-black text-dark-text leading-none tracking-tight">Kanbana</h1>
            <p className="text-[10px] text-dark-muted mt-1 uppercase tracking-widest font-black opacity-60 italic">
              SENA · ADSO
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto scrollbar-hide">
        <p className="px-4 text-[9px] font-black text-dark-muted/40 uppercase tracking-[0.25em] mb-3">
          {rol === 'coordinador' ? 'Administración' : rol === 'instructor' ? 'Gestión' : 'Mi Espacio'}
        </p>

        <div className="space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 w-full text-left group overflow-hidden
                  ${isActive
                    ? 'bg-primary-600/15 text-primary-400 border border-primary-500/25 shadow-sm'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-bg/40 border border-transparent'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary-600/10 rounded-2xl"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon
                  size={18}
                  className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-400' : 'text-dark-muted/70 group-hover:text-primary-400'}`}
                />
                <span className="relative z-10">{item.label}</span>
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Extra links for admin */}
        {(rol === 'coordinador' || rol === 'instructor') && (
          <div className="mt-6 pt-4 border-t border-dark-border/30 space-y-1">
            <p className="px-4 text-[9px] font-black text-dark-muted/40 uppercase tracking-[0.25em] mb-3">Sistema</p>
            {[
              { label: 'Notificaciones', key: 'notifications' as Section, icon: Bell },
              { label: 'Configuración', key: 'settings' as Section, icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all w-full text-left
                    ${isActive ? 'text-primary-400 bg-primary-600/10' : 'text-dark-muted hover:text-dark-text hover:bg-dark-bg/40'}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* USER PROFILE BUTTON */}
      <div className="p-4 border-t border-dark-border">
        <button
          onClick={() => setSection('profile')}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl bg-dark-bg/40 border border-dark-border hover:bg-dark-bg/70 hover:border-primary-500/30 transition-all group"
        >
          <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center overflow-hidden border border-white/10 shadow-lg group-hover:scale-105 transition-transform shrink-0`}>
            {avatarContent}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-black text-dark-text truncate group-hover:text-primary-400 transition-colors">
              {user?.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${user?.activo ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              <p className="text-[10px] text-dark-muted capitalize font-black tracking-wide truncate">
                {user?.rol?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};

// Keep SidebarItem for future NavLink-based routes
export const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300
      ${isActive
        ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-500/5'
        : 'text-dark-muted hover:text-dark-text hover:bg-dark-bg/40 border border-transparent'}
    `}
  >
    <Icon size={20} className="opacity-80" />
    <span>{label}</span>
  </NavLink>
);
