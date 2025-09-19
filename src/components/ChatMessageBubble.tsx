import clsx from 'clsx';
import { ChatMessage } from '../data/sampleChats';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isAgent: boolean;
  agentAvatar: string;
  userAvatar: string;
}

export function ChatMessageBubble({ message, isAgent, agentAvatar, userAvatar }: ChatMessageBubbleProps) {
  return (
    <div className={clsx('flex gap-3 md:gap-4', isAgent ? 'flex-row' : 'flex-row-reverse')}>
      <div className="h-10 w-10 rounded-xl overflow-hidden border border-white/10 shadow-lg">
        <img
          src={isAgent ? agentAvatar : userAvatar}
          alt={isAgent ? 'Agent Avatar' : 'User Avatar'}
          className="h-full w-full object-cover"
        />
      </div>
      <div className={clsx('max-w-3xl space-y-2', isAgent ? 'items-start text-left' : 'items-end text-right')}>
        <div
          className={clsx(
            'rounded-3xl px-5 py-4 text-sm leading-relaxed backdrop-blur-xl border border-white/5 shadow-lg/10',
            isAgent
              ? 'bg-[#1f1f1f] text-white'
              : 'bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold text-surface-base shadow-glow'
          )}
        >
          {message.content}
        </div>
        <span className="text-xs text-white/30">{message.timestamp}</span>
      </div>
    </div>
  );
}
