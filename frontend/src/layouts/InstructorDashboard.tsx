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
import {
  LayoutDashboard, GraduationCap, FolderKanban,
  Users, Bell, Settings, ChevronRight, LogOut,
  Ticket, BarChart2,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { FichasPanel } from '../dashboard/panels/FichasPanel';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { InstructorOverview } from '../dashboard/instructor/InstructorOverview';
import { InstructorProyectos } from '../dashboard/instructor/InstructorProyectos';
import { InstructorEquipo } from '../dashboard/instructor/InstructorEquipo';

type Section = 'overview' | 'fichas' | 'proyectos' | 'equipo' | 'notificaciones' | 'configuracion' | 'perfil';

const TITLES: Record<Section, string> = {
  overview:      'Mi panel',
  fichas:        'Mis fichas',
  proyectos:     'Mis proyectos',
  equipo:        'Mi equipo',
  notificaciones:'Notificaciones',
  configuracion: 'Configuración',
  perfil:        'Mi perfil',
};

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export const InstructorDashboard = () => {
  const [section, setSection] = useState<Section>('overview');
  const { user } = useAuthStore();
  const { logout } = useAuth();

  // Pre-cargar proyectos del instructor para el badge de conteo
  const { data: misProyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: projectService.getForMe,
    staleTime: 60_000,
  });
  const totalProyectos = (misProyectos as any[]).length;

  const MENU = [
    { key: 'overview'  as Section, label: 'Mi panel',       icon: LayoutDashboard, badge: null },
    { key: 'fichas'    as Section, label: 'Mis fichas',      icon: GraduationCap,   badge: null },
    { key: 'proyectos' as Section, label: 'Mis proyectos',   icon: FolderKanban,    badge: totalProyectos || null },
    { key: 'equipo'    as Section, label: 'Mi equipo',       icon: Users,           badge: null },
  ];

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 bg-dark-card border-r border-dark-border flex flex-col h-full shrink-0">
        <div className="px-4 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">K</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-dark-text leading-none">Kanbana</p>
              <p className="text-[10px] text-dark-muted mt-0.5">SENA · ADSO</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          <p className="px-2 text-[10px] font-medium text-dark-muted uppercase tracking-widest mb-2">
            Instrucción
          </p>
          {MENU.map(({ key, label, icon: Icon, badge }) => {
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-primary-600/10 text-primary-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge !== null && (
                  <span className="text-[10px] bg-primary-600/20 text-primary-400 rounded-md px-1.5 py-0.5 font-semibold">
                    {badge}
                  </span>
                )}
                {active && !badge && <ChevronRight size={12} className="text-primary-400 shrink-0" />}
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
                    ? 'bg-primary-600/10 text-primary-400'
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
            <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-[9px] font-semibold text-blue-400">{user?.nombre?.slice(0,2).toUpperCase()}</span>
              }
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-dark-text truncate">{user?.nombre}</p>
              <p className="text-[10px] text-dark-muted">Instructor</p>
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
              {section === 'overview'       && <InstructorOverview onNavigate={setSection} />}
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