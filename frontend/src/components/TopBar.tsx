import { useState, useRef, useEffect } from 'react';
import { Bell, Settings, LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user.types';
import { notificationService } from '../services/notification.service';

interface TopBarProps {
  title: string;
  user: User | null;
  onNotifications: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export const TopBar = ({ title, user, onNotifications, onProfile, onSettings, onLogout }: TopBarProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
    refetchInterval: 30000,
  });
  const unread = (notifications as any[]).filter((n: any) => !n.leida).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-12 bg-surface-card border-b border-surface-border flex items-center justify-between px-5 shrink-0">
      {/* Título */}
      <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>

      {/* Acciones */}
      <div className="flex items-center gap-1">
        {/* Notificaciones */}
        <button
          onClick={onNotifications}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
          title="Notificaciones"
        >
          <Bell size={15} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
          )}
        </button>

        {/* Configuración */}
        <button
          onClick={onSettings}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
          title="Configuración"
        >
          <Settings size={15} />
        </button>

        {/* Perfil */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-[9px] font-semibold text-primary-400">{user?.nombre?.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <span className="text-xs text-ink-secondary hidden sm:block max-w-[100px] truncate">
              {user?.nombre?.split(' ')[0]}
            </span>
            <ChevronDown size={11} className="text-ink-muted" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-elevated border border-surface-border rounded-xl shadow-lg z-50 py-1 animate-in">
              <div className="px-3 py-2 border-b border-surface-border mb-1">
                <p className="text-xs font-medium text-ink-primary truncate">{user?.nombre}</p>
                <p className="text-[10px] text-ink-muted truncate">{user?.correo}</p>
              </div>

              <button
                onClick={() => { onProfile(); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
              >
                <UserIcon size={13} />
                Mi perfil
              </button>
              <button
                onClick={() => { onSettings(); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
              >
                <Settings size={13} />
                Configuración
              </button>

              <div className="border-t border-surface-border mt-1 pt-1">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-secondary hover:text-danger hover:bg-danger-light transition-colors"
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
