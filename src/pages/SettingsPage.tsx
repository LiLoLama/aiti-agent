import { FormEvent, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CloudArrowUpIcon, PhotoIcon } from '@heroicons/react/24/outline';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';
import { AgentAuthType, AgentSettings } from '../types/settings';
import { loadAgentSettings, saveAgentSettings } from '../utils/storage';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AgentSettings>(() => loadAgentSettings());
  const [chatBackground, setChatBackground] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem('chatBackgroundImage') ?? settings.chatBackgroundImage ?? null;
  });
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const updateSetting = <Key extends keyof AgentSettings>(
    key: Key,
    value: AgentSettings[Key]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleBackgroundUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setChatBackground(result);
      updateSetting('chatBackgroundImage', result);

      if (typeof window !== 'undefined') {
        if (result) {
          window.localStorage.setItem('chatBackgroundImage', result);
        } else {
          window.localStorage.removeItem('chatBackgroundImage');
        }

        window.dispatchEvent(new Event('chat-background-change'));
      }
    };

    reader.readAsDataURL(file);
  };

  const handleBackgroundReset = () => {
    setChatBackground(null);
    updateSetting('chatBackgroundImage', null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('chatBackgroundImage');
      window.dispatchEvent(new Event('chat-background-change'));
    }

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  };

  useEffect(() => {
    setChatBackground(settings.chatBackgroundImage ?? null);
  }, [settings.chatBackgroundImage]);

  const handleSaveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: AgentSettings = {
      ...settings,
      chatBackgroundImage: chatBackground
    };

    try {
      saveAgentSettings(payload);
      window.dispatchEvent(
        new CustomEvent('aiti-settings-update', {
          detail: payload
        })
      );
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#101010] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/10"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Zurück zum Chat
        </button>

        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-[#161616]/80 p-8 shadow-[0_0_80px_rgba(250,207,57,0.08)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Einstellungen &amp; Personalisierung</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/50">
              Pflege deine Webhook-Endpunkte, Avatar Assets und Personalisierungen für deinen AITI AI Agent. Diese Oberfläche dient als Kommandozentrale für dein zukünftiges Web- und iOS-Erlebnis.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
              <img src={agentAvatar} alt="Agent" className="h-full w-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AITI Agent</h2>
              <p className="text-sm text-white/50">Aktiver Workflow Companion</p>
            </div>
          </div>
        </header>

        {saveStatus !== 'idle' && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
          >
            {saveStatus === 'success'
              ? 'Einstellungen wurden erfolgreich gespeichert.'
              : 'Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.'}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="mt-10 grid gap-8 lg:grid-cols-5">
          <section className="lg:col-span-3 space-y-8">
            <div className="rounded-3xl border border-white/10 bg-[#161616]/70 p-8 shadow-2xl">
              <h3 className="text-xl font-semibold text-white">Benutzerprofil</h3>
              <p className="mt-2 text-sm text-white/50">
                Richte deinen persönlichen Workspace ein. Dein Avatar erscheint in jeder Unterhaltung sowie in zukünftigen mobilen Apps.
              </p>
              <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 shadow-lg">
                  <img src={userAvatar} alt="User Avatar" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute inset-x-4 bottom-3 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-3 py-1 text-[10px] font-semibold text-surface-base shadow-glow"
                  >
                    Neu hochladen
                  </button>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-white/40">Name</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                      placeholder="Max Mustermann"
                      value={settings.profileName}
                      onChange={(event) => updateSetting('profileName', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-white/40">Rolle</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                      placeholder="AI Operations Lead"
                      value={settings.profileRole}
                      onChange={(event) => updateSetting('profileRole', event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#161616]/70 p-8 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Webhook &amp; Integrationen</h3>
                  <p className="mt-2 text-sm text-white/50">Steuere hier, wie dein AI Agent mit n8n Workflows verbunden ist.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-brand-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-gold hover:bg-brand-gold/10"
                >
                  Test ausführen
                </button>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Webhook URL</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                    placeholder="https://n8n.example.com/webhook/aiti-agent"
                    value={settings.webhookUrl}
                    onChange={(event) => updateSetting('webhookUrl', event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Authentifizierung</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-brand-gold/60 focus:outline-none"
                    value={settings.authType}
                    onChange={(event) =>
                      updateSetting('authType', event.target.value as AgentAuthType)
                    }
                  >
                    <option value="none" className="bg-[#161616]">
                      Keine Authentifizierung
                    </option>
                    <option value="apiKey" className="bg-[#161616]">
                      API Key
                    </option>
                    <option value="basic" className="bg-[#161616]">
                      Basic Auth
                    </option>
                    <option value="oauth" className="bg-[#161616]">
                      OAuth 2.0
                    </option>
                  </select>
                </div>
                {settings.authType === 'apiKey' && (
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-white/40">API Key</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                      placeholder="SuperSecretApiKey"
                      value={settings.apiKey ?? ''}
                      onChange={(event) => updateSetting('apiKey', event.target.value)}
                    />
                  </div>
                )}
                {settings.authType === 'basic' && (
                  <>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-white/40">Benutzername</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                        placeholder="n8n-user"
                        value={settings.basicAuthUsername ?? ''}
                        onChange={(event) => updateSetting('basicAuthUsername', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-white/40">Passwort</label>
                      <input
                        type="password"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                        placeholder="••••••••"
                        value={settings.basicAuthPassword ?? ''}
                        onChange={(event) => updateSetting('basicAuthPassword', event.target.value)}
                      />
                    </div>
                  </>
                )}
                {settings.authType === 'oauth' && (
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-white/40">Access Token</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                      placeholder="ya29..."
                      value={settings.oauthToken ?? ''}
                      onChange={(event) => updateSetting('oauthToken', event.target.value)}
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Erwartetes Format</label>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      <input
                        type="radio"
                        name="response-format"
                        className="accent-brand-gold"
                        checked={settings.responseFormat === 'text'}
                        onChange={() => updateSetting('responseFormat', 'text')}
                      />
                      Plain Text Antwort
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      <input
                        type="radio"
                        name="response-format"
                        className="accent-brand-gold"
                        checked={settings.responseFormat === 'json'}
                        onChange={() => updateSetting('responseFormat', 'json')}
                      />
                      JSON Payload
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-2 space-y-8">
            <div className="rounded-3xl border border-white/10 bg-[#161616]/70 p-8 shadow-2xl">
              <h3 className="text-xl font-semibold text-white">Brand Assets</h3>
              <p className="mt-2 text-sm text-white/50">
                Lade Logos, Farbsets und Medien hoch, die in deiner Chat-Oberfläche dargestellt werden sollen.
              </p>
              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-4 text-sm text-white/60 hover:border-brand-gold/40 hover:text-white"
                >
                  <span className="inline-flex items-center gap-3">
                    <CloudArrowUpIcon className="h-5 w-5 text-brand-gold" />
                    Neues Asset hochladen
                  </span>
                  <PhotoIcon className="h-5 w-5 text-white/30" />
                </button>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <img src={agentAvatar} alt="AITI Logo" className="w-full rounded-2xl border border-white/5 bg-[#0d0d0d] object-contain p-6" />
                  <p className="mt-3 text-xs text-white/40">Aktuelles Agent Profilbild</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#161616]/70 p-8 shadow-2xl">
              <h3 className="text-xl font-semibold text-white">Interface Optionen</h3>
              <p className="mt-2 text-sm text-white/50">
                Passe die visuelle Darstellung deines Chat-Erlebnisses an. Alle Änderungen werden live im Preview übernommen.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Farbschema</label>
                  <div className="mt-3 flex gap-3">
                    {['#212121', '#facf39', '#fbdb6b', '#f9c307', '#e6e6e6'].map((color) => (
                      <button
                        type="button"
                        key={color}
                        style={{ background: color }}
                        className="h-10 w-10 rounded-2xl border border-white/10 shadow-inner"
                        aria-pressed={settings.colorScheme === color}
                        onClick={(event) => {
                          event.preventDefault();
                          updateSetting('colorScheme', color);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Chat Hintergrund</label>
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => backgroundInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                      >
                        <PhotoIcon className="h-4 w-4" /> Hintergrund wählen
                      </button>
                      {chatBackground && (
                        <button
                          type="button"
                          onClick={handleBackgroundReset}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10"
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    {chatBackground ? (
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <img
                          src={chatBackground}
                          alt="Aktuelles Chat Hintergrundbild"
                          className="h-40 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-white/40">Noch kein Hintergrund festgelegt.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Animationsgeschwindigkeit</label>
                  <input type="range" className="mt-3 w-full accent-brand-gold" defaultValue={60} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/40">Audio Eingabe</label>
                  <label className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    Push-to-Talk aktivieren
                    <input
                      type="checkbox"
                      className="accent-brand-gold"
                      checked={settings.pushToTalkEnabled}
                      onChange={(event) => updateSetting('pushToTalkEnabled', event.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </aside>
          <div className="lg:col-span-5 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-6 py-3 text-sm font-semibold text-surface-base shadow-glow transition hover:opacity-90"
            >
              Änderungen speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
