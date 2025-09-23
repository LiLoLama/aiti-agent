import {
  MicrophoneIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

export interface ChatInputSubmission {
  text: string;
  files: File[];
  audio?: {
    blob: Blob;
    durationSeconds?: number | null;
  };
}

interface ChatInputProps {
  onSendMessage: (payload: ChatInputSubmission) => Promise<void> | void;
  pushToTalkEnabled?: boolean;
}

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
};

export function ChatInput({ onSendMessage, pushToTalkEnabled = true }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recorderMimeTypeRef = useRef<string>('');

  const canSubmit = useMemo(() => {
    return Boolean(message.trim() || selectedFiles.length > 0 || audioBlob);
  }, [message, selectedFiles, audioBlob]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const resetAudioState = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setAudioDuration(null);
    recordingStartedAtRef.current = null;
    recorderMimeTypeRef.current = '';
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }

    try {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }

    setIsRecording(false);
  };

  const handleRecordingStop = () => {
    const chunks = audioChunksRef.current;
    const mimeType = recorderMimeTypeRef.current || 'audio/webm';
    const blob = chunks.length ? new Blob(chunks, { type: mimeType }) : null;
    audioChunksRef.current = [];

    if (blob) {
      resetAudioState();
      const objectUrl = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(objectUrl);
      if (recordingStartedAtRef.current) {
        const durationInSeconds = (Date.now() - recordingStartedAtRef.current) / 1000;
        setAudioDuration(Number(durationInSeconds.toFixed(1)));
      }
    }
  };

  const requestAudioStream = async () => {
    if (navigator.mediaDevices?.getUserMedia) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const extendedNavigator = navigator as Navigator & {
      webkitGetUserMedia?: (
        constraints: MediaStreamConstraints,
        onSuccess: (stream: MediaStream) => void,
        onError: (error: unknown) => void
      ) => void;
      mozGetUserMedia?: (
        constraints: MediaStreamConstraints,
        onSuccess: (stream: MediaStream) => void,
        onError: (error: unknown) => void
      ) => void;
    };

    const legacyGetUserMedia = extendedNavigator.webkitGetUserMedia ?? extendedNavigator.mozGetUserMedia;

    if (legacyGetUserMedia) {
      return new Promise<MediaStream>((resolve, reject) => {
        legacyGetUserMedia.call(
          navigator,
          { audio: true },
          (stream: MediaStream) => resolve(stream),
          (error: unknown) => reject(error)
        );
      });
    }

    throw new Error('unsupported');
  };

  const resolveSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return '';
  };

  const startRecording = async () => {
    if (!pushToTalkEnabled) {
      setRecordingError('Die Audioaufnahme ist in den Einstellungen deaktiviert.');
      return;
    }

    if (isRecording) {
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setRecordingError('Dein Browser unterstützt keine Audioaufnahme.');
      return;
    }

    try {
      setRecordingError(null);
      const stream = await requestAudioStream();
      const mimeType = resolveSupportedMimeType();
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderMimeTypeRef.current = mediaRecorder.mimeType || mimeType;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        handleRecordingStop();
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Audio recording failed', error);
      if (error instanceof Error && error.message === 'unsupported') {
        setRecordingError('Dein Browser unterstützt keine Audioaufnahme.');
      } else {
        setRecordingError('Audioaufnahme konnte nicht gestartet werden. Prüfe die Mikrofonrechte.');
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await Promise.resolve(
        onSendMessage({
          text: message.trim(),
          files: selectedFiles,
          audio: audioBlob
            ? {
                blob: audioBlob,
                durationSeconds: audioDuration
              }
            : undefined
        })
      );

      setMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      resetAudioState();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative mt-6 rounded-3xl border border-white/10 bg-[#1b1b1b]/80 backdrop-blur-2xl p-4 shadow-[0_0_40px_rgba(250,207,57,0.12)]"
    >
      {(selectedFiles.length > 0 || audioBlob || recordingError) && (
        <div className="mb-4 space-y-3">
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/80"
                >
                  <PaperClipIcon className="h-4 w-4" />
                  <span className="max-w-[160px] truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-white/40">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="rounded-full bg-white/10 p-1 text-white/50 transition hover:bg-white/20 hover:text-white"
                    aria-label={`${file.name} entfernen`}
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {audioBlob && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MicrophoneIcon className="h-4 w-4 text-brand-gold" />
                  <span>Aufgenommene Audionachricht</span>
                  {audioDuration ? <span className="text-white/40">{audioDuration}s</span> : null}
                </div>
                <button
                  type="button"
                  onClick={resetAudioState}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/10"
                >
                  Entfernen
                </button>
              </div>
              {audioUrl ? (
                <audio controls src={audioUrl} className="mt-1 w-full" />
              ) : null}
            </div>
          )}

          {recordingError && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {recordingError}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group rounded-2xl bg-white/5 p-3 text-white/70 transition hover:bg-white/10"
          title="Dateien anhängen"
        >
          <PaperClipIcon className="h-5 w-5 group-hover:text-white" />
        </button>
        <input
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Nachricht an den Agent eingeben..."
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={toggleRecording}
          disabled={!pushToTalkEnabled && !isRecording}
          className={`group rounded-2xl p-3 transition ${
            isRecording
              ? 'bg-rose-500/20 text-rose-100'
              : pushToTalkEnabled
              ? 'bg-white/5 text-white/70 hover:bg-white/10'
              : 'cursor-not-allowed bg-white/5 text-white/30'
          }`}
          title={pushToTalkEnabled ? 'Audio Nachricht aufnehmen' : 'Audioaufnahme deaktiviert'}
        >
          <MicrophoneIcon className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold px-5 py-3 text-sm font-semibold text-surface-base shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sendet…' : 'Senden'}
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
