import { Bars3Icon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import clsx from 'clsx';

interface ChatHeaderProps {
  agentName: string;
  agentRole: string;
  agentStatus: 'online' | 'offline' | 'busy';
  onOpenOverview: () => void;
  agentAvatar: string;
}

const statusCopy: Record<ChatHeaderProps['agentStatus'], string> = {
  online: 'Verfügbar',
  offline: 'Offline',
  busy: 'Beschäftigt'
};

export function ChatHeader({
  agentName,
  agentRole,
  agentStatus,
  onOpenOverview,
  agentAvatar
}: ChatHeaderProps) {
  const statusColor = useMemo(() => {
    switch (agentStatus) {
      case 'online':
        return 'bg-emerald-400';
      case 'busy':
        return 'bg-amber-400';
      default:
        return 'bg-zinc-500';
    }
  }, [agentStatus]);

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-[#161616]/80 backdrop-blur-xl px-4 md:px-8 py-4">
      <div className="flex items-center gap-4">
        <button
          className="lg:hidden rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 transition"
          onClick={onOpenOverview}
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          <img src={agentAvatar} alt={agentName} className="h-full w-full object-cover" />
          <span className={clsx('absolute bottom-1 right-1 h-3 w-3 rounded-full border border-black/60', statusColor)} />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-white">{agentName}</h1>
          <p className="text-sm text-white/60">{agentRole}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
            <span className={clsx('h-1.5 w-1.5 rounded-full', statusColor)} />
            {statusCopy[agentStatus]}
          </div>
        </div>
      </div>
    </header>
  );
}
