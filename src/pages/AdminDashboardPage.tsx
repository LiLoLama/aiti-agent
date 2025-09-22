import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../hooks/useAuth';

type ManagedUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  admin: boolean;
  access_granted: boolean | null;
  agentCount: number;
};

export const AdminDashboardPage: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    const { data, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, admin, access_granted');

    if (profilesError) {
      console.error(profilesError);
      setError('Nutzerdaten konnten nicht geladen werden.');
      setLoading(false);
      return;
    }

    const userRows = data ?? [];

    const usersWithCounts: ManagedUser[] = [];

    for (const row of userRows) {
      const { count, error: countError } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', row.id);

      if (countError) {
        console.warn('Konnte Agent-Anzahl nicht ermitteln', countError);
      }

      usersWithCounts.push({
        id: row.id as string,
        email: row.email as string | null,
        full_name: row.full_name as string | null,
        admin: Boolean(row.admin),
        access_granted: (row.access_granted as boolean | null) ?? null,
        agentCount: count ?? 0,
      });
    }

    setUsers(usersWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleAccess = async (managedUser: ManagedUser) => {
    setUpdatingUserId(managedUser.id);
    const nextValue = !(managedUser.access_granted ?? true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ access_granted: nextValue })
      .eq('id', managedUser.id);

    if (updateError) {
      console.error(updateError);
      setError('Zugriff konnte nicht aktualisiert werden.');
      setUpdatingUserId(null);
      return;
    }

    setUsers((prev) =>
      prev.map((entry) =>
        entry.id === managedUser.id
          ? {
              ...entry,
              access_granted: nextValue,
            }
          : entry
      )
    );

    if (managedUser.id === user?.id) {
      // Wenn der Admin sich selbst den Zugriff entzieht, sofort Profil aktualisieren
      await fetchUsers();
    }

    setUpdatingUserId(null);
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.admin && !b.admin) return -1;
      if (!a.admin && b.admin) return 1;
      const nameA = (a.full_name ?? a.email ?? '').toLowerCase();
      const nameB = (b.full_name ?? b.email ?? '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  return (
    <div className="min-h-screen bg-[#101010] text-white">
      <header className="border-b border-white/10 bg-[#161616]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 lg:px-12">
          <div>
            <h1 className="text-2xl font-semibold">Admin-Dashboard</h1>
            <p className="text-sm text-white/60">Verwalte Benutzerzugänge und Agent-Aktivität.</p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-white/70">
            <Link to="/chat" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
              Zum Chat
            </Link>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10"
            >
              Abmelden
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 lg:px-12">
        {profile ? (
          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <p className="text-sm text-white/60">Angemeldet als</p>
            <p className="text-lg font-semibold">{profile.full_name ?? profile.email ?? 'Admin'}</p>
            <p className="text-sm text-emerald-400">Administrator</p>
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-[#161616]/80 p-6 shadow-[0_0_80px_rgba(76,29,149,0.18)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Benutzer</h2>
            <button
              onClick={fetchUsers}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Aktualisieren
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

          {loading ? (
            <div className="mt-8 flex items-center justify-center text-white/70">Lade Benutzer…</div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="text-xs uppercase text-white/50">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">E-Mail</th>
                    <th className="px-4 py-3">Rolle</th>
                    <th className="px-4 py-3">Agenten</th>
                    <th className="px-4 py-3 text-right">Zugriff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {sortedUsers.map((entry) => (
                    <tr key={entry.id} className="transition hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-medium">{entry.full_name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">{entry.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        {entry.admin ? (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-300">
                            Admin
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-2 py-1 text-xs">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{entry.agentCount}</td>
                      <td className="px-4 py-3 text-right">
                        {entry.admin ? (
                          <span className="text-xs text-emerald-400">Immer aktiv</span>
                        ) : (
                          <button
                            onClick={() => handleToggleAccess(entry)}
                            disabled={updatingUserId === entry.id}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed"
                          >
                            {entry.access_granted === false ? 'Aktivieren' : 'Deaktivieren'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
