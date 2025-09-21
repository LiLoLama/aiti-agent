import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTimeline } from '../components/ChatTimeline';
import { ChatInput } from '../components/ChatInput';
import { MobileNavBar } from '../components/MobileNavBar';
import { ChatOverviewPanel } from '../components/ChatOverviewPanel';
import { sampleChats, Chat } from '../data/sampleChats';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';

export function ChatPage() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>(sampleChats);
  const [activeChatId, setActiveChatId] = useState<string>(sampleChats[0]?.id ?? '');
  const [isWorkspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [isMobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [chatBackground, setChatBackground] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem('chatBackgroundImage');
  });

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

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

    const existingFolders = Array.from(
      new Set(
        [...customFolders, ...chats.map((chat) => chat.folder).filter((folder): folder is string => Boolean(folder))]
      )
    ).sort((a, b) => a.localeCompare(b));

    const folderPromptMessage = existingFolders.length
      ? `In welchen Ordner soll "${chatToAssign.name}" verschoben werden?\nVerfügbare Ordner: ${existingFolders.join(', ')}`
      : `Wie soll der Ordner heißen, in den "${chatToAssign.name}" verschoben werden soll?`;

    const folderName = window.prompt(folderPromptMessage)?.trim();
    if (!folderName) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              folder: folderName
            }
          : chat
      )
    );

    setCustomFolders((prev) => {
      if (prev.includes(folderName)) {
        return prev;
      }

      return [...prev, folderName];
    });
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
            onOpenSettings={() => navigate('/settings')}
            agentAvatar={agentAvatar}
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
              agentAvatar={agentAvatar}
              userAvatar={userAvatar}
              backgroundImage={chatBackground ?? undefined}
            />
          )}

          <div className="px-4 pb-28 pt-2 md:px-8 md:pb-10">
            <ChatInput onSendMessage={() => undefined} />
            <p className="mt-3 text-xs text-white/30">
              Audio- und Textnachrichten werden direkt an deinen n8n-Webhook gesendet und als strukturierte Antwort im Stream angezeigt.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
