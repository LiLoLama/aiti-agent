import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTimeline } from '../components/ChatTimeline';
import { ChatInput, ChatInputSubmission } from '../components/ChatInput';
import { ChatOverviewPanel } from '../components/ChatOverviewPanel';
import { Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';
import { AgentSettings } from '../types/settings';
import { loadAgentSettings } from '../utils/storage';
import { sendWebhookMessage } from '../utils/webhook';
import { applyColorScheme } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import {
  createChatForProfile,
  fetchChatsForProfile,
  mapChatRowToChat,
  updateChatRow
} from '../services/chatService';
import {
  applyIntegrationSecretToSettings,
  fetchIntegrationSecret
} from '../services/integrationSecretsService';
import type { AgentProfile } from '../types/auth';

const formatTimestamp = (date: Date) =>
  date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Datei konnte nicht gelesen werden.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unbekannter Fehler beim Lesen der Datei.'));
    reader.readAsDataURL(blob);
  });

const toPreview = (value: string) => (value.length > 140 ? `${value.slice(0, 137)}…` : value);

const createMessageId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function ChatPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<AgentSettings>(() => loadAgentSettings());
  const [agentChats, setAgentChats] = useState<Record<string, Chat>>({});
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [isWorkspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [isMobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [pendingResponseAgentId, setPendingResponseAgentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setSearchOpen] = useState(false);

  const activeChat = activeAgentId ? agentChats[activeAgentId] : undefined;

  const accountAvatar = currentUser?.avatarUrl ?? userAvatar;

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    let isActive = true;

    const syncIntegrationSecrets = async () => {
      try {
        const record = await fetchIntegrationSecret(currentUser.id);
        if (!isActive) {
          return;
        }

        setSettings((previous) => applyIntegrationSecretToSettings(previous, record));
      } catch (error) {
        console.error('Integrations-Secrets konnten nicht geladen werden.', error);
      }
    };

    void syncIntegrationSecrets();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || currentUser.agents.length === 0) {
      setActiveAgentId(null);
      return;
    }

    setActiveAgentId((previous) => {
      if (previous && currentUser.agents.some((agent) => agent.id === previous)) {
        return previous;
      }

      return currentUser.agents[0].id;
    });
  }, [currentUser]);

  const selectedAgent = useMemo(() => {
    if (!currentUser || currentUser.agents.length === 0) {
      return null;
    }

    if (activeAgentId) {
      const found = currentUser.agents.find((agent) => agent.id === activeAgentId);
      if (found) {
        return found;
      }
    }

    return currentUser.agents[0];
  }, [currentUser, activeAgentId]);

  const defaultAgentAvatar = useMemo(
    () => settings.agentAvatarImage ?? agentAvatar,
    [settings.agentAvatarImage]
  );
  const activeAgentAvatar = selectedAgent?.avatarUrl ?? defaultAgentAvatar;
  const activeAgentName = selectedAgent?.name ?? 'AITI Agent';
  const activeAgentRole = selectedAgent?.description?.trim()
    ? selectedAgent.description
    : 'Dein digitaler Companion';
  const hasAgents = Boolean(selectedAgent);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleSettingsUpdate = (event: WindowEventMap['aiti-settings-update']) => {
      setSettings((previous) => ({ ...previous, ...event.detail }));
    };

    window.addEventListener('aiti-settings-update', handleSettingsUpdate);

    return () => {
      window.removeEventListener('aiti-settings-update', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    applyColorScheme(settings.colorScheme);
  }, [settings.colorScheme]);

  useEffect(() => {
    if (!currentUser) {
      setAgentChats({});
      return;
    }

    let isSubscribed = true;

    const loadChats = async () => {
      try {
        const chatRows = await fetchChatsForProfile(currentUser.id);

        if (!isSubscribed) {
          return;
        }

        const mappedChats = chatRows
          .map((row) => mapChatRowToChat(row))
          .reduce<Record<string, Chat>>((acc, chat) => {
            if (chat.agentId && chat.agentId.trim().length > 0) {
              acc[chat.agentId] = chat;
            }
            return acc;
          }, {});

        setAgentChats(mappedChats);
      } catch (error) {
        console.error('Chats konnten nicht geladen werden.', error);
      }
    };

    void loadChats();

    return () => {
      isSubscribed = false;
    };
  }, [currentUser]);

  const ensureAgentChat = useCallback(
    async (agent: AgentProfile): Promise<Chat | null> => {
      if (!currentUser) {
        return null;
      }

      const existing = agentChats[agent.id];
      if (existing) {
        return existing;
      }

      const timestamp = new Date();
      const userName = (currentUser?.name ?? settings.profileName ?? '').trim();
      const greeting = userName
        ? `Hallo ${userName}! Wie kann ich dir heute helfen?`
        : 'Hallo! Wie kann ich dir heute helfen?';

      const newChat: Chat = {
        id: agent.id,
        agentId: agent.id,
        name: agent.name?.trim().length ? agent.name : 'Agent Chat',
        lastUpdated: formatTimestamp(timestamp),
        preview: 'Beschreibe dein nächstes Projekt und starte den AI Agent.',
        messages: [
          {
            id: createMessageId(),
            author: 'agent',
            content: greeting,
            timestamp: formatTimestamp(timestamp)
          }
        ]
      };

      setAgentChats((prev) => {
        if (prev[agent.id]) {
          return prev;
        }

        return {
          ...prev,
          [agent.id]: newChat
        };
      });

      try {
        await createChatForProfile(currentUser.id, newChat, agent);
      } catch (error) {
        console.error('Chat konnte nicht gespeichert werden.', error);
      }

      return newChat;
    },
    [agentChats, currentUser, settings.profileName]
  );

  useEffect(() => {
    if (selectedAgent) {
      void ensureAgentChat(selectedAgent);
    }
  }, [selectedAgent, ensureAgentChat]);

  useEffect(() => {
    setSearchTerm('');
  }, [selectedAgent?.id]);

  useEffect(() => {
    if (!isSearchOpen) {
      setSearchTerm('');
    }
  }, [isSearchOpen]);

  const handleOpenAgentCreation = () => {
    setMobileWorkspaceOpen(false);
    navigate('/profile', { state: { openAgentModal: 'create' } });
  };

  const handleSelectAgent = (agentId: string) => {
    if (agentId === activeAgentId) {
      setMobileWorkspaceOpen(false);
      return;
    }

    setActiveAgentId(agentId);
    setMobileWorkspaceOpen(false);
  };

  const handleSendMessage = async (submission: ChatInputSubmission) => {
    if (!currentUser || !selectedAgent) {
      return;
    }

    const existingChat = agentChats[selectedAgent.id] ?? (await ensureAgentChat(selectedAgent));
    if (!existingChat) {
      return;
    }

    const now = new Date();
    const files = submission.files ?? [];

    const fileAttachments: ChatAttachment[] = await Promise.all(
      files.map(async (file) => ({
        id: createMessageId(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: await blobToDataUrl(file),
        kind: 'file' as const
      }))
    );

    const audioAttachments: ChatAttachment[] = submission.audio
      ? [
          {
            id: createMessageId(),
            name: 'Audio Nachricht',
            size: submission.audio.blob.size,
            type: submission.audio.blob.type,
            url: await blobToDataUrl(submission.audio.blob),
            kind: 'audio' as const,
            durationSeconds: submission.audio.durationSeconds ?? undefined
          }
        ]
      : [];

    const attachments = [...fileAttachments, ...audioAttachments];

    const trimmedText = submission.text?.trim() ?? '';

    const messageContent = trimmedText
      ? trimmedText
      : audioAttachments.length
      ? 'Audio Nachricht gesendet.'
      : attachments.length
      ? 'Datei gesendet.'
      : '';

    const userMessage: ChatMessage = {
      id: createMessageId(),
      author: 'user',
      content: messageContent,
      timestamp: formatTimestamp(now),
      attachments: attachments.length ? attachments : undefined
    };

    const previewSource = trimmedText
      ? trimmedText
      : audioAttachments.length
      ? 'Audio Nachricht'
      : attachments[0]?.name ?? 'Neue Nachricht';
    const previewText = toPreview(previewSource);

    const chatAfterUserMessage: Chat = {
      ...existingChat,
      messages: [...existingChat.messages, userMessage],
      lastUpdated: formatTimestamp(now),
      preview: previewText
    };

    setAgentChats((prev) => ({
      ...prev,
      [selectedAgent.id]: chatAfterUserMessage
    }));

    setPendingResponseAgentId(selectedAgent.id);

    try {
      await createChatForProfile(currentUser.id, chatAfterUserMessage, selectedAgent);
      await updateChatRow(chatAfterUserMessage.id, {
        messages: chatAfterUserMessage.messages,
        summary: chatAfterUserMessage.preview,
        lastMessageAt: now.toISOString()
      });
    } catch (error) {
      console.error('Nachricht konnte nicht gespeichert werden.', error);
    }

    const effectiveWebhookUrl = selectedAgent.webhookUrl?.trim() || settings.webhookUrl;
    const webhookSettings: AgentSettings = {
      ...settings,
      webhookUrl: effectiveWebhookUrl
    };

    try {
      const webhookResponse = await sendWebhookMessage(webhookSettings, {
        chatId: chatAfterUserMessage.id,
        message: trimmedText,
        messageId: userMessage.id,
        history: chatAfterUserMessage.messages,
        attachments: files,
        audio: submission.audio
          ? {
              blob: submission.audio.blob,
              durationSeconds: submission.audio.durationSeconds ?? undefined
            }
          : undefined
      });

      const responseDate = new Date();
      const agentMessage: ChatMessage = {
        id: createMessageId(),
        author: 'agent',
        content: webhookResponse.message,
        timestamp: formatTimestamp(responseDate)
      };
      const agentPreview = toPreview(agentMessage.content);
      const messagesWithAgent = [...chatAfterUserMessage.messages, agentMessage];
      const chatAfterAgent: Chat = {
        ...chatAfterUserMessage,
        messages: messagesWithAgent,
        preview: agentPreview,
        lastUpdated: formatTimestamp(responseDate)
      };

      setAgentChats((prev) => ({
        ...prev,
        [selectedAgent.id]: chatAfterAgent
      }));

      try {
        await updateChatRow(chatAfterAgent.id, {
          messages: messagesWithAgent,
          summary: agentPreview,
          lastMessageAt: responseDate.toISOString()
        });
      } catch (persistError) {
        console.error('Antwort konnte nicht gespeichert werden.', persistError);
      }
    } catch (error) {
      const errorDate = new Date();
      const agentErrorMessage: ChatMessage = {
        id: createMessageId(),
        author: 'agent',
        content:
          error instanceof Error
            ? `Webhook Fehler: ${error.message}`
            : 'Unbekannter Fehler beim Webhook-Aufruf.',
        timestamp: formatTimestamp(errorDate)
      };
      const errorPreview = toPreview(agentErrorMessage.content);
      const messagesWithError = [...chatAfterUserMessage.messages, agentErrorMessage];
      const chatWithError: Chat = {
        ...chatAfterUserMessage,
        messages: messagesWithError,
        preview: errorPreview,
        lastUpdated: formatTimestamp(errorDate)
      };

      setAgentChats((prev) => ({
        ...prev,
        [selectedAgent.id]: chatWithError
      }));

      try {
        await updateChatRow(chatWithError.id, {
          messages: messagesWithError,
          summary: errorPreview,
          lastMessageAt: errorDate.toISOString()
        });
      } catch (persistError) {
        console.error('Fehlernachricht konnte nicht gespeichert werden.', persistError);
      }
    } finally {
      setPendingResponseAgentId(null);
    }
  };

  const normalizedSearchTerm = isSearchOpen ? searchTerm.trim().toLowerCase() : '';
  const filteredMessages = useMemo(() => {
    if (!activeChat) {
      return [];
    }

    if (!normalizedSearchTerm) {
      return activeChat.messages;
    }

    return activeChat.messages.filter((message) =>
      message.content.toLowerCase().includes(normalizedSearchTerm)
    );
  }, [activeChat, normalizedSearchTerm]);

  const matchCount = normalizedSearchTerm ? filteredMessages.length : null;
  const hasActiveSearch = normalizedSearchTerm.length > 0;

  const overviewAgents = currentUser?.agents ?? [];

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#111111] text-white">
      <div className="flex flex-1 overflow-hidden">
        {(!isWorkspaceCollapsed || isMobileWorkspaceOpen) && (
          <ChatOverviewPanel
            agents={overviewAgents}
            agentChats={agentChats}
            activeAgentId={selectedAgent?.id ?? null}
            onSelectAgent={handleSelectAgent}
            isMobileOpen={isMobileWorkspaceOpen}
            onCloseMobile={() => setMobileWorkspaceOpen(false)}
            onCreateAgent={handleOpenAgentCreation}
            defaultAgentAvatar={defaultAgentAvatar}
          />
        )}

        <main className="flex flex-1 min-h-0 flex-col">
          <ChatHeader
            agentName={activeAgentName}
            agentRole={activeAgentRole}
            agentStatus="online"
            onOpenOverview={() => setMobileWorkspaceOpen(true)}
            agentAvatar={activeAgentAvatar}
            userName={currentUser?.name}
            userAvatar={accountAvatar}
            onOpenProfile={() => navigate('/profile')}
          />

          <div className="hidden px-4 pt-4 md:px-6 lg:flex">
            <button
              onClick={() => setWorkspaceCollapsed((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.02] p-2 text-white/60 transition hover:bg-white/10"
              aria-label={isWorkspaceCollapsed ? 'Agentenliste anzeigen' : 'Agentenliste ausblenden'}
            >
              {isWorkspaceCollapsed ? (
                <ChevronDoubleRightIcon className="h-5 w-5" />
              ) : (
                <ChevronDoubleLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {hasAgents ? (
              <>
                <div className="border-b border-white/10 bg-[#111111] px-4 py-4 md:px-8">
                  <div className="flex items-center justify-end gap-3">
                    {isSearchOpen && matchCount !== null && (
                      <p className="text-xs text-white/50">
                        {matchCount === 0
                          ? 'Keine Nachrichten gefunden.'
                          : `${matchCount} ${matchCount === 1 ? 'Treffer' : 'Treffer'} gefunden.`}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSearchOpen((previous) => !previous)}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10"
                      aria-label={isSearchOpen ? 'Suche schließen' : 'Suche öffnen'}
                    >
                      <MagnifyingGlassIcon className="h-5 w-5" />
                    </button>
                  </div>
                  {isSearchOpen && (
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Nachrichten durchsuchen"
                        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                        autoFocus
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {activeChat ? (
                  <ChatTimeline
                    messages={filteredMessages}
                    agentAvatar={activeAgentAvatar}
                    userAvatar={accountAvatar}
                    isAwaitingResponse={selectedAgent ? pendingResponseAgentId === selectedAgent.id : false}
                    hasActiveSearch={hasActiveSearch}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center px-6 text-sm text-white/60">
                    Kein Chat verfügbar. Starte eine Unterhaltung mit deinem Agenten.
                  </div>
                )}

                <div className="mt-auto border-t border-white/5 bg-[#111111] px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 md:px-8 md:pb-10 md:pt-4">
                  <ChatInput onSendMessage={handleSendMessage} />
                  <p className="mt-3 text-center text-xs text-white/40 md:text-left">
                    Audio- und Textnachrichten werden direkt an deinen n8n-Webhook gesendet und als strukturierte Antwort im Stream angezeigt.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="max-w-md space-y-5">
                  <h2 className="text-2xl font-semibold text-white">Baue deinen ersten Agenten</h2>
                  <p className="text-sm text-white/60">
                    Lege deinen ersten Agenten an, um deine Chats zu starten.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAgentCreation}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-6 py-3 text-sm font-semibold text-black shadow-glow transition hover:opacity-90"
                  >
                    Ersten Agent erstellen
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
