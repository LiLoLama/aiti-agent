import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth() {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4">
        <div className="rounded-3xl border border-white/10 bg-[#151515] px-6 py-4 text-center text-white shadow-glow">
          <p className="text-sm text-white/70">Authentifizierung wird geladen …</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!currentUser.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#161616] p-8 text-center text-white shadow-glow">
          <h2 className="text-2xl font-semibold">Zugang deaktiviert</h2>
          <p className="mt-4 text-sm text-white/70">
            Dein Account wurde deaktiviert. Bitte wende dich an das AITI Admin-Team, um wieder Zugriff zu erhalten.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
