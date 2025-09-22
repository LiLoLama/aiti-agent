import { useEffect, useMemo, useState } from 'react';
import { Chat } from '../data/sampleChats';
import {
  PencilIcon,
  TrashIcon,
  FolderPlusIcon,
  ChevronRightIcon,
  XMarkIcon,
  PlusIcon,
  Cog6ToothIcon,
  FolderArrowDownIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import aitiLogo from '../assets/aiti-logo.svg';

interface ChatOverviewPanelProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onCreateFolder: () => void;
  onRenameChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  customFolders: string[];
  onAssignChatFolder: (chatId: string) => void;
  onOpenSettings: () => void;
}

export function ChatOverviewPanel({
  chats,
  activeChatId,
  onSelectChat,
  isMobileOpen,
  onCloseMobile,
  onNewChat,
  onCreateFolder,
  onRenameChat,
  onDeleteChat,
  customFolders,
  onAssignChatFolder,
  onOpenSettings
}: ChatOverviewPanelProps) {
  const chatsByFolder = useMemo(() => {
    return chats.reduce<Record<string, Chat[]>>((acc, chat) => {
      if (!chat.folder) {
        return acc;
      }

      acc[chat.folder] = acc[chat.folder] ? [...acc[chat.folder], chat] : [chat];
      return acc;
    }, {});
  }, [chats]);

  const folders = useMemo(() => {
    const folderSet = new Set<string>([
      ...Object.keys(chatsByFolder),
      ...customFolders
    ]);

    return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
  }, [chatsByFolder, customFolders]);

  const unassignedChats = useMemo(
    () => chats.filter((chat) => !chat.folder),
    [chats]
  );

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenFolders((prev) => {
      const nextState = folders.reduce<Record<string, boolean>>((acc, folder) => {
        acc[folder] = prev[folder] ?? false;
        return acc;
      }, {});

      const activeFolder = chats.find((chat) => chat.id === activeChatId)?.folder;
      if (activeChatId && activeFolder && activeFolder in nextState) {
        nextState[activeFolder] = true;
      }

      return nextState;
    });
  }, [folders, activeChatId, chats]);

  const toggleFolder = (folder: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };

  const PanelContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Workspace</p>
            <div className="mt-1 flex items-center gap-3">
              <img src={aitiLogo} alt="AITI Explorer Agent" className="h-9 w-9" />
              <h3 className="text-lg font-semibold text-white">AITI Explorer Agent</h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onNewChat}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-4 py-2 text-xs font-semibold text-surface-base shadow-glow hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" /> Neuer Chat
              </button>
              <button
                onClick={onCreateFolder}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
              >
                <FolderPlusIcon className="h-4 w-4" /> Ordner anlegen
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCloseMobile}
              className="lg:hidden inline-flex items-center gap-2 rounded-full border border-white/10 p-2 text-white/60 hover:bg-white/10"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {folders.map((folder) => {
          const folderChats = chatsByFolder[folder] ?? [];
          const isOpen = openFolders[folder] ?? false;

          return (
            <div key={folder} className="rounded-2xl border border-white/5 bg-white/[0.03]">
              <button
                onClick={() => toggleFolder(folder)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-white/70"
              >
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  <ChevronRightIcon
                    className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
                  />
                  {folder}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                  {folderChats.length}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-white/5 px-4 py-4">
                  {folderChats.length === 0 && (
                    <p className="text-xs text-white/40">Noch keine Chats in diesem Ordner.</p>
                  )}
                  {folderChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={clsx(
                        'rounded-2xl border px-4 py-3 transition',
                        chat.id === activeChatId
                          ? 'border-brand-gold/50 bg-white/5 shadow-glow'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/10'
                      )}
                    >
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white">{chat.name}</h4>
                          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                            {chat.lastUpdated}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-white/50 line-clamp-2">{chat.preview}</p>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <button
                          onClick={() => onRenameChat(chat.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                        >
                          <PencilIcon className="h-4 w-4" /> Umbenennen
                        </button>
                        <button
                          onClick={() => onDeleteChat(chat.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-rose-300 hover:bg-white/20"
                        >
                          <TrashIcon className="h-4 w-4" /> Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/50">
            <span>Chats ohne Ordner</span>
            <span className="text-[10px] tracking-[0.25em] text-white/30">{unassignedChats.length}</span>
          </div>

          {unassignedChats.length === 0 ? (
            <p className="text-xs text-white/40">Noch keine Chats ohne Ordner.</p>
          ) : (
            <div className="space-y-3">
              {unassignedChats.map((chat) => (
                <div
                  key={chat.id}
                  className={clsx(
                    'rounded-2xl border px-4 py-3 transition',
                    chat.id === activeChatId
                      ? 'border-brand-gold/50 bg-white/5 shadow-glow'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/10'
                  )}
                >
                  <button onClick={() => onSelectChat(chat.id)} className="w-full text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">{chat.name}</h4>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                        {chat.lastUpdated}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/50 line-clamp-2">{chat.preview}</p>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => onAssignChatFolder(chat.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                    >
                      <FolderArrowDownIcon className="h-4 w-4" /> In Ordner verschieben
                    </button>
                    <button
                      onClick={() => onRenameChat(chat.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                    >
                      <PencilIcon className="h-4 w-4" /> Umbenennen
                    </button>
                    <button
                      onClick={() => onDeleteChat(chat.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-rose-300 hover:bg-white/20"
                    >
                      <TrashIcon className="h-4 w-4" /> Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {folders.length === 0 && unassignedChats.length === 0 && (
          <p className="text-xs text-white/40">Noch keine Chats vorhanden.</p>
        )}
      </div>

      <div className="border-t border-white/10 px-6 py-6">
        <button
          onClick={onOpenSettings}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
        >
          <Cog6ToothIcon className="h-5 w-5" /> Einstellungen
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-96 flex-shrink-0 flex-col border-r border-white/10 bg-[#161616]/90 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-hidden">
        {PanelContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/80 px-4 pb-24 pt-10 lg:hidden">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#161616]/95 backdrop-blur-xl shadow-glow">
            {PanelContent}
          </div>
        </div>
      )}
    </>
  );
}
