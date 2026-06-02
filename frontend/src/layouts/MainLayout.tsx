import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../hooks/useAuth';

export const MainLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar setSection={() => {}} activeSection="overview" />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          title=""
          user={user}
          onNotifications={() => {}}
          onProfile={() => {}}
          onSettings={() => {}}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
