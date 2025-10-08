import clsx from 'clsx';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Chat } from '../data/sampleChats';
import aitiLogo from '../assets/aiti-logo.svg';
import type { AgentProfile } from '../types/auth';

interface ChatOverviewPanelProps {
  agents: AgentProfile[];
  agentChats: Record<string, Chat | undefined>;
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onCreateAgent: () => void;
  defaultAgentAvatar: string;
}

export function ChatOverviewPanel({
  agents,
  agentChats,
  activeAgentId,
  onSelectAgent,
  isMobileOpen,
  onCloseMobile,
  onCreateAgent,
  defaultAgentAvatar
}: ChatOverviewPanelProps) {
  const PanelContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Agents</p>
            <div className="mt-1 flex items-center gap-3">
              <img src={aitiLogo} alt="AITI Explorer Agent" className="h-9 w-9" />
              <h3 className="text-lg font-semibold text-white">Deine Agenten</h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onCreateAgent}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-4 py-2 text-xs font-semibold text-surface-base shadow-glow transition hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" /> Neuen Agent anlegen
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

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-6 py-6">
        {agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/60">
            Noch keine Agenten vorhanden. Lege deinen ersten Agenten an, um zu starten.
          </div>
        ) : (
          agents.map((agent) => {
            const chat = agentChats[agent.id];
            const lastUpdated = chat?.lastUpdated ?? 'Noch kein Verlauf';
            const preview = chat?.preview ?? 'Noch keine Nachrichten verfügbar.';
            const avatar = agent.avatarUrl ?? defaultAgentAvatar;

            return (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                className={clsx(
                  'flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition',
                  agent.id === activeAgentId
                    ? 'border-brand-gold/60 bg-white/10 text-white shadow-glow'
                    : 'border-white/5 bg-white/[0.03] text-white/80 hover:bg-white/10'
                )}
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
                  <img src={avatar} alt={agent.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">{agent.name}</h4>
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">{lastUpdated}</span>
                  </div>
                  {agent.description && (
                    <p className="mt-1 text-xs text-white/50 line-clamp-1">{agent.description}</p>
                  )}
                  <p className="mt-2 text-xs text-white/60 line-clamp-2">{preview}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <aside
      className={clsx(
        'relative z-30 flex w-full max-w-md flex-shrink-0 flex-col border-r border-white/10 bg-[#121212]/95 text-white shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:translate-x-0',
        isMobileOpen ? 'translate-x-0' : 'translate-x-[-100%] lg:translate-x-0',
        'lg:relative lg:max-w-sm'
      )}
    >
      <div className="hidden lg:block lg:h-full">{PanelContent}</div>
      <div className={clsx('lg:hidden', isMobileOpen ? 'block' : 'hidden')}>
        {PanelContent}
      </div>
    </aside>
  );
}
