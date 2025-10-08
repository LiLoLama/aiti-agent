import { ChatMessage } from '../data/sampleChats';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface ChatTimelineProps {
  messages: ChatMessage[];
  agentAvatar: string;
  userAvatar: string;
  isAwaitingResponse?: boolean;
  hasActiveSearch?: boolean;
}

export function ChatTimeline({
  messages,
  agentAvatar,
  userAvatar,
  isAwaitingResponse,
  hasActiveSearch
}: ChatTimelineProps) {
  if (messages.length === 0) {
    return (
      <section className="relative flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full items-center justify-center px-6 text-sm text-white/60">
          {hasActiveSearch ? 'Keine Nachrichten für die Suche gefunden.' : 'Noch keine Nachrichten vorhanden.'}
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex-1 min-h-0 overflow-hidden">
      <div className="relative h-full overflow-y-auto">
        <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isAgent={message.author === 'agent'}
              agentAvatar={agentAvatar}
              userAvatar={userAvatar}
            />
          ))}

          {isAwaitingResponse && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
