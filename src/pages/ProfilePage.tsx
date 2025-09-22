import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  PlusCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { AgentProfile } from '../types/auth';
import { prepareImageForStorage } from '../utils/image';
import userAvatar from '../assets/default-user.svg';
import agentFallbackAvatar from '../assets/agent-avatar.png';

interface AgentFormState {
  name: string;
  description: string;
  tools: string;
  webhookUrl: string;
  avatarUrl: string | null;
}

type AgentModalState = { mode: 'create' } | { mode: 'edit'; agent: AgentProfile };

const createEmptyAgentForm = (): AgentFormState => ({
  name: '',
  description: '',
  tools: '',
  webhookUrl: '',
  avatarUrl: null
});

export function ProfilePage() {
  const { currentUser, users, updateProfile, toggleUserActive, logout, addAgent, updateAgent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser?.avatarUrl ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [redirectAfterSave, setRedirectAfterSave] = useState(() =>
    Boolean((location.state as { onboarding?: boolean } | null)?.onboarding)
  );
  const [agentModal, setAgentModal] = useState<AgentModalState | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>(() => createEmptyAgentForm());
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const displayedAvatar = avatarPreview ?? userAvatar;
  const userAgents = currentUser.agents;
  const agentAvatarPreview = agentForm.avatarUrl ?? agentFallbackAvatar;

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

  const openCreateAgentModal = () => {
    setAgentForm(createEmptyAgentForm());
    setAgentModal({ mode: 'create' });
    setAgentError(null);
  };

  const openEditAgentModal = (agent: AgentProfile) => {
    setAgentForm({
      name: agent.name,
      description: agent.description,
      tools: agent.tools.join(', '),
      webhookUrl: agent.webhookUrl,
      avatarUrl: agent.avatarUrl
    });
    setAgentModal({ mode: 'edit', agent });
    setAgentError(null);
  };

  const closeAgentModal = () => {
    setAgentModal(null);
    setAgentError(null);
    setAgentForm(createEmptyAgentForm());
  };

  const handleAgentAvatarUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const result = await prepareImageForStorage(file, {
        maxDimension: 512,
        mimeType: 'image/jpeg',
        quality: 0.9
      });
      setAgentForm((previous) => ({ ...previous, avatarUrl: result }));
    } catch (error) {
      console.error('Agentenbild konnte nicht verarbeitet werden.', error);
      setAgentError('Agentenbild konnte nicht verarbeitet werden.');
    }
  };

  const handleAgentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!agentModal) {
      return;
    }

    setAgentSaving(true);
    setAgentError(null);

    const tools = agentForm.tools
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);

    try {
      if (agentModal.mode === 'create') {
        addAgent({
          name: agentForm.name,
          description: agentForm.description,
          avatarUrl: agentForm.avatarUrl,
          tools,
          webhookUrl: agentForm.webhookUrl
        });
      } else {
        updateAgent(agentModal.agent.id, {
          name: agentForm.name,
          description: agentForm.description,
          avatarUrl: agentForm.avatarUrl,
          tools,
          webhookUrl: agentForm.webhookUrl
        });
      }

      closeAgentModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Agent konnte nicht gespeichert werden.';
      setAgentError(message);
    } finally {
      setAgentSaving(false);
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
      if (redirectAfterSave) {
        setRedirectAfterSave(false);
        setTimeout(() => navigate('/', { replace: true }), 600);
      }
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

  const agentManagementContent = (
    <>
      <div className="mt-6 space-y-4">
        {userAgents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-8 text-sm text-white/70">
            <p>Du hast noch keine Agents angelegt.</p>
            <p className="mt-2 text-xs text-white/50">
              Starte mit einem spezialisierten Agenten und erweitere dein Team Schritt für Schritt.
            </p>
          </div>
        ) : (
          userAgents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#121212] p-6 md:flex-row md:items-start md:justify-between"
            >
              <div className="flex flex-1 items-start gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                  <img
                    src={agent.avatarUrl ?? agentFallbackAvatar}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                  <p className="text-sm text-white/60">
                    {agent.description
                      ? agent.description
                      : 'Beschreibe den Fokus dieses Agents in der Konfiguration.'}
                  </p>
                  {agent.tools.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      {agent.tools.map((tool) => (
                        <span key={tool} className="rounded-full bg-white/5 px-3 py-1 text-white/70">
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end md:text-right">
                <p className={`break-all text-xs ${agent.webhookUrl ? 'text-brand-gold' : 'text-white/40'}`}>
                  {agent.webhookUrl || 'Noch kein Webhook hinterlegt'}
                </p>
                <button
                  type="button"
                  onClick={() => openEditAgentModal(agent)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  Konfigurieren
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-6">
        <button
          type="button"
          onClick={openCreateAgentModal}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-gold/60 px-5 py-2 text-sm font-semibold text-brand-gold transition hover:border-brand-gold hover:bg-brand-gold/10 hover:text-white"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Neuen Agent anlegen
        </button>
      </div>
    </>
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
                      <p className="mt-2 text-sm font-semibold text-white">{userAgents.length}</p>
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
              {currentUser.role === 'admin' ? (
                <>
                  <header>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Team</p>
                    <h2 className="mt-2 text-2xl font-semibold">Nutzerübersicht</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Verwalte die Zugänge deines Teams und behalte die Aktivität im Blick.
                    </p>
                  </header>
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
                            <td className="px-4 py-3">{user.agents.length}</td>
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
                </>
              ) : (
                <>
                  <header>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Team</p>
                    <h2 className="mt-2 text-2xl font-semibold">Deine Agents</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Baue ein Team aus spezialisierten Agents und optimiere jeden für eine Aufgabe.
                    </p>
                  </header>
                  {agentManagementContent}
                </>
              )}
            </div>

            {currentUser.role === 'admin' && (
              <div className="rounded-[32px] border border-white/10 bg-[#141414]/90 p-8 shadow-2xl">
                <header>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Agents</p>
                  <h2 className="mt-2 text-2xl font-semibold">Eigene Agents verwalten</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Passe Beschreibung, Tools und Webhook deiner Agents an.
                  </p>
                </header>
                {agentManagementContent}
              </div>
            )}

            <div className="rounded-[32px] border border-white/10 bg-[#141414]/90 p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Tipps</p>
              <h3 className="mt-2 text-xl font-semibold">So nutzt du den AITI Agent optimal</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li>• Halte deine Profilinformationen aktuell.</li>
                <li>• Nutze für jeden Agent einen eigenen Webhook.</li>
                <li>• Ein einzelner Agent muss nicht alles können. Baue ein Team aus Experten.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
      {agentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10"
          onClick={closeAgentModal}
        >
          <div
            className="relative w-full max-w-2xl rounded-[32px] border border-white/10 bg-[#141414] p-8 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeAgentModal}
              className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h3 className="text-2xl font-semibold">
              {agentModal.mode === 'create'
                ? 'Neuen Agent anlegen'
                : `${agentModal.agent.name} konfigurieren`}
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Verleihe deinem Agenten ein klares Profil und lege Tools sowie Webhook fest.
            </p>
            <form className="mt-8 space-y-6" onSubmit={handleAgentSubmit}>
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex flex-col items-center gap-3 text-center md:w-52">
                  <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                    <img
                      src={agentAvatarPreview}
                      alt={agentForm.name || 'Agent'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="cursor-pointer text-xs font-semibold text-brand-gold hover:underline">
                    Neues Bild hochladen
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(event) => handleAgentAvatarUpload(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {agentForm.avatarUrl && (
                    <button
                      type="button"
                      className="text-xs text-white/50 hover:text-white"
                      onClick={() => setAgentForm((previous) => ({ ...previous, avatarUrl: null }))}
                    >
                      Bild entfernen
                    </button>
                  )}
                </div>
                <div className="flex-1 space-y-5">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">Name</label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      placeholder="Wie heißt dein Agent?"
                      value={agentForm.name}
                      onChange={(event) => setAgentForm((previous) => ({ ...previous, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">Beschreibung</label>
                    <textarea
                      className="mt-2 min-h-[100px] w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      placeholder="Wofür setzt du diesen Agenten ein?"
                      value={agentForm.description}
                      onChange={(event) =>
                        setAgentForm((previous) => ({ ...previous, description: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">
                      Verfügbare Tools
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      placeholder="Tool A, Tool B, Tool C"
                      value={agentForm.tools}
                      onChange={(event) => setAgentForm((previous) => ({ ...previous, tools: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.35em] text-white/40">Webhook</label>
                    <input
                      type="url"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-brand-gold focus:outline-none"
                      placeholder="https://hooks.example.com/dein-agent"
                      value={agentForm.webhookUrl}
                      onChange={(event) =>
                        setAgentForm((previous) => ({ ...previous, webhookUrl: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              {agentError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {agentError}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={agentSaving}
                  className="rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-6 py-3 text-sm font-semibold text-black shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {agentSaving
                    ? 'Speichern …'
                    : agentModal.mode === 'create'
                      ? 'Agent anlegen'
                      : 'Agent speichern'}
                </button>
                <button
                  type="button"
                  onClick={closeAgentModal}
                  className="text-sm text-white/50 hover:text-white"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
