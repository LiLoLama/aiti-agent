import { supabase } from './supabaseClient';
import { Chat, ChatMessage } from '../data/sampleChats';

export interface AgentConversationRecord {
  id: string;
  profile_id: string;
  agent_id: string;
  title: string | null;
  summary: string | null;
  messages: ChatMessage[];
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_tools: string[];
  agent_webhook_url: string | null;
}

export interface AgentConversationUpdatePayload {
  messages?: ChatMessage[];
  summary?: string | null;
  lastMessageAt?: string | null;
  agentName?: string | null;
  agentDescription?: string | null;
  agentAvatarUrl?: string | null;
  agentWebhookUrl?: string | null;
  agentTools?: string[];
}

type AgentConversationRow = {
  id: string;
  profile_id: string;
  agent_id: string;
  title: string | null;
  summary: string | null;
  messages: unknown;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_tools: unknown;
  agent_webhook_url: string | null;
};

const createUuid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}-${Math.random()
        .toString(16)
        .slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 14)}`;

const sanitizeTools = (tools: unknown): string[] => {
  if (!Array.isArray(tools)) {
    return [];
  }

  const sanitized = tools
    .filter((tool): tool is string => typeof tool === 'string' && tool.trim().length > 0)
    .map((tool) => tool.trim());

  return Array.from(new Set(sanitized));
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

const sanitizeRecord = (row: AgentConversationRow): AgentConversationRecord => ({
  id: row.id,
  profile_id: row.profile_id,
  agent_id: row.agent_id,
  title: row.title,
  summary: typeof row.summary === 'string' ? row.summary : null,
  messages: sanitizeMessages(row.messages),
  last_message_at: row.last_message_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
  agent_name: typeof row.agent_name === 'string' ? row.agent_name : null,
  agent_description: typeof row.agent_description === 'string' ? row.agent_description : null,
  agent_avatar_url: typeof row.agent_avatar_url === 'string' ? row.agent_avatar_url : null,
  agent_tools: sanitizeTools(row.agent_tools),
  agent_webhook_url: typeof row.agent_webhook_url === 'string' ? row.agent_webhook_url : null
});

export const fetchAgentConversations = async (
  profileId: string
): Promise<AgentConversationRecord[]> => {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message ?? 'Konversationen konnten nicht geladen werden.');
  }

  return (data ?? []).map((row) => sanitizeRecord(row));
};

export const upsertAgentConversation = async (
  profileId: string,
  agentId: string,
  updates: AgentConversationUpdatePayload
): Promise<AgentConversationRecord> => {
  const timestamp = new Date().toISOString();
  const sanitizedMessages = updates.messages ? sanitizeMessages(updates.messages) : undefined;
  const sanitizedTools = updates.agentTools ? sanitizeTools(updates.agentTools) : undefined;

  const { data: existing, error: existingError, status } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('profile_id', profileId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (existingError && status !== 406) {
    throw new Error(existingError.message ?? 'Konversation konnte nicht geladen werden.');
  }

  if (!existing) {
    const insertPayload = {
      id: createUuid(),
      profile_id: profileId,
      agent_id: agentId,
      agent_name: updates.agentName ?? null,
      agent_description: updates.agentDescription ?? null,
      agent_avatar_url: updates.agentAvatarUrl ?? null,
      agent_webhook_url: updates.agentWebhookUrl ?? null,
      agent_tools: sanitizedTools ?? [],
      messages: sanitizedMessages ?? [],
      summary: updates.summary ?? null,
      last_message_at: updates.lastMessageAt ?? null,
      title: updates.agentName ?? null,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { data, error } = await supabase
      .from('agent_conversations')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message ?? 'Konversation konnte nicht angelegt werden.');
    }

    return sanitizeRecord(data);
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: timestamp
  };

  if (sanitizedMessages) {
    updatePayload.messages = sanitizedMessages;
  }

  if (updates.summary !== undefined) {
    updatePayload.summary = updates.summary;
  }

  if (updates.lastMessageAt !== undefined) {
    updatePayload.last_message_at = updates.lastMessageAt;
  }

  if (updates.agentName !== undefined) {
    updatePayload.agent_name = updates.agentName;
    updatePayload.title = updates.agentName;
  }

  if (updates.agentDescription !== undefined) {
    updatePayload.agent_description = updates.agentDescription;
  }

  if (updates.agentAvatarUrl !== undefined) {
    updatePayload.agent_avatar_url = updates.agentAvatarUrl;
  }

  if (updates.agentWebhookUrl !== undefined) {
    updatePayload.agent_webhook_url = updates.agentWebhookUrl;
  }

  if (sanitizedTools) {
    updatePayload.agent_tools = sanitizedTools;
  }

  const { data, error } = await supabase
    .from('agent_conversations')
    .update(updatePayload)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message ?? 'Konversation konnte nicht aktualisiert werden.');
  }

  return sanitizeRecord(data);
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
