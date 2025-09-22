import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { prepareImageForStorage } from '../utils/image';
import userAvatar from '../assets/default-user.svg';

export function ProfilePage() {
  const { currentUser, users, updateProfile, toggleUserActive, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser?.avatarUrl ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const displayedAvatar = avatarPreview ?? userAvatar;

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const result = await prepareImageForStorage(file, {
        maxDimension: 512,
        mimeType: 'image/jpeg',
        quality: 0.9
      });
      setAvatarPreview(result);
    } catch (error) {
      console.error('Profilbild konnte nicht verarbeitet werden.', error);
      setFeedback('error');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      updateProfile({
        name,
        bio,
        avatarUrl: avatarPreview
      });
      setFeedback('success');
    } catch (error) {
      console.error(error);
      setFeedback('error');
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const adminVisibleUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-20 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-10 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Zurück
        </button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/10 bg-[#141414]/90 p-8 shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Profil</p>
                <h1 className="mt-2 text-3xl font-semibold">Dein persönlicher Bereich</h1>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
              >
                Logout
              </button>
            </header>

            <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex flex-col items-center gap-3 text-center md:w-52">
                  <div className="relative h-32 w-32 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                    <img src={displayedAvatar} alt={name} className="h-full w-full object-cover" />
                  </div>
                  <label className="cursor-pointer text-xs font-semibold text-brand-gold hover:underline">
                    Neues Bild hochladen
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(event) => handleAvatarUpload(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      className="text-xs text-white/50 hover:text-white"
                      onClick={() => setAvatarPreview(null)}
                    >
                      Zurücksetzen
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-5">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">Name</label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">E-Mail</label>
                    <input
                      type="email"
                      className="mt-2 w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white/60"
                      value={currentUser.email}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">Über dich</label>
                    <textarea
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      placeholder="Welche Projekte setzt du mit dem AITI Agent um?"
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Rolle</p>
                      <p className="mt-2 text-sm font-semibold text-white">{currentUser.role === 'admin' ? 'Administrator' : 'Nutzer'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Status</p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                        {currentUser.isActive ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4 text-emerald-400" /> Aktiv
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-4 w-4 text-rose-400" /> Deaktiviert
                          </>
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Agents erstellt</p>
                      <p className="mt-2 text-sm font-semibold text-white">{currentUser.agentsBuilt}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">E-Mail</p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                        {currentUser.emailVerified ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4 text-emerald-400" /> Verifiziert
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-4 w-4 text-amber-400" /> Ausstehend
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {feedback === 'success' && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Profil aktualisiert!
                </div>
              )}
              {feedback === 'error' && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  Aktualisierung fehlgeschlagen. Bitte versuche es später erneut.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-6 py-3 text-sm font-semibold text-black shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Speichern …' : 'Änderungen speichern'}
                </button>
                <button
                  type="button"
                  className="text-sm text-white/50 hover:text-white"
                  onClick={() => {
                    setName(currentUser.name);
                    setBio(currentUser.bio ?? '');
                    setAvatarPreview(currentUser.avatarUrl ?? null);
                  }}
                >
                  Änderungen verwerfen
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[#141414]/90 p-8 shadow-2xl">
              <header>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Team</p>
                <h2 className="mt-2 text-2xl font-semibold">Nutzerübersicht</h2>
                <p className="mt-2 text-sm text-white/60">
                  Sieh dir an, wer bereits mit dem AITI Agent arbeitet. Admins können Zugänge verwalten und Accounts aktivieren oder deaktivieren.
                </p>
              </header>

              {currentUser.role !== 'admin' ? (
                <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Du benötigst Admin-Rechte, um die Nutzerliste einzusehen.
                </p>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5 text-white/60">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">E-Mail</th>
                        <th className="px-4 py-3 font-medium">Agents</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-[#121212]">
                      {adminVisibleUsers.map((user) => (
                        <tr key={user.id} className="text-white/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-semibold uppercase text-white/70">
                                {user.name
                                  .split(' ')
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                              <div>
                                <p className="font-semibold text-white">{user.name}</p>
                                <p className="text-xs text-white/40">{user.role === 'admin' ? 'Admin' : 'Nutzer'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">{user.agentsBuilt}</td>
                          <td className="px-4 py-3">
                            {user.isActive ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                                <CheckCircleIcon className="h-4 w-4" /> Aktiv
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
                                <XCircleIcon className="h-4 w-4" /> Inaktiv
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleUserActive(user.id, !user.isActive)}
                              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
                              disabled={user.id === currentUser.id}
                            >
                              {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#141414]/90 p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Tipps</p>
              <h3 className="mt-2 text-xl font-semibold">So nutzt du den AITI Agent optimal</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li>• Halte deine Profilinformationen aktuell, damit das Team weiß, woran du arbeitest.</li>
                <li>• Admins können Zugänge verwalten, um neue Teammitglieder freizuschalten.</li>
                <li>• Die Anzahl erstellter Agents hilft dir, deine Aktivität im Blick zu behalten.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
