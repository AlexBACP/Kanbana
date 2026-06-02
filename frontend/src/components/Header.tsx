import { NotificationBell } from './NotificationBell';
import { Avatar } from './Avatar';
import { useAuthStore } from '../store/auth.store';

export const Header = () => {
  const { user } = useAuthStore();

  return (
    <header className="h-16 bg-dark-card/80 backdrop-blur-md border-b border-dark-border px-6 flex items-center justify-between z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-black text-dark-text tracking-widest uppercase opacity-70">ADSO Tracker</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg/50 rounded-xl border border-dark-border">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Servidor Online</span>
        </div>
        <NotificationBell />
        <div className="h-8 w-px bg-dark-border mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-dark-text">{user?.nombre}</p>
            <p className="text-[10px] text-dark-muted font-bold capitalize">{user?.rol?.replace('_', ' ')}</p>
          </div>
          <Avatar nombre={user?.nombre || ''} size="sm" avatarUrl={user?.avatar_url} />
        </div>
      </div>
    </header>
  );
};