import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import {
  LayoutDashboard, FolderKanban, GraduationCap,
  Users, Crown, Bell, Settings,
} from 'lucide-react';
import { Overview } from '../dashboard/components/Overview';
import { ProjectsPanel } from '../dashboard/panels/ProjectsPanel';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { LeadersPanel } from '../dashboard/panels/LeadersPanel';
import { MiEquipoPanel } from '../dashboard/panels/MiEquipoPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';

export type Section =
  | 'overview' | 'projects' | 'fichas' | 'users' | 'leaders' | 'equipo'
  | 'notifications' | 'settings' | 'profile';

const TITLES: Record<Section, string> = {
  overview:      'Panel de control',
  projects:      'Proyectos',
  fichas:        'Fichas de formación',
  users:         'Usuarios',
  leaders:       'Líderes técnicos',
  equipo:        'Mi Equipo',
  notifications: 'Notificaciones',
  settings:      'Configuración',
  profile:       'Mi perfil',
};

const panelVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

// ▼ Todos los items posibles — se filtran según allowedSections del rol
const ALL_MENU_ITEMS = [
  { key: 'overview', label: 'Panel de control',  icon: LayoutDashboard },
  { key: 'projects', label: 'Proyectos',         icon: FolderKanban },
  { key: 'fichas',   label: 'Fichas',            icon: GraduationCap },
  { key: 'users',    label: 'Usuarios',          icon: Users },
  { key: 'leaders',  label: 'Líderes técnicos',  icon: Crown },
  { key: 'equipo',   label: 'Mi Equipo',          icon: Users },
];
const ALL_SYSTEM_ITEMS = [
  { key: 'notifications', label: 'Notificaciones', icon: Bell },
  { key: 'settings',      label: 'Configuración',  icon: Settings },
];

export const AdminDashboard = () => {
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>('overview');

  const esLider = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;

  const allowedSections = useMemo(() => {
    if (!user) return [];
    if (user.rol === 'coordinador') {
      return ['overview','projects','fichas','users','leaders','notifications','settings','profile'];
    }
    if (user.rol === 'instructor') {
      // ── MODIFICADO: se quita 'users' del instructor.
      // El instructor gestiona sus aprendices desde 'fichas' → detalle de ficha
      // → AprendicesManager, que ya filtra por ficha y tiene importación Excel.
      // El UsersPanel mostraba todos los usuarios del sistema sin filtrar.
      return ['overview','projects','fichas','notifications','settings','profile'];
    }
    if (esLider) {
      // ── MODIFICADO: el líder ve 'equipo' (MiEquipoPanel) en lugar de
      // 'users' (UsersPanel completo del coordinador — incorrecto para el líder)
      return ['overview','projects','equipo','notifications','settings','profile'];
    }
    return ['overview','profile'];
  }, [user, esLider]);

  if (!user) return null;

  // ▼ CAMBIO: filtrar los items según el rol, para pasarlos al nuevo Sidebar
  const menuItems   = ALL_MENU_ITEMS.filter(i => allowedSections.includes(i.key));
  const systemItems = ALL_SYSTEM_ITEMS.filter(i => allowedSections.includes(i.key));

  const rolLabel =
    user.rol === 'coordinador' ? 'Coordinador' :
    user.rol === 'instructor'  ? 'Instructor'  :
    esLider                    ? 'Líder técnico' : 'Usuario';

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      <Sidebar
        setSection={setSection}
        activeSection={section}
        allowedSections={allowedSections}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={TITLES[section]}
          user={user}
          onNotifications={() => setSection('notifications')}
          onProfile={() => setSection('profile')}
          onSettings={() => setSection('settings')}
          onLogout={logout}
        />

        <main className="flex-1 overflow-y-auto p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
            >
              {section === 'overview'      && <Overview />}
              {section === 'projects'      && <ProjectsPanel />}
              {section === 'fichas'        && allowedSections.includes('fichas')   && <FichasPanel />}
              {section === 'users'         && allowedSections.includes('users')    && <UsersPanel />}
              {section === 'leaders'       && allowedSections.includes('leaders')  && <LeadersPanel />}
              {/* ── NUEVO: Mi Equipo para el líder técnico */}
              {section === 'equipo'        && allowedSections.includes('equipo')   && <MiEquipoPanel />}
              {section === 'notifications' && <NotificationsPanel />}
              {section === 'settings'      && <SettingsPanel />}
              {section === 'profile'       && <ProfilePage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};