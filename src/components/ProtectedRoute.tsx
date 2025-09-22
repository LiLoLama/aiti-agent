import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AccessRevoked: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Zugriff gesperrt</h1>
      <p className="text-slate-300">
        Dein Konto wurde deaktiviert. Bitte wende dich an den Administrator, wenn du glaubst, dass es sich um einen Fehler
        handelt.
      </p>
    </div>
  </div>
);

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <span className="animate-pulse text-lg">Wird geladen…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.access_granted === false) {
    return <AccessRevoked />;
  }

  return <>{children}</>;
};
