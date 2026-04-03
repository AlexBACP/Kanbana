import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Overview } from '../dashboard/components/Overview';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { LeadersPanel } from '../dashboard/panels/LeadersPanel';

export type Section =
  | 'overview' | 'fichas' | 'users' | 'leaders'
  | 'notifications' | 'settings' | 'profile';

const TITLES: Record<Section, string> = {
  overview:      'Panel de Control',
  fichas:        'Fichas de Formación',
  users:         'Gestión de Usuarios',
  leaders:       'Squad Leaders',
  notifications: 'Centro de Notificaciones',
  settings:      'Configuración',
  profile:       'Mi Perfil',
};

const panel = { initial:{opacity:0,y:10}, animate:{opacity:1,y:0}, exit:{opacity:0,y:-8} };

export const AdminDashboard = () => {
  const [section, setSection] = useState<Section>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      <Sidebar setSection={setSection} activeSection={section} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={TITLES[section]}
          user={user}
          onNotifications={() => setSection('notifications')}
          onProfile={() => setSection('profile')}
          onSettings={() => setSection('settings')}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={section} variants={panel} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.18 }}>
              {section === 'overview'      && <Overview />}
              {section === 'fichas'        && <FichasPanel />}
              {section === 'users'         && <UsersPanel />}
              {section === 'leaders'       && <LeadersPanel />}
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
