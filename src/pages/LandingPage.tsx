import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <span className="animate-pulse text-lg">Wird geladen…</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-16 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.35),_transparent_65%)]" aria-hidden />
      <div className="relative z-10 w-full max-w-2xl space-y-8 text-center">
        <header className="space-y-4">
          <span className="inline-flex rounded-full bg-slate-900/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-300">
            Willkommen bei deinem Agentenstudio
          </span>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Melde dich an oder erstelle ein Konto, um deine Agents zu steuern.
          </h1>
          <p className="text-slate-300">
            Verwalte deine Unterhaltungen, passe deine Agenten an und teile Zugänge mit deinem Team.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl border border-indigo-400/60 bg-indigo-500/90 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
          >
            Einloggen
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-4 text-lg font-semibold text-slate-100 shadow-lg shadow-slate-900/40 transition hover:border-indigo-400 hover:text-white"
          >
            Registrieren
          </Link>
        </div>

        <p className="text-sm text-slate-400">
          Registrierungen sind geöffnet. Sobald du eingeloggt bist, kannst du sofort loslegen.
        </p>
      </div>
    </div>
  );
};
