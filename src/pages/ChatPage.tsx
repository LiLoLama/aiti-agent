import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTimeline } from '../components/ChatTimeline';
import { ChatInput, ChatInputSubmission } from '../components/ChatInput';
import { MobileNavBar } from '../components/MobileNavBar';
import { ChatOverviewPanel } from '../components/ChatOverviewPanel';
import { sampleChats, Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';
import { AgentSettings } from '../types/settings';
import {
  loadAgentSettings,
  loadChats,
  loadCustomFolders,
  saveChats,
  saveCustomFolders
} from '../utils/storage';
import { sendWebhookMessage } from '../utils/webhook';
import { applyColorScheme } from '../utils/theme';

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

const toPreview = (value: string) =>
  value.length > 140 ? `${value.slice(0, 137)}…` : value;

export function ChatPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AgentSettings>(() => loadAgentSettings());
  const [chats, setChats] = useState<Chat[]>(() => loadChats(sampleChats));
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const initialChats = loadChats(sampleChats);
    return initialChats[0]?.id ?? '';
  });
  const [isWorkspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [isMobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>(() => loadCustomFolders());
  const [folderSelectionChatId, setFolderSelectionChatId] = useState<string | null>(null);
  const [selectedExistingFolder, setSelectedExistingFolder] = useState<string>('__none__');
  const [newFolderName, setNewFolderName] = useState('');
  const [chatBackground, setChatBackground] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return settings.chatBackgroundImage ?? null;
    }

    return (
      window.localStorage.getItem('chatBackgroundImage') ?? settings.chatBackgroundImage ?? null
    );
  });

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

  const availableFolders = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...customFolders,
          ...chats
            .map((chat) => chat.folder)
            .filter((folder): folder is string => Boolean(folder))
        ]
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [customFolders, chats]);

  const agentAvatarSource = useMemo(
    () => settings.agentAvatarImage ?? agentAvatar,
    [settings.agentAvatarImage]
  );

  const userAvatarSource = useMemo(
    () => settings.profileAvatarImage ?? userAvatar,
    [settings.profileAvatarImage]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleSettingsUpdate = (event: WindowEventMap['aiti-settings-update']) => {
      setSettings(event.detail);
    };

    window.addEventListener('aiti-settings-update', handleSettingsUpdate);

    return () => {
      window.removeEventListener('aiti-settings-update', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    setChatBackground(settings.chatBackgroundImage ?? null);
  }, [settings.chatBackgroundImage]);

  useEffect(() => {
    applyColorScheme(settings.colorScheme);
  }, [settings.colorScheme]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    saveCustomFolders(customFolders);
  }, [customFolders]);

  useEffect(() => {
    const updateBackgroundFromStorage = () => {
      if (typeof window === 'undefined') {
        return;
      }

      setChatBackground(window.localStorage.getItem('chatBackgroundImage'));
    };

    updateBackgroundFromStorage();

    window.addEventListener('chat-background-change', updateBackgroundFromStorage);

    return () => {
      window.removeEventListener('chat-background-change', updateBackgroundFromStorage);
    };
  }, []);

  const handleNewChat = () => {
    const timestamp = new Date();
    const newChat: Chat = {
      id: crypto.randomUUID(),
      name: 'Neuer Chat',
      lastUpdated: timestamp.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      preview: 'Beschreibe dein nächstes Projekt und starte den AI Agent.',
      messages: [
        {
          id: crypto.randomUUID(),
          author: 'agent',
          content:
            'Hallo! Ich bin bereit, deinen Flow zu konfigurieren. Teile mir deine Ziele oder den Webhook-Endpunkt mit.',
          timestamp: timestamp.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ]
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setWorkspaceCollapsed(false);
    setMobileWorkspaceOpen(false);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileWorkspaceOpen(false);
  };

  const handleRenameChat = (chatId: string) => {
    const chatToRename = chats.find((chat) => chat.id === chatId);
    if (!chatToRename) {
      return;
    }

    const newName = window.prompt('Wie soll der Chat heißen?', chatToRename.name)?.trim();
    if (!newName || newName === chatToRename.name) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              name: newName
            }
          : chat
      )
    );
  };

  const handleDeleteChat = (chatId: string) => {
    const chatToDelete = chats.find((chat) => chat.id === chatId);
    if (!chatToDelete) {
      return;
    }

    const shouldDelete = window.confirm(
      `Soll der Chat "${chatToDelete.name}" wirklich gelöscht werden?`
    );

    if (!shouldDelete) {
      return;
    }

    setChats((prev) => prev.filter((chat) => chat.id !== chatId));

    setActiveChatId((currentId) => {
      if (currentId !== chatId) {
        return currentId;
      }

      const remainingChats = chats.filter((chat) => chat.id !== chatId);
      return remainingChats[0]?.id ?? '';
    });
  };

  const handleCreateFolder = () => {
    const folderName = window.prompt('Wie soll der neue Ordner heißen?')?.trim();
    if (!folderName) {
      return;
    }

    setCustomFolders((prev) => {
      if (prev.includes(folderName)) {
        return prev;
      }

      return [...prev, folderName];
    });
  };

  const handleAssignChatFolder = (chatId: string) => {
    const chatToAssign = chats.find((chat) => chat.id === chatId);
    if (!chatToAssign) {
      return;
    }

    setFolderSelectionChatId(chatId);
    setSelectedExistingFolder(chatToAssign.folder ?? '__none__');
    setNewFolderName('');
  };

  const handleCloseFolderSelection = () => {
    setFolderSelectionChatId(null);
    setSelectedExistingFolder('__none__');
    setNewFolderName('');
  };

  const handleConfirmFolderSelection = () => {
    if (!folderSelectionChatId) {
      return;
    }

    const trimmedNewFolder = newFolderName.trim();
    const selectedFolderName =
      selectedExistingFolder === '__none__' ? '' : selectedExistingFolder.trim();
    const targetFolder = trimmedNewFolder || selectedFolderName;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === folderSelectionChatId
          ? {
              ...chat,
              folder: targetFolder || undefined
            }
          : chat
      )
    );

    if (trimmedNewFolder) {
      setCustomFolders((prev) => {
        if (prev.includes(trimmedNewFolder)) {
          return prev;
        }

        return [...prev, trimmedNewFolder].sort((a, b) => a.localeCompare(b));
      });
    } else if (targetFolder) {
      setCustomFolders((prev) => {
        if (prev.includes(targetFolder)) {
          return prev;
        }

        return [...prev, targetFolder].sort((a, b) => a.localeCompare(b));
      });
    }

    handleCloseFolderSelection();
  };

  const handleSendMessage = async (submission: ChatInputSubmission) => {
    const currentChat = activeChat;
    if (!currentChat) {
      return;
    }

    const now = new Date();
    const files = submission.files ?? [];

    const fileAttachments: ChatAttachment[] = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            name: `Audio-${formatTimestamp(now)}`,
            size: submission.audio.blob.size,
            type: submission.audio.blob.type || 'audio/webm',
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
      id: crypto.randomUUID(),
      author: 'user',
      content: messageContent,
      timestamp: formatTimestamp(now),
      attachments: attachments.length ? attachments : undefined
    };

    const updatedPreview = trimmedText
      ? trimmedText
      : audioAttachments.length
      ? 'Audio Nachricht'
      : attachments[0]?.name ?? 'Neue Nachricht';

    const updatedChat: Chat = {
      ...currentChat,
      messages: [...currentChat.messages, userMessage],
      lastUpdated: formatTimestamp(now),
      preview: toPreview(updatedPreview)
    };

    setChats((prev) =>
      prev.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat))
    );

    try {
      const webhookResponse = await sendWebhookMessage(settings, {
        chatId: updatedChat.id,
        message: trimmedText,
        messageId: userMessage.id,
        history: updatedChat.messages,
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
        id: crypto.randomUUID(),
        author: 'agent',
        content: webhookResponse.message,
        timestamp: formatTimestamp(responseDate)
      };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === updatedChat.id
            ? {
                ...chat,
                messages: [...chat.messages, agentMessage],
                preview: toPreview(agentMessage.content),
                lastUpdated: formatTimestamp(responseDate)
              }
            : chat
        )
      );
    } catch (error) {
      const errorDate = new Date();
      const agentErrorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'agent',
        content:
          error instanceof Error
            ? `Webhook Fehler: ${error.message}`
            : 'Unbekannter Fehler beim Webhook-Aufruf.',
        timestamp: formatTimestamp(errorDate)
      };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === updatedChat.id
            ? {
                ...chat,
                messages: [...chat.messages, agentErrorMessage],
                preview: toPreview(agentErrorMessage.content),
                lastUpdated: formatTimestamp(errorDate)
              }
            : chat
        )
      );
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#111111] text-white">
      <MobileNavBar
        onNewChat={handleNewChat}
        onOpenSettings={() => navigate('/settings')}
        onToggleOverview={() => setMobileWorkspaceOpen(true)}
      />

      <div className="flex flex-1">
        {(!isWorkspaceCollapsed || isMobileWorkspaceOpen) && (
          <ChatOverviewPanel
            chats={chats}
            activeChatId={activeChat?.id ?? ''}
            onSelectChat={handleSelectChat}
            isMobileOpen={isMobileWorkspaceOpen}
            onCloseMobile={() => setMobileWorkspaceOpen(false)}
            onNewChat={handleNewChat}
            onCreateFolder={handleCreateFolder}
            onRenameChat={handleRenameChat}
            onDeleteChat={handleDeleteChat}
            customFolders={customFolders}
            onAssignChatFolder={handleAssignChatFolder}
            onOpenSettings={() => navigate('/settings')}
          />
        )}

        <main className="flex flex-1 flex-col">
          <ChatHeader
            agentName="AITI Agent"
            agentRole="N8n Workflow Companion"
            agentStatus="online"
            onOpenOverview={() => setMobileWorkspaceOpen(true)}
            agentAvatar={agentAvatarSource}
          />

          <div className="hidden px-4 pt-4 md:px-6 lg:flex">
            <button
              onClick={() => setWorkspaceCollapsed((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.02] p-2 text-white/60 transition hover:bg-white/10"
              aria-label={isWorkspaceCollapsed ? 'Workspace anzeigen' : 'Workspace ausblenden'}
            >
              {isWorkspaceCollapsed ? (
                <ChevronDoubleRightIcon className="h-5 w-5" />
              ) : (
                <ChevronDoubleLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {activeChat && (
            <ChatTimeline
              chat={activeChat}
              agentAvatar={agentAvatarSource}
              userAvatar={userAvatarSource}
              backgroundImage={chatBackground ?? undefined}
            />
          )}

          <div className="px-4 pb-28 pt-2 md:px-8 md:pb-10">
            <ChatInput
              onSendMessage={handleSendMessage}
              pushToTalkEnabled={settings.pushToTalkEnabled}
            />
            <p className="mt-3 text-xs text-white/30">
              Audio- und Textnachrichten werden direkt an deinen n8n-Webhook gesendet und als strukturierte Antwort im Stream angezeigt.
            </p>
          </div>
        </main>
    </div>

      {folderSelectionChatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-[#161616]/95 p-6 text-white shadow-glow">
            <div>
              <h3 className="text-lg font-semibold">Chat in Ordner verschieben</h3>
              <p className="mt-2 text-sm text-white/60">
                Wähle einen vorhandenen Ordner aus oder lege direkt einen neuen an.
              </p>
            </div>

            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Verfügbare Ordner
                </legend>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                  <span>Keinem Ordner zuweisen</span>
                  <input
                    type="radio"
                    className="accent-brand-gold"
                    checked={selectedExistingFolder === '__none__'}
                    onChange={() => setSelectedExistingFolder('__none__')}
                  />
                </label>
                {availableFolders.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50">
                    Noch keine Ordner vorhanden.
                  </p>
                ) : (
                  availableFolders.map((folder) => (
                    <label
                      key={folder}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                    >
                      <span>{folder}</span>
                      <input
                        type="radio"
                        className="accent-brand-gold"
                        checked={selectedExistingFolder === folder}
                        onChange={() => setSelectedExistingFolder(folder)}
                      />
                    </label>
                  ))
                )}
              </fieldset>

              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Neuen Ordner erstellen
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/60 focus:outline-none"
                  placeholder="Neuer Ordnername"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
                <p className="mt-2 text-xs text-white/40">
                  Wenn du hier einen Namen eingibst, wird automatisch ein neuer Ordner angelegt.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseFolderSelection}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmFolderSelection}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-4 py-2 text-sm font-semibold text-surface-base shadow-glow hover:opacity-90"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
