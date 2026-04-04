import { useAuthStore } from '../store/auth.store';
import { Section } from '../layouts/AdminDashboard';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, GraduationCap, Users, ShieldCheck,
  Bell, Settings, LogOut, ChevronRight,
} from 'lucide-react';

type MenuDef = { label: string; key: Section; icon: React.ElementType }[];

const MENUS: Record<string, MenuDef> = {
  coordinador: [
    { label: 'Panel de control',  key: 'overview',       icon: LayoutDashboard },
    { label: 'Proyectos',         key: 'projects',       icon: GraduationCap },
    { label: 'Fichas SENA',       key: 'fichas',         icon: GraduationCap },
    { label: 'Usuarios',          key: 'users',          icon: Users },
    { label: 'Líderes técnicos',  key: 'leaders',        icon: ShieldCheck },
  ],
  instructor: [
    { label: 'Panel de control',  key: 'overview',       icon: LayoutDashboard },
    { label: 'Mis proyectos',     key: 'projects',       icon: GraduationCap },
    { label: 'Mis fichas',        key: 'fichas',         icon: GraduationCap },
    { label: 'Aprendices',        key: 'users',          icon: Users },
  ],
  lider_tecnico: [
    { label: 'Panel de control',  key: 'overview',       icon: LayoutDashboard },
    { label: 'Mi proyecto',       key: 'projects',       icon: GraduationCap },
    { label: 'Mi equipo',         key: 'users',          icon: Users },
    { label: 'Líderes',           key: 'leaders',        icon: ShieldCheck },
  ],
};

type Props = { 
  setSection: (s: Section) => void; 
  activeSection: Section;
  allowedSections?: string[];
};

export const Sidebar = ({ setSection, activeSection, allowedSections }: Props) => {
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const rol = user?.rol ?? 'lider_tecnico';
  
  // Filtrar el menú según las secciones permitidas si se proporcionan
  const rawMenu = MENUS[rol] ?? MENUS.lider_tecnico;
  const menu = allowedSections 
    ? rawMenu.filter(item => allowedSections.includes(item.key))
    : rawMenu;

  const rolLabel: Record<string, string> = {
    coordinador:   'Coordinador',
    instructor:    'Instructor',
    lider_tecnico: 'Líder técnico',
  };

  return (
    <aside className="w-56 bg-surface-card border-r border-surface-border flex flex-col h-full shrink-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">K</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-primary leading-none">Kanbana</p>
            <p className="text-[10px] text-ink-muted mt-0.5">SENA · ADSO</p>
          </div>
        </div>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <p className="px-2 text-[10px] font-medium text-ink-muted uppercase tracking-widest mb-2">
          {rol === 'coordinador' ? 'Administración' : rol === 'instructor' ? 'Gestión' : 'Mi espacio'}
        </p>

        <div className="space-y-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight size={12} className="text-primary-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Sistema */}
        <div className="mt-4 pt-3 border-t border-surface-border">
          <p className="px-2 text-[10px] font-medium text-ink-muted uppercase tracking-widest mb-2">Sistema</p>
          <div className="space-y-0.5">
            {[
              { label: 'Notificaciones', key: 'notifications' as Section, icon: Bell },
              { label: 'Configuración',  key: 'settings'      as Section, icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer: perfil + logout */}
      <div className="p-2 border-t border-surface-border">
        <button
          onClick={() => setSection('profile')}
          className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors group"
        >
          <div className="w-7 h-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatar_url
              ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
              : <span className="text-[10px] font-semibold text-primary-400">{user?.nombre?.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-ink-primary truncate group-hover:text-ink-primary">
              {user?.nombre}
            </p>
            <p className="text-[10px] text-ink-muted">{rolLabel[rol] ?? rol}</p>
          </div>
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-light transition-colors mt-0.5 text-xs"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
