import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <span className="animate-pulse text-lg">Prüfe Berechtigungen…</span>
      </div>
    );
  }

  if (!profile?.admin) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};
