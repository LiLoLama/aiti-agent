import { Chat } from '../data/sampleChats';
import {
  PencilIcon,
  TrashIcon,
  FolderPlusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface ChatOverviewPanelProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  isCollapsed: boolean;
}

export function ChatOverviewPanel({ chats, activeChatId, onSelectChat, isCollapsed }: ChatOverviewPanelProps) {
  if (isCollapsed) {
    return null;
  }

  return (
    <aside className="hidden xl:flex w-96 flex-col border-l border-white/10 bg-[#161616]/80 backdrop-blur-xl">
      <div className="px-6 py-6 border-b border-white/10">
        <p className="text-xs uppercase tracking-[0.28em] text-white/40">Chat Verwaltung</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Folders &amp; Automationen</h3>
        <p className="mt-2 text-sm text-white/50">
          Organisiere deine Konversationen, starte neue Flows oder archiviere abgeschlossene Workstreams.
        </p>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/10">
            <FolderPlusIcon className="mr-2 inline h-4 w-4" /> Ordner
          </button>
          <button className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/10">
            <ArrowPathIcon className="mr-2 inline h-4 w-4" /> Sync
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
              chat.id === activeChatId
                ? 'border-brand-gold/50 bg-white/5 shadow-glow'
                : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-white">{chat.name}</h4>
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">{chat.lastUpdated}</span>
            </div>
            <p className="mt-2 text-sm text-white/60 line-clamp-2">{chat.preview}</p>
            <div className="mt-4 flex gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-white/70">
                <PencilIcon className="h-4 w-4" /> Umbenennen
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-rose-300/90">
                <TrashIcon className="h-4 w-4" /> Löschen
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
