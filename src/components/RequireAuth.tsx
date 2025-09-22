import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth() {
  const { currentUser } = useAuth();
  const location = useLocation();

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
