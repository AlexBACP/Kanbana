import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Overview } from '../dashboard/components/Overview';
import { AprendizOverview } from '../dashboard/Aprendiz/AprendizOverview';
import { LiderDashboard }  from '../dashboard/Lider/LiderDashboard';
import { LiderProyecto }   from '../dashboard/Lider/LiderProyecto';
import { InstructorOverview } from '../dashboard/instructor/InstructorOverview';
import { ProjectsPanel } from '../dashboard/panels/ProjectsPanel';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { UsersPanel } from '../dashboard/panels/UsersPanel';
import { LeadersPanel } from '../dashboard/panels/LeadersPanel';
import { MiEquipoPanel } from '../dashboard/panels/MiEquipoPanel';
import { TareasPanel } from '../dashboard/panels/TareasPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';

export type Section =
  | 'overview' | 'projects' | 'fichas' | 'users' | 'leaders' | 'equipo' | 'tareas' | 'tickets'
  | 'recursos' | 'tablero'
  | 'notifications' | 'settings' | 'profile';

const TITLES: Record<Section, string> = {
  overview:      'Panel de control',
  projects:      'Proyectos',
  fichas:        'Fichas de formación',
  users:         'Usuarios',
  leaders:       'Líderes técnicos',
  equipo:        'Mi Equipo',
  tareas:        'Mis Tareas',
  tickets:       'Tareas del proyecto',
  recursos:      'Recursos del proyecto',
  tablero:       'Tablero del proyecto',
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
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Sección activa: restaurada desde ?s= en la URL al volver de una página externa
  const [section, setSection] = useState<Section>(() => {
    const s = searchParams.get('s') as Section | null;
    return s || 'overview';
  });

  const esLider      = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const esInstructor = user?.rol === 'instructor';

  // ── Cambia sección y actualiza la URL para que el botón "atrás" del browser
  //    regrese aquí (en lugar de al overview) tras navegar a rutas externas.
  const changeSection = useCallback((s: Section) => {
    setSection(s);
    setSearchParams({ s }, { replace: true });
  }, [setSearchParams]);

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
      return ['overview','projects','notifications','settings','profile'];
    }
    // Aprendiz sin sub-rol de líder
    return ['overview','tareas','notifications','settings','profile'];
  }, [user, esLider]);

  if (!user) return null;

  // Aprendiz sin sub-rol de líder técnico
  const esAprendizNormal = user.rol === 'aprendiz' && !esLider;

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar
        setSection={changeSection}
        activeSection={section}
        allowedSections={allowedSections}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={section === 'projects' && esLider ? 'Mi Proyecto' : TITLES[section]}
          user={user}
          onNotifications={() => changeSection('notifications')}
          onProfile={() => changeSection('profile')}
          onSettings={() => changeSection('settings')}
          onNavigate={changeSection}
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
              {/* Overview por rol */}
              {section === 'overview' && (
                esAprendizNormal  ? <AprendizOverview /> :
                esLider           ? <LiderDashboard />   :
                esInstructor      ? <InstructorOverview onNavigate={changeSection} /> :
                                    <Overview />
              )}
              {/* Proyectos: lider → panel unificado con tabs, otros roles → listado */}
              {section === 'projects' && (esLider ? <LiderProyecto /> : <ProjectsPanel />)}
              {section === 'fichas'        && allowedSections.includes('fichas')   && <FichasPanel />}
              {section === 'users'         && allowedSections.includes('users')    && <UsersPanel />}
              {section === 'leaders'       && allowedSections.includes('leaders')  && <LeadersPanel />}
              {section === 'equipo'        && allowedSections.includes('equipo')   && <MiEquipoPanel />}
              {/* Mis Tareas — solo el aprendiz normal */}
              {section === 'tareas'        && allowedSections.includes('tareas')   && <TareasPanel />}
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