import { Chat, ChatMessage } from '../data/sampleChats';

export interface AgentConversationRecord {
  id: string;
  profile_id: string;
  agent_id: string;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_webhook_url: string | null;
  messages: ChatMessage[];
  summary: string | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentConversationUpdatePayload {
  messages?: ChatMessage[];
  summary?: string | null;
  lastMessageAt?: string | null;
  agentName?: string | null;
  agentDescription?: string | null;
  agentAvatarUrl?: string | null;
  agentWebhookUrl?: string | null;
}

const CONVERSATION_PREFIX = 'aiti-agent-conversations:';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const segments = Array.from({ length: 5 }, () => Math.random().toString(16).slice(2, 10));
  return `${segments[0]}-${segments[1].slice(0, 4)}-${segments[2].slice(0, 4)}-${segments[3].slice(0, 4)}-${segments[4]}${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 36);
};

const storageKey = (profileId: string) => `${CONVERSATION_PREFIX}${profileId}`;

const sanitizeMessages = (messages: unknown): ChatMessage[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const sanitized: ChatMessage[] = [];

  for (const entry of messages) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as Partial<ChatMessage> & { attachments?: unknown };

    if (
      typeof candidate.id === 'string' &&
      (candidate.author === 'agent' || candidate.author === 'user') &&
      typeof candidate.content === 'string' &&
      typeof candidate.timestamp === 'string'
    ) {
      sanitized.push({
        id: candidate.id,
        author: candidate.author,
        content: candidate.content,
        timestamp: candidate.timestamp,
        ...(Array.isArray(candidate.attachments) && candidate.attachments.length > 0
          ? {
              attachments: candidate.attachments.filter(
                (attachment): attachment is NonNullable<ChatMessage['attachments']>[number] =>
                  Boolean(attachment) && typeof attachment === 'object' && typeof (attachment as any).id === 'string'
              )
            }
          : {})
      });
    }
  }

  return sanitized;
};

const sanitizeRecord = (profileId: string, record: Partial<AgentConversationRecord>): AgentConversationRecord => {
  const baseId = typeof record.id === 'string' && record.id.length > 0 ? record.id : generateId();
  const agentId = typeof record.agent_id === 'string' && record.agent_id.length > 0 ? record.agent_id : baseId;

  return {
    id: baseId,
    profile_id: profileId,
    agent_id: agentId,
    agent_name: typeof record.agent_name === 'string' ? record.agent_name : null,
    agent_description: typeof record.agent_description === 'string' ? record.agent_description : null,
    agent_avatar_url: typeof record.agent_avatar_url === 'string' ? record.agent_avatar_url : null,
    agent_webhook_url: typeof record.agent_webhook_url === 'string' ? record.agent_webhook_url : null,
    messages: sanitizeMessages(record.messages),
    summary: typeof record.summary === 'string' ? record.summary : null,
    last_message_at: typeof record.last_message_at === 'string' ? record.last_message_at : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null
  };
};

const readRecords = (profileId: string): AgentConversationRecord[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(storageKey(profileId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<AgentConversationRecord>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((record) => sanitizeRecord(profileId, record));
  } catch (error) {
    console.error('Konversationen konnten nicht gelesen werden.', error);
    return [];
  }
};

const writeRecords = (profileId: string, records: AgentConversationRecord[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey(profileId), JSON.stringify(records));
};

export const fetchAgentConversations = async (
  profileId: string
): Promise<AgentConversationRecord[]> => {
  return readRecords(profileId);
};

export const upsertAgentConversation = async (
  profileId: string,
  agentId: string,
  updates: AgentConversationUpdatePayload
): Promise<AgentConversationRecord> => {
  const records = readRecords(profileId);
  const index = records.findIndex((record) => record.agent_id === agentId);
  const timestamp = new Date().toISOString();

  if (index === -1) {
    const record: AgentConversationRecord = {
      id: generateId(),
      profile_id: profileId,
      agent_id: agentId,
      agent_name: updates.agentName ?? null,
      agent_description: updates.agentDescription ?? null,
      agent_avatar_url: updates.agentAvatarUrl ?? null,
      agent_webhook_url: updates.agentWebhookUrl ?? null,
      messages: updates.messages ?? [],
      summary: updates.summary ?? null,
      last_message_at: updates.lastMessageAt ?? null,
      created_at: timestamp,
      updated_at: timestamp
    };

    const nextRecords = [...records, record];
    writeRecords(profileId, nextRecords);
    return record;
  }

  const current = records[index];
  const nextRecord: AgentConversationRecord = {
    ...current,
    messages: updates.messages ?? current.messages,
    summary: updates.summary ?? current.summary,
    last_message_at: updates.lastMessageAt ?? current.last_message_at,
    agent_name: updates.agentName ?? current.agent_name,
    agent_description: updates.agentDescription ?? current.agent_description,
    agent_avatar_url: updates.agentAvatarUrl ?? current.agent_avatar_url,
    agent_webhook_url: updates.agentWebhookUrl ?? current.agent_webhook_url,
    updated_at: timestamp
  };

  const nextRecords = [...records];
  nextRecords[index] = nextRecord;
  writeRecords(profileId, nextRecords);

  return nextRecord;
};

export const deleteAgentConversation = async (
  profileId: string,
  agentId: string
): Promise<void> => {
  const records = readRecords(profileId);
  const nextRecords = records.filter((record) => record.agent_id !== agentId);
  writeRecords(profileId, nextRecords);
};

const formatDisplayTime = (value: string | null | undefined) => {
  if (!value) {
    return new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toPreview = (value: string) => (value.length > 140 ? `${value.slice(0, 137)}…` : value);

export const mapConversationToChat = (
  record: AgentConversationRecord,
  fallbackName: string,
  fallbackPreview: string
): Chat => {
  const messages = record.messages.length > 0 ? record.messages : [];
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const summarySource = record.summary ?? lastMessage?.content ?? fallbackPreview;

  return {
    id: record.agent_id,
    name: record.agent_name ?? fallbackName,
    lastUpdated: formatDisplayTime(record.last_message_at ?? record.updated_at ?? record.created_at),
    preview: toPreview(summarySource),
    messages
  };
};
