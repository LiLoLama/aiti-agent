import { Bars3Icon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

interface ChatHeaderProps {
  agentName: string;
  agentRole: string;
  agentStatus: 'online' | 'offline' | 'busy';
  onOpenOverview: () => void;
  agentAvatar: string;
  userName?: string;
  userAvatar?: string;
  onOpenProfile?: () => void;
  agents?: Array<{ id: string; name: string; description?: string | null }>;
  activeAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  onCreateAgent?: () => void;
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
  agentAvatar,
  userName,
  userAvatar,
  onOpenProfile,
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent
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

  const agentOptions = agents ?? [];
  const hasSelectionHandler = typeof onSelectAgent === 'function';
  const canOpenMenu = (agentOptions.length > 0 && hasSelectionHandler) || Boolean(onCreateAgent);
  const showChevron = agentOptions.length > 1 || Boolean(onCreateAgent);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAgentMenuOpen, setAgentMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAgentMenuOpen) {
      return;
    }

    const handleClickAway = (event: MouseEvent) => {
      if (!agentMenuRef.current || agentMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setAgentMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAgentMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAgentMenuOpen]);

  useEffect(() => {
    if (!canOpenMenu && isAgentMenuOpen) {
      setAgentMenuOpen(false);
    }
  }, [canOpenMenu, isAgentMenuOpen]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#161616]/80 backdrop-blur-xl px-4 py-4 md:px-8">
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
        <div className="relative" ref={agentMenuRef}>
          {canOpenMenu ? (
            <button
              type="button"
              onClick={() => setAgentMenuOpen((previous) => !previous)}
              className="text-left text-white"
              aria-haspopup="menu"
              aria-expanded={isAgentMenuOpen}
            >
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold md:text-xl">{agentName}</h1>
                {showChevron && <ChevronDownIcon className="h-4 w-4 text-white/60" />}
              </div>
              <p className="text-sm text-white/60">{agentRole}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                <span className={clsx('h-1.5 w-1.5 rounded-full', statusColor)} />
                {statusCopy[agentStatus]}
              </div>
            </button>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-white md:text-xl">{agentName}</h1>
              <p className="text-sm text-white/60">{agentRole}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                <span className={clsx('h-1.5 w-1.5 rounded-full', statusColor)} />
                {statusCopy[agentStatus]}
              </div>
            </div>
          )}

          {isAgentMenuOpen && (
            <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-2xl border border-white/10 bg-[#1b1b1b]/95 p-3 shadow-2xl">
              <div className="space-y-2">
                {agentOptions.length > 0 && hasSelectionHandler ? (
                  agentOptions.map((agent) => (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => {
                        onSelectAgent?.(agent.id);
                        setAgentMenuOpen(false);
                      }}
                      className={clsx(
                        'w-full rounded-xl border border-transparent px-3 py-2 text-left transition',
                        activeAgentId === agent.id
                          ? 'bg-white/10 text-white shadow-glow'
                          : 'bg-transparent text-white/70 hover:bg-white/5'
                      )}
                    >
                      <span className="block text-sm font-semibold text-white">{agent.name}</span>
                      {agent.description && (
                        <span className="mt-1 block text-xs text-white/50">{agent.description}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-white/60">Noch keine Agents verfügbar.</p>
                )}
              </div>
              {onCreateAgent && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAgentMenuOpen(false);
                      onCreateAgent();
                    }}
                    className="w-full rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Neuen Agent anlegen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {userName && (
        <button
          onClick={onOpenProfile}
          className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-white/70 transition hover:bg-white/10"
        >
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={userAvatar}
              alt={userName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="hidden text-sm font-semibold sm:block">
            <p className="text-white">{userName}</p>
            <p className="text-xs text-white/40 group-hover:text-white/60">Mein Profil</p>
          </div>
        </button>
      )}
    </header>
  );
}
