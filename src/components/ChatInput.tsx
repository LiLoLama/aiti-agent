import { MicrophoneIcon, PaperAirplaneIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (value: string) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get('message') ?? '').trim();

    if (message) {
      onSendMessage(message);
      form.reset();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative mt-6 rounded-3xl border border-white/10 bg-[#1b1b1b]/80 backdrop-blur-2xl p-2 shadow-[0_0_40px_rgba(250,207,57,0.12)]"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="group rounded-2xl bg-white/5 p-3 text-white/70 transition hover:bg-white/10"
        >
          <PaperClipIcon className="h-5 w-5 group-hover:text-white" />
        </button>
        <input
          name="message"
          placeholder="Nachricht an den Agent eingeben..."
          className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          type="button"
          className="group rounded-2xl bg-white/5 p-3 text-white/70 transition hover:bg-white/10"
          title="Audio Nachricht senden"
        >
          <MicrophoneIcon className="h-5 w-5 group-hover:text-brand-gold" />
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-5 py-3 text-sm font-semibold text-surface-base shadow-glow transition hover:opacity-90"
        >
          Senden
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
