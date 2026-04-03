import { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { User } from '../store/auth.store';
import { notificationService } from '../services/notification.service';
import { motion, AnimatePresence } from 'framer-motion';

interface TopBarProps {
  title: string;
  user: User | null;
  onNotifications: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export const TopBar = ({ title, user, onNotifications, onProfile, onSettings, onLogout }: TopBarProps) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch notifications count
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
    refetchInterval: 30000,
  });
  const unread = (notifications as any[]).filter((n: any) => !n.leida).length;

  // Click outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const avatarContent = user?.avatar_url ? (
    <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
  ) : (
    <span className="text-sm font-black text-white">
      {user?.nombre?.slice(0, 2).toUpperCase() || 'KA'}
    </span>
  );

  return (
    <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6 shrink-0 z-10">
      {/* Left: Page title */}
      <div>
        <h2 className="text-lg font-black text-dark-text tracking-tight">{title}</h2>
        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">
          SENA — ADSO · Kanbana v1.0
        </p>
      </div>

      {/* Right: Notifs + Profile */}
      <div className="flex items-center gap-3">

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative p-2.5 rounded-2xl text-dark-muted hover:text-dark-text hover:bg-dark-bg/60 transition-all border border-transparent hover:border-dark-border"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 bg-dark-card border border-dark-border rounded-[1.5rem] shadow-2xl overflow-hidden z-50"
              >
                <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
                  <span className="text-sm font-black text-dark-text uppercase tracking-widest">Notificaciones</span>
                  {unread > 0 && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-xl font-black">
                      {unread} nuevas
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {(notifications as any[]).length === 0 ? (
                    <div className="p-6 text-center text-dark-muted text-xs font-bold uppercase tracking-widest">
                      Sin notificaciones
                    </div>
                  ) : (
                    (notifications as any[]).slice(0, 5).map((n: any) => (
                      <div
                        key={n.id}
                        className={`px-5 py-3.5 border-b border-dark-border/50 last:border-0 transition-colors ${!n.leida ? 'bg-primary-500/5' : ''}`}
                      >
                        <p className="text-xs font-bold text-dark-text">{n.mensaje || n.titulo}</p>
                        <p className="text-[10px] text-dark-muted mt-0.5">{n.tipo}</p>
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={() => { setShowNotifDropdown(false); onNotifications(); }}
                  className="w-full py-3 text-[11px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest transition-colors border-t border-dark-border"
                >
                  Ver todas las notificaciones
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile button + dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl hover:bg-dark-bg/60 border border-transparent hover:border-dark-border transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-primary-500/30">
              {avatarContent}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-black text-dark-text leading-none">{user?.nombre?.split(' ')[0]}</p>
              <p className="text-[10px] text-dark-muted capitalize font-bold">{user?.rol?.replace('_', ' ')}</p>
            </div>
            <ChevronDown size={14} className={`text-dark-muted transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-56 bg-dark-card border border-dark-border rounded-[1.5rem] shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3.5 border-b border-dark-border">
                  <p className="text-sm font-black text-dark-text truncate">{user?.nombre}</p>
                  <p className="text-[11px] text-dark-muted truncate">{user?.correo}</p>
                </div>
                {[
                  { icon: UserIcon, label: 'Ver Perfil', action: () => { onProfile(); setShowProfileMenu(false); } },
                  { icon: Settings, label: 'Configuración', action: () => { onSettings(); setShowProfileMenu(false); } },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-dark-muted hover:text-dark-text hover:bg-dark-bg/50 transition-all"
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
                <div className="border-t border-dark-border">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
                  >
                    <LogOut size={16} />
                    Cerrar Sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
