import { Fragment, useMemo } from 'react';
import { PlusIcon, Cog6ToothIcon, FolderIcon } from '@heroicons/react/24/outline';
import { Chat } from '../data/sampleChats';
import clsx from 'clsx';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleDrawer: () => void;
}

export function Sidebar({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  onOpenSettings,
  onToggleDrawer
}: SidebarProps) {
  const chatsByFolder = useMemo(() => {
    const grouped = chats.reduce<Record<string, Chat[]>>((acc, chat) => {
      const folder = chat.folder ?? 'Ohne Ordner';
      acc[folder] = acc[folder] ? [...acc[folder], chat] : [chat];
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [chats]);

  return (
    <aside className="hidden lg:flex lg:w-80 xl:w-96 flex-col bg-[#1c1c1c] border-r border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">Workspace</p>
            <h2 className="text-xl font-semibold text-white">AI Training Studio</h2>
          </div>
          <button
            onClick={onToggleDrawer}
            className="px-3 py-2 text-xs font-medium rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition"
          >
            Übersicht
          </button>
        </div>
        <button
          onClick={onNewChat}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold text-surface-base text-sm font-semibold py-3 shadow-glow hover:opacity-90 transition"
        >
          <PlusIcon className="h-5 w-5" />
          Neuer Chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-6 py-4 space-y-6">
          {chatsByFolder.map(([folder, folderChats]) => (
            <Fragment key={folder}>
              <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">
                <FolderIcon className="h-4 w-4" />
                {folder}
              </div>
              <div className="space-y-2">
                {folderChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => onChatSelect(chat.id)}
                    className={clsx(
                      'w-full rounded-2xl px-4 py-3 text-left transition border border-transparent hover:border-white/10 hover:bg-white/5',
                      chat.id === activeChatId
                        ? 'bg-white/10 text-white shadow-glow border-white/10'
                        : 'text-white/70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{chat.name}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {chat.lastUpdated}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-2 mt-1">{chat.preview}</p>
                  </button>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </nav>

      <div className="p-6 border-t border-white/10">
        <button
          onClick={onOpenSettings}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 text-white/80 text-sm font-medium py-2.5 hover:bg-white/10 transition"
        >
          <Cog6ToothIcon className="h-5 w-5" />
          Einstellungen
        </button>
      </div>
    </aside>
  );
}
