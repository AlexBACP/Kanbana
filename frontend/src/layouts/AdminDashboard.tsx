import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';

// Componentes de Layout
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';

// Paneles
import { Overview } from '../dashboard/components/Overview';
import { ProjectsPanel } from '../dashboard/panels/ProjectsPanel';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { LeadersPanel } from '../dashboard/panels/LeadersPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';

// 1. Tipos y Títulos
export type Section =
  | 'overview' | 'projects' | 'fichas' | 'users' | 'leaders'
  | 'notifications' | 'settings' | 'profile';

const TITLES: Record<Section, string> = {
  overview:      'Panel de control',
  projects:      'Proyectos',
  fichas:        'Fichas de formación',
  users:         'Usuarios',
  leaders:       'Líderes técnicos',
  notifications: 'Notificaciones',
  settings:      'Configuración',
  profile:       'Mi perfil',
};

const panelVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

export const AdminDashboard = () => {
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>('overview');

  // 2. Lógica de combinación: Filtro de secciones por ROL
  // Aquí defines qué puede ver cada quién basándote en tu segundo código
  const allowedSections = useMemo(() => {
    if (!user) return [];

    switch (user.rol) {
      case 'coordinador':
        return ['overview', 'projects', 'fichas', 'users', 'leaders', 'notifications', 'settings', 'profile'];
      
      case 'instructor':
        return ['overview', 'projects', 'fichas', 'notifications', 'settings', 'profile'];
      
      case 'lider_tecnico':
        return ['overview', 'projects', 'notifications', 'settings', 'profile'];
      
      default:
        return ['overview', 'profile'];
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-surface-bg overflow-hidden">
      {/* El Sidebar ahora recibe las secciones permitidas para no mostrar botones prohibidos */}
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

        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
            >
              {/* Renderizado condicional respetando la jerarquía */}
              {section === 'overview'      && <Overview />}
              {section === 'projects'      && <ProjectsPanel />}
              
              {/* Estas secciones solo se montan si el rol las permite */}
              {section === 'fichas'        && allowedSections.includes('fichas') && <FichasPanel />}
              {section === 'users'         && allowedSections.includes('users')  && <UsersPanel />}
              {section === 'leaders'       && allowedSections.includes('leaders') && <LeadersPanel />}
              
              {section === 'notifications'  && <NotificationsPanel />}
              {section === 'settings'       && <SettingsPanel />}
              {section === 'profile'        && <ProfilePage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};