import { ChatMessage } from '../data/sampleChats';
import { AgentSettings } from '../types/settings';

export interface WebhookSubmissionPayload {
  chatId: string;
  message: string;
  messageId: string;
  history: ChatMessage[];
  attachments: File[];
  audio?: {
    blob: Blob;
    durationSeconds?: number;
  };
}

export interface WebhookResponse {
  message: string;
  rawResponse: unknown;
}

function buildAuthHeaders(settings: AgentSettings): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (settings.authType) {
    case 'apiKey':
      if (settings.apiKey) {
        headers['x-api-key'] = settings.apiKey;
      }
      break;
    case 'basic':
      if (settings.basicAuthUsername || settings.basicAuthPassword) {
        const credentials = `${settings.basicAuthUsername ?? ''}:${settings.basicAuthPassword ?? ''}`;
        headers['Authorization'] = `Basic ${btoa(credentials)}`;
      }
      break;
    case 'oauth':
      if (settings.oauthToken) {
        headers['Authorization'] = `Bearer ${settings.oauthToken}`;
      }
      break;
    default:
      break;
  }

  return headers;
}

export interface WebhookRequestOptions {
  /**
   * Zeit in Millisekunden, wie lange auf eine Antwort des Webhooks gewartet werden soll,
   * bevor der Request abgebrochen wird.
   */
  responseTimeoutMs?: number;
}

export async function sendWebhookMessage(
  settings: AgentSettings,
  payload: WebhookSubmissionPayload,
  options: WebhookRequestOptions = {}
): Promise<WebhookResponse> {
  if (!settings.webhookUrl) {
    throw new Error('Kein Webhook konfiguriert. Hinterlege die URL in den Einstellungen.');
  }

  const formData = new FormData();
  formData.append('chatId', payload.chatId);
  formData.append('messageId', payload.messageId);
  formData.append('message', payload.message);
  formData.append('history', JSON.stringify(payload.history));

  payload.attachments.forEach((file, index) => {
    formData.append(`attachment_${index + 1}`, file, file.name);
  });

  if (payload.audio) {
    formData.append('audio', payload.audio.blob, `audio-message-${Date.now()}.webm`);
    if (typeof payload.audio.durationSeconds === 'number') {
      formData.append('audioDurationSeconds', String(payload.audio.durationSeconds));
    }
  }

  const headers = buildAuthHeaders(settings);
  const { responseTimeoutMs = 60000 } = options;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), responseTimeoutMs);

  try {
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      body: formData,
      headers,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      const errorMessage = isJson ? JSON.stringify(await response.json()) : await response.text();
      throw new Error(`Webhook Fehler (${response.status}): ${errorMessage}`);
    }

    let parsedResponse: unknown;
    let messageText = '';

    if (isJson) {
      parsedResponse = await response.json();
      if (settings.responseFormat === 'json') {
        messageText = JSON.stringify(parsedResponse, null, 2);
      } else if (parsedResponse && typeof parsedResponse === 'object' && 'message' in parsedResponse) {
        messageText = String((parsedResponse as Record<string, unknown>).message ?? '');
      } else {
        messageText = JSON.stringify(parsedResponse, null, 2);
      }
    } else {
      messageText = await response.text();
      parsedResponse = messageText;
    }

    messageText = messageText.trim();

    if (!messageText) {
      messageText = 'Der Webhook hat keine Nachricht zurückgeliefert.';
    }

    return {
      message: messageText,
      rawResponse: parsedResponse
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Die Verbindung zum Webhook hat zu lange gedauert. Bitte versuche es erneut.');
    }

    throw error instanceof Error
      ? error
      : new Error('Unbekannter Fehler beim Aufruf des Webhooks.');
  } finally {
    window.clearTimeout(timeout);
  }
}
