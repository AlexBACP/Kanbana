import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { projectService } from '../services/project.service';
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
import { RecursosPanel } from '../components/RecursosPanel';

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

  // ── Sincroniza la sección cuando la URL cambia (p.ej. botón "atrás" del browser
  //    después de navegar a /tickets/:id, /projects/:id, etc.)
  useEffect(() => {
    const s = searchParams.get('s') as Section | null;
    if (s && s !== section) {
      setSection(s);
    }
  }, [searchParams]);

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
      return ['overview','projects','recursos','notifications','settings','profile'];
    }
    // Aprendiz sin sub-rol de líder
    return ['overview','tareas','notifications','settings','profile'];
  }, [user, esLider]);

  // ── Proyecto del líder (solo se carga cuando es líder técnico) ───────────────
  const { data: liderProyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn:  () => projectService.getForMe(),
    enabled:  !!esLider,
    staleTime: 60_000,
  });
  const miProyectoId = esLider ? ((liderProyectos as any[])[0]?.id ?? null) : null;

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
          onNavigate={(s) => changeSection(s as Section)}
          onLogout={logout}
        />

        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
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
              {/* Recursos del proyecto — líder técnico */}
              {section === 'recursos' && allowedSections.includes('recursos') && (
                miProyectoId
                  ? <div className="p-6"><RecursosPanel proyectoId={miProyectoId} canManage={true} /></div>
                  : <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
                      <p className="text-sm font-bold">Sin proyecto asignado</p>
                      <p className="text-xs mt-1">El instructor debe asignarte como líder de un proyecto</p>
                    </div>
              )}
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