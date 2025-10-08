import { Chat } from '../data/sampleChats';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface ChatTimelineProps {
  chat: Chat;
  agentAvatar: string;
  userAvatar: string;
  isAwaitingResponse?: boolean;
}

export function ChatTimeline({
  chat,
  agentAvatar,
  userAvatar,
  isAwaitingResponse
}: ChatTimelineProps) {
  return (
    <section className="relative flex-1 min-h-0 overflow-hidden">
      <div className="relative h-full overflow-y-auto">
        <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
          {chat.messages.map((message) => (
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
