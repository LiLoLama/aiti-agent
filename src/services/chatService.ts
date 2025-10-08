import supabase from '../utils/supabase';
import { Chat, ChatMessage } from '../data/sampleChats';
import { AgentProfile } from '../types/auth';

export interface AgentConversationRecord {
  id: string;
  profile_id: string;
  agent_id: string;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_webhook_url: string | null;
  agent_tools: string[];
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
  agentTools?: string[] | null;
}

type AgentConversationRow = {
  id: string;
  profile_id: string;
  agent_id: string;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_webhook_url: string | null;
  agent_tools: unknown;
  messages: unknown;
  summary: string | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const sanitizeTools = (tools: unknown): string[] => {
  if (!Array.isArray(tools)) {
    return [];
  }

  const normalized = tools
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
};

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
      isNonEmptyString(candidate.id) &&
      (candidate.author === 'agent' || candidate.author === 'user') &&
      typeof candidate.content === 'string' &&
      typeof candidate.timestamp === 'string'
    ) {
      const attachments = Array.isArray(candidate.attachments)
        ? candidate.attachments.filter(
            (attachment): attachment is NonNullable<ChatMessage['attachments']>[number] =>
              Boolean(attachment) && typeof attachment === 'object' && isNonEmptyString((attachment as any).id)
          )
        : undefined;

      sanitized.push({
        id: candidate.id,
        author: candidate.author,
        content: candidate.content,
        timestamp: candidate.timestamp,
        ...(attachments && attachments.length > 0 ? { attachments } : {})
      });
    }
  }

  return sanitized;
};

const sanitizeRecord = (record: AgentConversationRow): AgentConversationRecord => ({
  id: record.id,
  profile_id: record.profile_id,
  agent_id: record.agent_id,
  agent_name: record.agent_name,
  agent_description: record.agent_description,
  agent_avatar_url: record.agent_avatar_url,
  agent_webhook_url: record.agent_webhook_url,
  agent_tools: sanitizeTools(record.agent_tools),
  messages: sanitizeMessages(record.messages),
  summary: record.summary,
  last_message_at: record.last_message_at,
  created_at: record.created_at,
  updated_at: record.updated_at
});

const mapRowToRecord = (row: AgentConversationRow | null | undefined): AgentConversationRecord => {
  if (!row) {
    throw new Error('Konversation konnte nicht geladen werden.');
  }

  return sanitizeRecord(row);
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

export const fetchAgentConversations = async (
  profileId: string
): Promise<AgentConversationRecord[]> => {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select(
      'id, profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_webhook_url, agent_tools, messages, summary, last_message_at, created_at, updated_at'
    )
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message ?? 'Konversationen konnten nicht geladen werden.');
  }

  return (data ?? []).map((row) => sanitizeRecord(row as AgentConversationRow));
};

export const upsertAgentConversation = async (
  profileId: string,
  agentId: string,
  updates: AgentConversationUpdatePayload
): Promise<AgentConversationRecord> => {
  const payload: Record<string, unknown> = {
    profile_id: profileId,
    agent_id: agentId,
    updated_at: new Date().toISOString()
  };

  if (updates.messages !== undefined) {
    payload.messages = updates.messages;
  }
  if (updates.summary !== undefined) {
    payload.summary = updates.summary;
  }
  if (updates.lastMessageAt !== undefined) {
    payload.last_message_at = updates.lastMessageAt;
  }
  if (updates.agentName !== undefined) {
    payload.agent_name = updates.agentName;
  }
  if (updates.agentDescription !== undefined) {
    payload.agent_description = updates.agentDescription;
  }
  if (updates.agentAvatarUrl !== undefined) {
    payload.agent_avatar_url = updates.agentAvatarUrl;
  }
  if (updates.agentWebhookUrl !== undefined) {
    payload.agent_webhook_url = updates.agentWebhookUrl;
  }
  if (updates.agentTools !== undefined) {
    payload.agent_tools = sanitizeTools(updates.agentTools);
  }

  const { data, error } = await supabase
    .from('agent_conversations')
    .upsert(payload, { onConflict: 'profile_id,agent_id' })
    .select(
      'id, profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_webhook_url, agent_tools, messages, summary, last_message_at, created_at, updated_at'
    );

  if (error) {
    throw new Error(error.message ?? 'Konversation konnte nicht gespeichert werden.');
  }

  const row = Array.isArray(data) ? (data[0] as AgentConversationRow | undefined) : (data as AgentConversationRow | null);

  if (row) {
    return mapRowToRecord(row);
  }

  const { data: fetched, error: fetchError } = await supabase
    .from('agent_conversations')
    .select(
      'id, profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_webhook_url, agent_tools, messages, summary, last_message_at, created_at, updated_at'
    )
    .eq('profile_id', profileId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message ?? 'Konversation konnte nicht geladen werden.');
  }

  return mapRowToRecord(fetched as AgentConversationRow | null);
};

export const deleteAgentConversation = async (
  profileId: string,
  agentId: string
): Promise<void> => {
  const { error } = await supabase
    .from('agent_conversations')
    .delete()
    .eq('profile_id', profileId)
    .eq('agent_id', agentId);

  if (error) {
    throw new Error(error.message ?? 'Konversation konnte nicht gelöscht werden.');
  }
};

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

export const mapConversationToAgentProfile = (
  record: AgentConversationRecord,
  fallbackName: string
): AgentProfile => ({
  id: record.agent_id,
  name: record.agent_name ?? fallbackName,
  description: record.agent_description ?? '',
  avatarUrl: record.agent_avatar_url ?? null,
  tools: record.agent_tools ?? [],
  webhookUrl: record.agent_webhook_url ?? ''
});
