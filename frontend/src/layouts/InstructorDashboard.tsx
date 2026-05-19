/**
 * InstructorDashboard
 *
 * El instructor SOLO ve:
 *   - Sus fichas asignadas
 *   - Los proyectos de esas fichas donde él es instructor
 *   - Los aprendices y líderes de esos proyectos
 *   - Los tickets de esos proyectos
 *
 * NO puede ver fichas de otros instructores.
 * NO puede ver usuarios fuera de sus fichas.
 * SÍ puede cambiar rol aprendiz → lider_tecnico dentro de sus proyectos.
 * SÍ puede crear tickets en sus proyectos.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { projectService } from '../services/project.service';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { InstructorOverview } from '../dashboard/instructor/InstructorOverview';
import { InstructorProyectos } from '../dashboard/instructor/InstructorProyectos';
import { InstructorEquipo } from '../dashboard/instructor/InstructorEquipo';
import { Section } from './AdminDashboard';

type InstructorSection = 'overview' | 'fichas' | 'proyectos' | 'equipo' | 'notificaciones' | 'configuracion' | 'perfil';

const SECTION_MAP: Record<InstructorSection, Section> = {
  overview:      'overview',
  fichas:        'fichas',
  proyectos:     'projects',
  equipo:        'users',
  notificaciones:'notifications',
  configuracion: 'settings',
  perfil:        'profile',
};

const REVERSE_MAP: Record<string, InstructorSection> = {
  overview:      'overview',
  fichas:        'fichas',
  projects:      'proyectos',
  users:         'equipo',
  notifications: 'notificaciones',
  settings:      'configuracion',
  profile:       'perfil',
};

const TITLES: Record<InstructorSection, string> = {
  overview:      'Mi panel',
  fichas:        'Mis fichas',
  proyectos:     'Mis proyectos',
  equipo:        'Mi equipo',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const ALLOWED: Section[] = ['overview', 'projects', 'fichas', 'users', 'notifications', 'settings', 'profile'];

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const InstructorDashboard = () => {
  const [section, setSection] = useState<InstructorSection>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // Pre-cargar proyectos del instructor para el badge de conteo
  const { data: misProyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });

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
              {section === 'overview'       && <InstructorOverview onNavigate={(s: any) => setSection(s)} />}
              {section === 'fichas'         && <FichasPanel />}
              {section === 'proyectos'      && <InstructorProyectos />}
              {section === 'equipo'         && <InstructorEquipo />}
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