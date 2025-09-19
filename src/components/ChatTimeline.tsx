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
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
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
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-5 text-sm text-white/60 backdrop-blur-sm bg-black/20">
          Nächste Antwort des Agents erscheint hier – verfolge die Live-Streaming Ausgabe des Webhooks in Echtzeit.
        </div>
      </div>
    </section>
  );
}
