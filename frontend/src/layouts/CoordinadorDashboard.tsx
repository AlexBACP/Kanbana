/**
 * CoordinadorDashboard
 *
 * Secciones:
 *   overview    → resumen global del sistema
 *   fichas      → fichas de formación (CRUD)
 *   usuarios    → todos los usuarios organizados por rol
 *   proyectos   → todos los proyectos con filtro por ficha/instructor
 *   configuracion
 *   perfil
 *
 * El coordinador ve TODO pero de forma organizada.
 * No hay "dump" de la DB — los datos se presentan jerárquicamente.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  LayoutDashboard, GraduationCap, Users, FolderKanban,
  Settings, ChevronRight, LogOut, Bell
} from 'lucide-react';
import { Overview } from '../dashboard/components/Overview';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { ProjectsPanel } from '../dashboard/panels/ProjectsPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';

type Section = 'overview' | 'fichas' | 'usuarios' | 'proyectos' | 'notificaciones' | 'configuracion' | 'perfil';

const MENU: { key: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'overview',   label: 'Panel de control', icon: LayoutDashboard, desc: 'Resumen global' },
  { key: 'fichas',     label: 'Fichas',           icon: GraduationCap,   desc: 'Grupos de formación' },
  { key: 'proyectos',  label: 'Proyectos',        icon: FolderKanban,    desc: 'Todos los proyectos' },
  { key: 'usuarios',   label: 'Usuarios',         icon: Users,           desc: 'Aprendices, líderes, instructores' },
];

const TITLES: Record<Section, string> = {
  overview:      'Panel de control',
  fichas:        'Fichas de formación',
  usuarios:      'Usuarios',
  proyectos:     'Proyectos',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const CoordinadorDashboard = () => {
  const [section, setSection] = useState<Section>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 bg-dark-card border-r border-dark-border flex flex-col h-full shrink-0">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">K</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-dark-text leading-none">Kanbana</p>
              <p className="text-[10px] text-dark-muted mt-0.5">SENA · ADSO</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          <p className="px-2 text-[10px] font-medium text-dark-muted uppercase tracking-widest mb-2">
            Coordinación
          </p>
          {MENU.map(({ key, label, icon: Icon }) => {
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left group ${
                  active
                    ? 'bg-primary-600/10 text-primary-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {active && <ChevronRight size={12} className="text-primary-400 shrink-0" />}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-dark-border space-y-0.5">
            <p className="px-2 text-[10px] font-medium text-dark-muted uppercase tracking-widest mb-2">Sistema</p>
            {([
              { key: 'notificaciones' as Section, label: 'Notificaciones', icon: Bell },
              { key: 'configuracion'  as Section, label: 'Configuración',  icon: Settings },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  section === key
                    ? 'bg-primary-600/10 text-primary-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Profile */}
        <div className="p-2 border-t border-dark-border space-y-1">
          <button
            onClick={() => setSection('perfil')}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-dark-border/30 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-[9px] font-semibold text-primary-400">{user?.nombre?.slice(0,2).toUpperCase()}</span>
              }
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-dark-text truncate">{user?.nombre}</p>
              <p className="text-[10px] text-dark-muted">Coordinador</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-dark-muted hover:text-rose-400 hover:bg-rose-500/5 transition-colors text-xs"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={TITLES[section]}
          user={user}
          onNotifications={() => setSection('notificaciones')}
          onProfile={() => setSection('perfil')}
          onSettings={() => setSection('configuracion')}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={section} variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.15 }}>
              {section === 'overview'       && <Overview />}
              {section === 'fichas'         && <FichasPanel />}
              {section === 'proyectos'      && <ProjectsPanel />}
              {section === 'usuarios'       && <UsersPanel />}
              {section === 'notificaciones' && <NotificationsPanel />}
              {section === 'configuracion'  && <SettingsPanel />}
              {section === 'perfil'         && <ProfilePage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};