import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface AgentListItem {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  preview?: string;
  lastUpdated?: string;
}

interface ChatOverviewPanelProps {
  agents: AgentListItem[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onCreateAgent: () => void;
}

export function ChatOverviewPanel({
  agents,
  activeAgentId,
  onSelectAgent,
  isMobileOpen,
  onCloseMobile,
  onCreateAgent
}: ChatOverviewPanelProps) {
  const PanelContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Agents</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Deine persönlichen Assistenten</h3>
            <p className="mt-2 text-sm text-white/60">
              Wähle einen Agenten aus, um den gemeinsamen Chat zu öffnen.
            </p>
            <button
              onClick={onCreateAgent}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-4 py-2 text-xs font-semibold text-surface-base shadow-glow transition hover:opacity-90"
            >
              <PlusIcon className="h-4 w-4" /> Neuen Agenten anlegen
            </button>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden inline-flex items-center gap-2 rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/10"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-6 py-6">
        {agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/60">
            Du hast noch keine Agents angelegt.
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={clsx(
                'w-full rounded-3xl border px-4 py-4 text-left transition',
                agent.id === activeAgentId
                  ? 'border-brand-gold/60 bg-white/10 shadow-glow'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/10'
              )}
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                  {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-white">{agent.name}</h4>
                    {agent.lastUpdated && (
                      <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                        {agent.lastUpdated}
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="mt-1 text-xs text-white/50 line-clamp-2">{agent.description}</p>
                  )}
                  {agent.preview && (
                    <p className="mt-2 text-xs text-white/60 line-clamp-2">{agent.preview}</p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={clsx(
          'relative w-full max-w-md flex-col border-r border-white/5 bg-[#161616]/70 backdrop-blur-xl transition-all duration-300',
          isMobileOpen ? 'fixed inset-y-0 left-0 z-40 flex max-w-sm shadow-2xl lg:relative lg:flex lg:max-w-md' : 'hidden lg:flex'
        )}
      >
        <div className="absolute inset-0 bg-[#161616]/80" />
        <div className="relative flex h-full flex-col">{PanelContent}</div>
      </aside>

      {isMobileOpen && (
        <button
          type="button"
          aria-label="Workspace schließen"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden"
        />
      )}
    </>
  );
}
