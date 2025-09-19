import { Chat } from '../data/sampleChats';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatTimelineProps {
  chat: Chat;
  agentAvatar: string;
  userAvatar: string;
}

export function ChatTimeline({ chat, agentAvatar, userAvatar }: ChatTimelineProps) {
  return (
    <section className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
      {chat.messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          isAgent={message.author === 'agent'}
          agentAvatar={agentAvatar}
          userAvatar={userAvatar}
        />
      ))}
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-5 text-sm text-white/40">
        Nächste Antwort des Agents erscheint hier – verfolge die Live-Streaming Ausgabe des Webhooks in Echtzeit.
      </div>
    </section>
  );
}
