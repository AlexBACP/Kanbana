/**
 * LiderDashboard
 *
 * El líder técnico ve SOLO:
 *   - Su proyecto asignado (donde liderId = él)
 *   - Los miembros de ese proyecto (aprendices de su equipo)
 *   - Los tickets de ese proyecto
 *   - Su instructor (solo para referencia, no puede editarlo)
 *
 * Puede:
 *   - Crear tickets y asignarlos a aprendices de su proyecto
 *   - Mover tickets entre sprints
 *   - Ver y gestionar el backlog
 *   - Crear sprints
 *
 * NO puede:
 *   - Ver otros proyectos
 *   - Ver usuarios fuera de su proyecto
 *   - Cambiar roles
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { projectService } from '../services/project.service';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { LiderOverview } from '../dashboard/Lider/LiderOverview';
import { LiderTablero } from '../dashboard/Lider/LiderTablero';
import { LiderTickets } from '../dashboard/Lider/LiderTickets';
import { LiderEquipo } from '../dashboard/Lider/LiderEquipo';
import { Section } from './AdminDashboard';

type LiderSection = 'overview' | 'tablero' | 'tickets' | 'equipo' | 'notificaciones' | 'configuracion' | 'perfil';

const SECTION_MAP: Record<LiderSection, Section> = {
  overview:      'overview',
  tablero:       'projects',  // reutilizamos 'projects' para el kanban
  tickets:       'fichas',    // reutilizamos 'fichas' para tickets
  equipo:        'users',
  notificaciones:'notifications',
  configuracion: 'settings',
  perfil:        'profile',
};

const REVERSE_MAP: Record<string, LiderSection> = {
  overview:      'overview',
  projects:      'tablero',
  fichas:        'tickets',
  users:         'equipo',
  notifications: 'notificaciones',
  settings:      'configuracion',
  profile:       'perfil',
};

const TITLES: Record<LiderSection, string> = {
  overview:      'Mi panel',
  tablero:       'Tablero Kanban',
  tickets:       'Tickets del proyecto',
  equipo:        'Mi equipo',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const ALLOWED: Section[] = ['overview', 'projects', 'fichas', 'users', 'notifications', 'settings', 'profile'];

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const LiderDashboard = () => {
  const [section, setSection] = useState<LiderSection>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // Cargar su proyecto para mostrar nombre en sidebar
  const { data: proyectos = [] } = useQuery({
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
              {section === 'overview'       && <LiderOverview />}
              {section === 'tablero'        && <LiderTablero />}
              {section === 'tickets'        && <LiderTickets />}
              {section === 'equipo'         && <LiderEquipo />}
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