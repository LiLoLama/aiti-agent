import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTimeline } from '../components/ChatTimeline';
import { ChatInput } from '../components/ChatInput';
import { ChatManagementDrawer } from '../components/ChatManagementDrawer';
import { MobileNavBar } from '../components/MobileNavBar';
import { ChatOverviewPanel } from '../components/ChatOverviewPanel';
import { sampleChats, Chat } from '../data/sampleChats';
import { useToggle } from '../hooks/useToggle';

import agentAvatar from '../assets/agent-avatar.png';
import userAvatar from '../assets/default-user.svg';

export function ChatPage() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>(sampleChats);
  const [activeChatId, setActiveChatId] = useState<string>(sampleChats[0]?.id ?? '');
  const [isDrawerOpen, toggleDrawer, setDrawerOpen] = useToggle(false);
  const [isOverviewCollapsed, setOverviewCollapsed] = useState(false);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

  const handleNewChat = () => {
    const timestamp = new Date();
    const newChat: Chat = {
      id: crypto.randomUUID(),
      name: 'Neuer Chat',
      folder: 'Entwürfe',
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
    setOverviewCollapsed(false);
    setDrawerOpen(false);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setDrawerOpen(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#111111] text-white">
      <MobileNavBar
        onNewChat={handleNewChat}
        onOpenSettings={() => navigate('/settings')}
        onToggleDrawer={toggleDrawer}
      />

      <ChatManagementDrawer
        chats={chats}
        isOpen={isDrawerOpen}
        onClose={toggleDrawer}
        onSelectChat={handleSelectChat}
      />

      <div className="flex flex-1">
        <Sidebar
          chats={chats}
          activeChatId={activeChat?.id ?? ''}
          onChatSelect={handleSelectChat}
          onNewChat={handleNewChat}
          onOpenSettings={() => navigate('/settings')}
          onToggleDrawer={toggleDrawer}
        />

        <main className="flex flex-1 flex-col">
          <ChatHeader
            agentName="AITI Agent"
            agentRole="N8n Workflow Companion"
            agentStatus="online"
            onToggleDrawer={toggleDrawer}
            onOpenSettings={() => navigate('/settings')}
            agentAvatar={agentAvatar}
          />

          <div className="hidden xl:flex justify-end px-8 pt-4">
            <button
              onClick={() => setOverviewCollapsed((prev) => !prev)}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-white/40 hover:bg-white/10"
            >
              {isOverviewCollapsed ? 'Verwaltung anzeigen' : 'Verwaltung ausblenden'}
            </button>
          </div>

          {activeChat && (
            <ChatTimeline chat={activeChat} agentAvatar={agentAvatar} userAvatar={userAvatar} />
          )}

          <div className="px-4 pb-28 pt-2 md:px-8 md:pb-10">
            <ChatInput onSendMessage={() => undefined} />
            <p className="mt-3 text-xs text-white/30">
              Audio- und Textnachrichten werden direkt an deinen n8n-Webhook gesendet und als strukturierte Antwort im Stream angezeigt.
            </p>
          </div>
        </main>

        <ChatOverviewPanel
          chats={chats}
          activeChatId={activeChat?.id ?? ''}
          onSelectChat={handleSelectChat}
          isCollapsed={isOverviewCollapsed}
        />
      </div>
    </div>
  );
}
