import { Chat } from '../data/sampleChats';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatTimelineProps {
  chat: Chat;
  agentAvatar: string;
  userAvatar: string;
  backgroundImage?: string;
}

export function ChatTimeline({ chat, agentAvatar, userAvatar, backgroundImage }: ChatTimelineProps) {
  return (
    <section className="relative flex-1 overflow-hidden">
      {backgroundImage && (
        <div className="pointer-events-none absolute inset-0">
          <img
            src={backgroundImage}
            alt="Chat Hintergrund"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />
        </div>
      )}
      <div className="relative h-full overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        {chat.messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            isAgent={message.author === 'agent'}
            agentAvatar={agentAvatar}
            userAvatar={userAvatar}
          />
        ))}
      </div>
    </section>
  );
}
