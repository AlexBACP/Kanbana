import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useSocket } from '../hooks/useSocket';

export const MainLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useSocket(user?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar setSection={() => {}} activeSection="overview" />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-dark-bg/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};