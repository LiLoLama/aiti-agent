import { MicrophoneIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ChatMessage } from '../data/sampleChats';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isAgent: boolean;
  agentAvatar: string;
  userAvatar: string;
}

export function ChatMessageBubble({ message, isAgent, agentAvatar, userAvatar }: ChatMessageBubbleProps) {
  const formatFileSize = (size?: number) => {
    if (!size) {
      return '';
    }

    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (size >= 1024) {
      return `${Math.round(size / 1024)} KB`;
    }

    return `${size} B`;
  };

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
              ? 'bg-[#2b2b2b] text-[#ffffff]'
              : 'bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold text-surface-base shadow-glow'
          )}
        >
          {message.content}
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div
            className={clsx(
              'space-y-2 text-xs',
              isAgent ? 'text-left text-[rgba(255,255,255,0.8)]' : 'text-right text-white/80'
            )}
          >
            {message.attachments.map((attachment) => {
              if (attachment.kind === 'audio') {
                return (
                  <div
                    key={attachment.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[#ffffff]">
                        <MicrophoneIcon className="h-4 w-4 text-brand-gold" />
                        Audio Nachricht
                      </span>
                      {typeof attachment.durationSeconds === 'number' ? (
                        <span className={clsx(isAgent ? 'text-[rgba(255,255,255,0.4)]' : 'text-white/40')}>
                          {attachment.durationSeconds.toFixed(1)}s
                        </span>
                      ) : null}
                    </div>
                    <audio
                      controls
                      src={attachment.url}
                      className="mt-2 w-full"
                    />
                  </div>
                );
              }

              return (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  download={attachment.name}
                  className={clsx(
                    'flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10',
                    isAgent ? 'text-[#ffffff]' : 'text-white'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <PaperClipIcon className="h-4 w-4" />
                    <span className="max-w-[200px] truncate" title={attachment.name}>
                      {attachment.name}
                    </span>
                  </span>
                  <span className={clsx(isAgent ? 'text-[rgba(255,255,255,0.4)]' : 'text-white/40')}>
                    {formatFileSize(attachment.size)}
                  </span>
                </a>
              );
            })}
          </div>
        )}
        <span
          className={clsx(
            'text-xs',
            isAgent ? 'text-[rgba(255,255,255,0.3)]' : 'text-white/30'
          )}
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}
