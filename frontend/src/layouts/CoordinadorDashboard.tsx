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
import { Sidebar } from '../components/Sidebar';
import { Overview } from '../dashboard/components/Overview';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { ProjectsPanel } from '../dashboard/panels/ProjectsPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { Section } from './AdminDashboard';

type CoordSection = 'overview' | 'fichas' | 'usuarios' | 'proyectos' | 'notificaciones' | 'configuracion' | 'perfil';

// Mapeo de secciones del coordinador a las keys del Sidebar compartido
const SECTION_MAP: Record<CoordSection, Section> = {
  overview:      'overview',
  fichas:        'fichas',
  proyectos:     'projects',
  usuarios:      'users',
  notificaciones:'notifications',
  configuracion: 'settings',
  perfil:        'profile',
};

const REVERSE_MAP: Record<string, CoordSection> = {
  overview:      'overview',
  fichas:        'fichas',
  projects:      'proyectos',
  users:         'usuarios',
  notifications: 'notificaciones',
  settings:      'configuracion',
  profile:       'perfil',
};

const TITLES: Record<CoordSection, string> = {
  overview:      'Panel de control',
  fichas:        'Fichas de formación',
  usuarios:      'Usuarios',
  proyectos:     'Proyectos',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const ALLOWED: Section[] = ['overview', 'fichas', 'projects', 'users', 'leaders', 'notifications', 'settings', 'profile'];

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const CoordinadorDashboard = () => {
  const [section, setSection] = useState<CoordSection>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // El Sidebar usa las keys de AdminDashboard; convertimos al vuelo
  const sidebarSection = SECTION_MAP[section];
  const handleSidebarSection = (s: Section) => {
    const mapped = REVERSE_MAP[s];
    if (mapped) setSection(mapped);
  };

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* ── Sidebar compartido ──────────────────────────────────── */}
      <Sidebar
        setSection={handleSidebarSection}
        activeSection={sidebarSection}
        allowedSections={ALLOWED}
      />

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