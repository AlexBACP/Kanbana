/**
 * AprendizDashboard — Layout exclusivo del aprendiz regular (sin rol de líder técnico).
 * Ruta: /kanban
 *
 * Overview → AprendizOverview  (banner con reloj, fecha, sugerencia y avance)
 * Tareas   → TareasPanel       (pool, mis tareas, filtros, búsqueda — zinc global styles)
 *
 * Se eliminaron los componentes inline MiTablero y MisTickets (eran duplicados
 * con estilos inconsistentes). Toda la lógica vive en los paneles dedicados.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAuth }      from '../hooks/useAuth';
import { useRefreshMe } from '../hooks/useRefreshMe';
import { TopBar }       from '../components/TopBar';
import { Sidebar }      from '../components/Sidebar';
import { AprendizOverview }  from '../dashboard/Aprendiz/AprendizOverview';
import { AprendizTablero }  from '../dashboard/Aprendiz/AprendizTablero';
import { TareasPanel }      from '../dashboard/panels/TareasPanel';
import { RecursosPanel }    from '../components/RecursosPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel }      from '../dashboard/panels/SettingsPanel';
import { ProfilePage }        from '../pages/ProfilePage';
import { projectService }     from '../services/project.service';
import { useQuery }           from '@tanstack/react-query';
import { Section }            from './AdminDashboard';

// ── Tipos ────────────────────────────────────────────────────────────────────
type Sec = 'overview' | 'tablero' | 'tareas' | 'recursos' | 'notificaciones' | 'settings' | 'profile';

// Mapeo interno Sec → Section (para el sidebar compartido)
const SECTION_MAP: Record<Sec, Section> = {
  overview:      'overview',
  tablero:       'tablero',
  tareas:        'tareas',
  recursos:      'recursos',
  notificaciones:'notifications',
  settings:      'settings',
  profile:       'profile',
};

// Mapeo inverso Section → Sec (cuando el sidebar emite un cambio)
const REVERSE_MAP: Record<string, Sec> = {
  overview:      'overview',
  tablero:       'tablero',
  tareas:        'tareas',
  recursos:      'recursos',
  notifications: 'notificaciones',
  settings:      'settings',
  profile:       'profile',
};

const TITLES: Record<Sec, string> = {
  overview:      'Mi Panel',
  tablero:       'Tablero del Proyecto',
  tareas:        'Mis Tareas',
  recursos:      'Recursos del Proyecto',
  notificaciones:'Notificaciones',
  settings:      'Configuración',
  profile:       'Mi Perfil',
};

// Solo las secciones que el aprendiz puede ver
// 'tareas' es el key correcto para que el sidebar muestre "Mis Tareas"
const ALLOWED: Section[] = ['overview', 'tablero', 'tareas', 'recursos', 'notifications', 'settings', 'profile'];

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

// ── Componente ───────────────────────────────────────────────────────────────
export const AprendizDashboard = () => {
  const { user } = useAuthStore();
  const { logout } = useAuth();
  useRefreshMe(); // Detecta cambios de rol/sub-rol mientras el usuario está logueado
  const [searchParams, setSearchParams] = useSearchParams();

  // Restaurar sección desde la URL al volver de una página externa
  const [sec, setSec] = useState<Sec>(() => {
    const s = searchParams.get('s') as Sec | null;
    return s || 'overview';
  });

  // Obtener proyectos del aprendiz
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  const sidebarSection = SECTION_MAP[sec];

  const changeSec = useCallback((s: Sec) => {
    setSec(s);
    setSearchParams({ s }, { replace: true });
  }, [setSearchParams]);

  const handleSidebarSection = (s: Section) => {
    const mapped = REVERSE_MAP[s];
    if (mapped) changeSec(mapped);
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">

      {/* ── Sidebar compartido ─────────────────────────────────────────── */}
      <Sidebar
        setSection={handleSidebarSection}
        activeSection={sidebarSection}
        allowedSections={ALLOWED}
      />

      {/* ── Contenido principal ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={TITLES[sec]}
          user={user}
          onNotifications={() => changeSec('notificaciones')}
          onProfile={() => changeSec('profile')}
          onSettings={() => changeSec('settings')}
          onNavigate={(s) => changeSec(s as Sec)}
          onLogout={logout}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={sec}
              variants={fade}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className={
                sec === 'tablero'
                  ? 'flex-1 flex flex-col min-h-0 p-6'
                  : sec === 'tareas'
                    ? 'flex-1 flex flex-col min-h-0'
                    : sec === 'overview'
                      ? 'flex-1 overflow-y-auto'
                      : 'flex-1 overflow-y-auto p-6'
              }
            >
              {sec === 'overview'       && <AprendizOverview />}
              {sec === 'tablero'        && <AprendizTablero />}
              {sec === 'tareas'         && <TareasPanel />}
              {sec === 'recursos'       && (miProyecto
                ? <RecursosPanel proyectoId={miProyecto.id} canManage={false} />
                : <div className="flex flex-col items-center justify-center py-24 text-zinc-500"><p className="text-sm font-bold">Sin proyecto asignado</p><p className="text-xs mt-1">Pide al instructor que te asigne a un proyecto</p></div>
              )}
              {sec === 'notificaciones' && <NotificationsPanel />}
              {sec === 'settings'       && <SettingsPanel />}
              {sec === 'profile'        && <ProfilePage />}
              {/* Sync URL if somehow sec changed without changeSec (sidebar, etc.) */}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
