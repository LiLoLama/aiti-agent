import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTimeline } from '../components/ChatTimeline';
import { ChatInput, ChatInputSubmission } from '../components/ChatInput';
import { ChatOverviewPanel } from '../components/ChatOverviewPanel';
import { Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';
import { AgentSettings } from '../types/settings';
import { loadAgentSettings } from '../utils/storage';
import { sendWebhookMessage } from '../utils/webhook';
import { applyColorScheme } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import {
  createChatForProfile,
  createFolderForProfile,
  deleteChatById,
  deleteFolderById,
  detachFolderFromChats,
  fetchChatsForProfile,
  fetchFoldersForProfile,
  mapChatRowToChat,
  updateChatRow,
  type FolderRecord
} from '../services/chatService';

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
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<AgentSettings>(() => loadAgentSettings());
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [isWorkspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [isMobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [isLoadingRemoteData, setIsLoadingRemoteData] = useState(false);
  const [remoteSyncError, setRemoteSyncError] = useState<string | null>(null);
  const [folderLoadError, setFolderLoadError] = useState<string | null>(null);
  const [folderSelectionChatId, setFolderSelectionChatId] = useState<string | null>(null);
  const [selectedExistingFolder, setSelectedExistingFolder] = useState<string>('__none__');
  const [newFolderName, setNewFolderName] = useState('');
  const [pendingResponseChatId, setPendingResponseChatId] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const hasRemoteProfile = currentUser?.hasRemoteProfile ?? false;
  const requiresRemoteProfileSetup = Boolean(currentUser) && !hasRemoteProfile;
  const remoteProfileSetupMessage =
    'Dein Supabase-Profil konnte nicht erstellt werden. Bitte ergänze passende Policies für die Tabelle "profiles", damit Chats und Ordner gespeichert werden können.';

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

  const folderNames = useMemo(
    () => [...folders].map((folder) => folder.name).sort((a, b) => a.localeCompare(b)),
    [folders]
  );

  const folderNameMap = useMemo(() => {
    const map = new Map<string, FolderRecord>();
    folders.forEach((folder) => {
      map.set(folder.name, folder);
    });
    return map;
  }, [folders]);

  const availableFolders = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...folderNames,
          ...chats
            .map((chat) => chat.folder)
            .filter((folder): folder is string => Boolean(folder))
        ]
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [folderNames, chats]);

  const defaultAgentAvatar = useMemo(
    () => settings.agentAvatarImage ?? agentAvatar,
    [settings.agentAvatarImage]
  );

  const accountAvatar = currentUser?.avatarUrl ?? userAvatar;

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

  const agentSwitcherOptions = useMemo(
    () =>
      currentUser
        ? currentUser.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            description: agent.description
          }))
        : [],
    [currentUser]
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
      setSettings(event.detail);
    };

    window.addEventListener('aiti-settings-update', handleSettingsUpdate);

    return () => {
      window.removeEventListener('aiti-settings-update', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    applyColorScheme(settings.colorScheme);
  }, [settings.colorScheme]);

  const ensureRemoteProfile = () => {
    if (!currentUser?.hasRemoteProfile) {
      window.alert(remoteProfileSetupMessage);
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setFolders([]);
      setActiveChatId('');
      setIsLoadingRemoteData(false);
      setRemoteSyncError(null);
      return;
    }

    if (!currentUser.hasRemoteProfile) {
      setChats([]);
      setFolders([]);
      setActiveChatId('');
      setIsLoadingRemoteData(false);
      setRemoteSyncError(remoteProfileSetupMessage);
      return;
    }

    let isSubscribed = true;

    const loadRemoteData = async () => {
      setIsLoadingRemoteData(true);
      setRemoteSyncError(null);
      setFolderLoadError(null);

      try {
        const chatRows = await fetchChatsForProfile(currentUser.id);

        if (!isSubscribed) {
          return;
        }

        let folderRows: FolderRecord[] = [];

        try {
          folderRows = await fetchFoldersForProfile(currentUser.id);
        } catch (folderError) {
          console.error('Ordner konnten nicht geladen werden.', folderError);
          if (isSubscribed) {
            setFolderLoadError('Ordner konnten nicht geladen werden.');
          }
        }

        if (!isSubscribed) {
          return;
        }

        const folderMap = new Map(folderRows.map((folder) => [folder.id, folder] as const));
        let normalizedChats = chatRows.map((row) => mapChatRowToChat(row, folderMap));

        if (normalizedChats.length === 0) {
          const timestamp = new Date();
          const userName = (currentUser.name ?? settings.profileName ?? '').trim();
          const greeting = userName
            ? `Hallo ${userName}! Wie kann ich dir heute helfen?`
            : 'Hallo! Wie kann ich dir heute helfen?';

          const initialChat: Chat = {
            id: crypto.randomUUID(),
            name: 'Neuer Chat',
            lastUpdated: formatTimestamp(timestamp),
            preview: 'Beschreibe dein nächstes Projekt und starte den AI Agent.',
            messages: [
              {
                id: crypto.randomUUID(),
                author: 'agent',
                content: greeting,
                timestamp: formatTimestamp(timestamp)
              }
            ]
          };

          await createChatForProfile(currentUser.id, initialChat);
          normalizedChats = [initialChat];
        }

        if (!isSubscribed) {
          return;
        }

        const sortedFolders = [...folderRows].sort((a, b) => a.name.localeCompare(b.name));
        setFolders(sortedFolders);
        setChats(normalizedChats);
        setActiveChatId((currentId) => {
          if (currentId && normalizedChats.some((chat) => chat.id === currentId)) {
            return currentId;
          }

          return normalizedChats[0]?.id ?? '';
        });
      } catch (error) {
        console.error('Chats konnten nicht geladen werden.', error);
        if (isSubscribed) {
          setRemoteSyncError('Chats konnten nicht geladen werden.');
        }
      } finally {
        if (isSubscribed) {
          setIsLoadingRemoteData(false);
        }
      }
    };

    loadRemoteData();

    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.hasRemoteProfile, currentUser?.id, currentUser?.name, remoteProfileSetupMessage, settings.profileName]);

  const handleOpenAgentCreation = () => {
    setMobileWorkspaceOpen(false);
    navigate('/profile', { state: { openAgentModal: 'create' } });
  };

  const handleNewChat = async () => {
    if (!currentUser) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const timestamp = new Date();
    const userName = (currentUser?.name ?? settings.profileName ?? '').trim();
    const greeting = userName
      ? `Hallo ${userName}! Wie kann ich dir heute helfen?`
      : 'Hallo! Wie kann ich dir heute helfen?';

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
          content: greeting,
          timestamp: timestamp.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ]
    };

    const previousChats = chats;
    const previousActiveChatId = activeChatId;

    setChats([newChat, ...previousChats]);
    setActiveChatId(newChat.id);
    setWorkspaceCollapsed(false);
    setMobileWorkspaceOpen(false);

    try {
      await createChatForProfile(currentUser.id, newChat);
    } catch (error) {
      console.error('Chat konnte nicht erstellt werden.', error);
      window.alert('Chat konnte nicht erstellt werden. Bitte versuche es erneut.');
      setChats(previousChats);
      setActiveChatId(previousActiveChatId);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileWorkspaceOpen(false);
  };

  const handleRenameChat = async (chatId: string) => {
    const chatToRename = chats.find((chat) => chat.id === chatId);
    if (!chatToRename) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const newName = window.prompt('Wie soll der Chat heißen?', chatToRename.name)?.trim();
    if (!newName || newName === chatToRename.name) {
      return;
    }

    const previousChats = chats;
    const renamedChats = chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            name: newName
          }
        : chat
    );

    setChats(renamedChats);

    try {
      await updateChatRow(chatId, { title: newName });
    } catch (error) {
      console.error('Chat konnte nicht umbenannt werden.', error);
      window.alert('Chat konnte nicht umbenannt werden. Bitte versuche es erneut.');
      setChats(previousChats);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    const chatToDelete = chats.find((chat) => chat.id === chatId);
    if (!chatToDelete) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const shouldDelete = window.confirm(
      `Soll der Chat "${chatToDelete.name}" wirklich gelöscht werden?`
    );

    if (!shouldDelete) {
      return;
    }

    const previousChats = chats;
    const previousActiveChatId = activeChatId;
    const remainingChats = chats.filter((chat) => chat.id !== chatId);

    setChats(remainingChats);
    if (previousActiveChatId === chatId) {
      setActiveChatId(remainingChats[0]?.id ?? '');
    }

    try {
      await deleteChatById(chatId);
    } catch (error) {
      console.error('Chat konnte nicht gelöscht werden.', error);
      window.alert('Chat konnte nicht gelöscht werden. Bitte versuche es erneut.');
      setChats(previousChats);
      setActiveChatId(previousActiveChatId);
    }
  };

  const handleCreateFolder = async () => {
    if (!currentUser) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const folderName = window.prompt('Wie soll der neue Ordner heißen?')?.trim();
    if (!folderName) {
      return;
    }

    if (
      folders.some(
        (folder) => folder.name.localeCompare(folderName, undefined, { sensitivity: 'accent' }) === 0
      )
    ) {
      window.alert('Ein Ordner mit diesem Namen existiert bereits.');
      return;
    }

    try {
      const newFolder = await createFolderForProfile(currentUser.id, folderName);
      setFolders((prev) => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Ordner konnte nicht erstellt werden.', error);
      window.alert('Ordner konnte nicht erstellt werden. Bitte versuche es erneut.');
    }
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

  const handleConfirmFolderSelection = async () => {
    if (!folderSelectionChatId || !currentUser) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const trimmedNewFolder = newFolderName.trim();
    const selectedFolderName =
      selectedExistingFolder === '__none__' ? '' : selectedExistingFolder.trim();

    let targetFolderId: string | null = null;
    let targetFolderName: string | undefined;

    try {
      if (trimmedNewFolder) {
        const existing = folders.find(
          (folder) => folder.name.localeCompare(trimmedNewFolder, undefined, { sensitivity: 'accent' }) === 0
        );

        if (existing) {
          targetFolderId = existing.id;
          targetFolderName = existing.name;
        } else {
          const newFolder = await createFolderForProfile(currentUser.id, trimmedNewFolder);
          targetFolderId = newFolder.id;
          targetFolderName = newFolder.name;
          setFolders((prev) => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else if (selectedFolderName) {
        const existing = folderNameMap.get(selectedFolderName);
        if (!existing) {
          window.alert('Der ausgewählte Ordner existiert nicht mehr.');
          return;
        }

        targetFolderId = existing.id;
        targetFolderName = existing.name;
      }

      await updateChatRow(folderSelectionChatId, { folderId: targetFolderId });

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === folderSelectionChatId
            ? {
                ...chat,
                folder: targetFolderName,
                folderId: targetFolderId ?? undefined
              }
            : chat
        )
      );

      handleCloseFolderSelection();
    } catch (error) {
      console.error('Ordnerzuweisung fehlgeschlagen.', error);
      window.alert('Ordnerzuweisung fehlgeschlagen. Bitte versuche es erneut.');
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!currentUser) {
      return;
    }

    if (!ensureRemoteProfile()) {
      return;
    }

    const folderRecord = folderNameMap.get(folderName);
    if (!folderRecord) {
      window.alert('Der ausgewählte Ordner ist nicht mehr verfügbar.');
      return;
    }

    const folderChats = chats.filter(
      (chat) => chat.folderId === folderRecord.id || chat.folder === folderName
    );

    const shouldDelete = window.confirm(
      folderChats.length > 0
        ? `Soll der Ordner "${folderName}" gelöscht werden? Die enthaltenen Chats bleiben erhalten und werden keinem Ordner mehr zugeordnet.`
        : `Soll der Ordner "${folderName}" gelöscht werden?`
    );

    if (!shouldDelete) {
      return;
    }

    const previousChats = chats;
    const previousFolders = folders;

    const detachedChats = chats.map((chat) =>
      chat.folderId === folderRecord.id || chat.folder === folderName
        ? {
            ...chat,
            folder: undefined,
            folderId: undefined
          }
        : chat
    );

    setChats(detachedChats);
    setFolders((prev) => prev.filter((entry) => entry.id !== folderRecord.id));

    try {
      await detachFolderFromChats(currentUser.id, folderRecord.id);
      await deleteFolderById(folderRecord.id);
    } catch (error) {
      console.error('Ordner konnte nicht gelöscht werden.', error);
      window.alert('Ordner konnte nicht gelöscht werden. Bitte versuche es erneut.');
      setChats(previousChats);
      setFolders(previousFolders);
    }
  };

  const handleSendMessage = async (submission: ChatInputSubmission) => {
    const currentChat = activeChat;
    if (!currentChat) {
      return;
    }

    if (!ensureRemoteProfile()) {
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

    const previewSource = trimmedText
      ? trimmedText
      : audioAttachments.length
      ? 'Audio Nachricht'
      : attachments[0]?.name ?? 'Neue Nachricht';
    const previewText = toPreview(previewSource);

    const chatAfterUserMessage: Chat = {
      ...currentChat,
      messages: [...currentChat.messages, userMessage],
      lastUpdated: formatTimestamp(now),
      preview: previewText
    };

    const previousChats = chats;

    setChats((prev) =>
      prev.map((chat) => (chat.id === chatAfterUserMessage.id ? chatAfterUserMessage : chat))
    );

    setPendingResponseChatId(chatAfterUserMessage.id);

    try {
      await updateChatRow(chatAfterUserMessage.id, {
        messages: chatAfterUserMessage.messages,
        summary: chatAfterUserMessage.preview,
        lastMessageAt: now.toISOString()
      });
    } catch (error) {
      console.error('Nachricht konnte nicht gespeichert werden.', error);
      window.alert('Deine Nachricht konnte nicht gespeichert werden. Bitte versuche es erneut.');
      setChats(previousChats);
      setPendingResponseChatId(null);
      return;
    }

    const effectiveWebhookUrl = selectedAgent?.webhookUrl?.trim() || settings.webhookUrl;
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
        id: crypto.randomUUID(),
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

      setChats((prev) =>
        prev.map((chat) => (chat.id === chatAfterAgent.id ? chatAfterAgent : chat))
      );

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
        id: crypto.randomUUID(),
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

      setChats((prev) =>
        prev.map((chat) => (chat.id === chatWithError.id ? chatWithError : chat))
      );

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
      setPendingResponseChatId(null);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#111111] text-white">

      <div className="flex flex-1 overflow-hidden">
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
            customFolders={folderNames}
            onAssignChatFolder={handleAssignChatFolder}
            onDeleteFolder={handleDeleteFolder}
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
            agents={agentSwitcherOptions}
            activeAgentId={selectedAgent?.id ?? null}
            onSelectAgent={(agentId) => setActiveAgentId(agentId)}
            onCreateAgent={handleOpenAgentCreation}
          />

          {remoteSyncError && (
            <div className="mx-4 mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 md:mx-6">
              {remoteSyncError}
            </div>
          )}
          {folderLoadError && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 md:mx-6">
              {folderLoadError}
            </div>
          )}

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

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {requiresRemoteProfileSetup ? (
              <div className="flex flex-1 items-center justify-center px-6 text-sm text-white/70">
                <div className="w-full max-w-xl rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6 text-center text-amber-100">
                  <h2 className="text-lg font-semibold text-amber-200">Supabase-Setup erforderlich</h2>
                  <p className="mt-3 text-sm text-amber-100/80">{remoteProfileSetupMessage}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-amber-200/60">
                    Ergänze eine Policy für "profiles" und lade die Seite neu.
                  </p>
                </div>
              </div>
            ) : hasAgents ? (
              <>
                {activeChat ? (
                  <ChatTimeline
                    chat={activeChat}
                    agentAvatar={activeAgentAvatar}
                    userAvatar={accountAvatar}
                    isAwaitingResponse={pendingResponseChatId === activeChat.id}
                  />
                ) : isLoadingRemoteData ? (
                  <div className="flex flex-1 items-center justify-center px-6 text-sm text-white/60">
                    Chats werden geladen …
                  </div>
                ) : null}

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

      {folderSelectionChatId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-10">
          <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
            <div className="w-full space-y-6 rounded-3xl border border-white/10 bg-[#161616]/95 p-6 text-white shadow-glow">
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
        </div>
      )}
    </div>
  );
}
