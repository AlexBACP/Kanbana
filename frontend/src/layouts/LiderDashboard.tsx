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
import {
  LayoutDashboard, Kanban, Ticket, Users, Bell, Settings, ChevronRight, LogOut, FolderKanban,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { LiderOverview } from '../dashboard/Lider/LiderOverview';
import { LiderTablero } from '../dashboard/Lider/LiderTablero';
import { LiderTickets } from '../dashboard/Lider/LiderTickets';
import { LiderEquipo } from '../dashboard/Lider/LiderEquipo';

type Section = 'overview' | 'tablero' | 'tickets' | 'equipo' | 'notificaciones' | 'configuracion' | 'perfil';

const TITLES: Record<Section, string> = {
  overview:      'Mi panel',
  tablero:       'Tablero Kanban',
  tickets:       'Tickets del proyecto',
  equipo:        'Mi equipo',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const LiderDashboard = () => {
  const [section, setSection] = useState<Section>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // Cargar su proyecto para mostrar nombre en sidebar
  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });
  const miProyecto = (proyectos as any[])[0] ?? null;

  const MENU = [
    { key: 'overview' as Section, label: 'Mi panel',  icon: LayoutDashboard },
    { key: 'tablero'  as Section, label: 'Kanban',     icon: Kanban },
    { key: 'tickets'  as Section, label: 'Tickets',    icon: Ticket },
    { key: 'equipo'   as Section, label: 'Mi equipo',  icon: Users },
  ];

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 bg-dark-card border-r border-dark-border flex flex-col h-full shrink-0">
        <div className="px-4 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">K</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-dark-text leading-none">Kanbana</p>
              <p className="text-[10px] text-dark-muted mt-0.5">SENA · ADSO</p>
            </div>
          </div>
        </div>

        {/* Proyecto activo */}
        {miProyecto && (
          <div className="px-4 py-3 border-b border-dark-border bg-dark-bg/30">
            <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-1">Proyecto</p>
            <div className="flex items-center gap-2">
              <FolderKanban size={12} className="text-emerald-400 shrink-0" />
              <p className="text-xs font-medium text-dark-text truncate">{miProyecto.nombre}</p>
            </div>
            {miProyecto.instructor && (
              <p className="text-[10px] text-dark-muted mt-1">
                Instructor: {miProyecto.instructor.nombre}
              </p>
            )}
          </div>
        )}

        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          <p className="px-2 text-[10px] font-medium text-dark-muted uppercase tracking-widest mb-2">
            Mi espacio
          </p>
          {MENU.map(({ key, label, icon: Icon }) => {
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-emerald-600/10 text-emerald-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {active && <ChevronRight size={12} className="text-emerald-400 shrink-0" />}
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
                    ? 'bg-emerald-600/10 text-emerald-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-2 border-t border-dark-border space-y-1">
          <button
            onClick={() => setSection('perfil')}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-dark-border/30 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-[9px] font-semibold text-emerald-400">{user?.nombre?.slice(0,2).toUpperCase()}</span>
              }
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-dark-text truncate">{user?.nombre}</p>
              <p className="text-[10px] text-dark-muted">Líder técnico</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-dark-muted hover:text-rose-400 hover:bg-rose-500/5 transition-colors text-xs"
          >
            <LogOut size={13} /> Cerrar sesión
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