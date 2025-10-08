import { supabase } from '../utils/supabase';
import { Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';
import type { AgentProfile } from '../types/auth';
import { sanitizeAgentProfile } from '../utils/agents';

export interface AgentConversationRow {
  id: string;
  profile_id: string;
  agent_id: string | null;
  title?: string | null;
  messages?: ChatMessage[] | null;
  summary?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  agent_name?: string | null;
  agent_description?: string | null;
  agent_avatar_url?: string | null;
  agent_tools?: string[] | null;
  agent_webhook_url?: string | null;
}

export interface AgentConversationUpdatePayload {
  title?: string;
  messages?: ChatMessage[];
  summary?: string | null;
  lastMessageAt?: string | null;
}

const CONVERSATION_COLUMNS =
  'id, profile_id, agent_id, title, summary, messages, last_message_at, created_at, updated_at, agent_name, agent_description, agent_avatar_url, agent_tools, agent_webhook_url';

const AGENT_METADATA_COLUMNS =
  'id, profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_tools, agent_webhook_url, title';

const toPreview = (value: string) => (value.length > 140 ? `${value.slice(0, 137)}…` : value);

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

const parseMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Partial<ChatMessage> & { attachments?: unknown };
      if (
        typeof candidate.id === 'string' &&
        (candidate.author === 'agent' || candidate.author === 'user') &&
        typeof candidate.content === 'string' &&
        typeof candidate.timestamp === 'string'
      ) {
        let attachments: ChatAttachment[] | undefined;
        if (Array.isArray(candidate.attachments)) {
          attachments = candidate.attachments.filter(
            (attachment): attachment is ChatAttachment =>
              Boolean(attachment) &&
              typeof attachment === 'object' &&
              typeof (attachment as ChatAttachment).id === 'string'
          );
        }

        return {
          id: candidate.id,
          author: candidate.author,
          content: candidate.content,
          timestamp: candidate.timestamp,
          ...(attachments && attachments.length > 0 ? { attachments } : {})
        } satisfies ChatMessage;
      }

      return null;
    })
    .filter((message): message is ChatMessage => Boolean(message));
};

const normalizeAgentTools = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tool) => (typeof tool === 'string' ? tool.trim() : ''))
    .filter((tool) => tool.length > 0);
};

export const mapChatRowToChat = (row: AgentConversationRow): Chat => {
  const title = (row.title ?? row.agent_name ?? 'Neuer Chat').trim();
  const messages = parseMessages(row.messages);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const previewSource = row.summary ?? lastMessage?.content ?? '';
  const lastTimestamp = row.last_message_at ?? row.updated_at ?? row.created_at ?? new Date().toISOString();
  const agentId = typeof row.agent_id === 'string' ? row.agent_id : '';

  return {
    id: row.id,
    agentId,
    name: title.length > 0 ? title : 'Neuer Chat',
    messages,
    preview: toPreview(previewSource),
    lastUpdated: formatDisplayTime(lastTimestamp)
  };
};

export const mapConversationRowToAgentProfile = (row: AgentConversationRow): AgentProfile => ({
  id: row.agent_id ?? row.id,
  name: (row.agent_name ?? row.title ?? 'Neuer Agent').trim() || 'Neuer Agent',
  description: (row.agent_description ?? '').trim(),
  avatarUrl: row.agent_avatar_url ?? null,
  tools: normalizeAgentTools(row.agent_tools),
  webhookUrl: (row.agent_webhook_url ?? '').trim()
});

const sortConversationRows = (rows: AgentConversationRow[]) => {
  return [...rows].sort((a, b) => {
    const aTime = a.last_message_at ?? a.updated_at ?? a.created_at ?? '';
    const bTime = b.last_message_at ?? b.updated_at ?? b.created_at ?? '';

    if (!aTime && !bTime) {
      return 0;
    }

    if (!aTime) {
      return 1;
    }

    if (!bTime) {
      return -1;
    }

    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
};

export const fetchChatsForProfile = async (profileId: string): Promise<AgentConversationRow[]> => {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('profile_id', profileId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return sortConversationRows((data as AgentConversationRow[]) ?? []);
};

export const fetchAgentMetadataForProfile = async (profileId: string): Promise<AgentProfile[]> => {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select(AGENT_METADATA_COLUMNS)
    .eq('profile_id', profileId);

  if (error) {
    throw error;
  }

  return ((data as AgentConversationRow[]) ?? []).map((row) => mapConversationRowToAgentProfile(row));
};

export const fetchAgentMetadataForProfiles = async (
  profileIds: string[]
): Promise<Map<string, AgentProfile[]>> => {
  const map = new Map<string, AgentProfile[]>();
  if (profileIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('agent_conversations')
    .select(AGENT_METADATA_COLUMNS)
    .in('profile_id', profileIds);

  if (error) {
    throw error;
  }

  for (const row of (data as AgentConversationRow[]) ?? []) {
    const profileId = row.profile_id;
    if (!profileId) {
      continue;
    }

    const current = map.get(profileId) ?? [];
    current.push(mapConversationRowToAgentProfile(row));
    map.set(profileId, current);
  }

  return map;
};

export const createChatForProfile = async (
  profileId: string,
  chat: Chat,
  agent?: AgentProfile
) => {
  const sanitizedAgent = agent ? sanitizeAgentProfile(agent) : undefined;
  const now = new Date().toISOString();

  const payload = {
    id: chat.id,
    profile_id: profileId,
    agent_id: chat.agentId || sanitizedAgent?.id || chat.id,
    title: chat.name,
    summary: chat.preview,
    messages: chat.messages,
    last_message_at: now,
    agent_name: sanitizedAgent?.name ?? chat.name,
    agent_description: sanitizedAgent?.description ?? '',
    agent_avatar_url: sanitizedAgent?.avatarUrl ?? null,
    agent_tools: sanitizedAgent?.tools ?? [],
    agent_webhook_url: sanitizedAgent?.webhookUrl ?? null,
    updated_at: now
  };

  const { error } = await supabase
    .from('agent_conversations')
    .upsert(payload, { onConflict: 'profile_id,agent_id' });

  if (error) {
    throw error;
  }
};

export const updateChatRow = async (id: string, payload: AgentConversationUpdatePayload) => {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof payload.title === 'string') {
    updates.title = payload.title;
  }

  if (payload.messages) {
    updates.messages = payload.messages;
  }

  if (payload.summary !== undefined) {
    updates.summary = payload.summary;
  }

  if (payload.lastMessageAt) {
    updates.last_message_at = payload.lastMessageAt;
  }

  const { error } = await supabase.from('agent_conversations').update(updates).eq('id', id);

  if (error) {
    throw error;
  }
};

export const saveAgentMetadataForProfile = async (profileId: string, agent: AgentProfile) => {
  const sanitized = sanitizeAgentProfile(agent);
  const payload = {
    id: sanitized.id,
    profile_id: profileId,
    agent_id: sanitized.id,
    agent_name: sanitized.name,
    agent_description: sanitized.description,
    agent_avatar_url: sanitized.avatarUrl,
    agent_tools: sanitized.tools,
    agent_webhook_url: sanitized.webhookUrl,
    title: sanitized.name,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('agent_conversations')
    .upsert(payload, { onConflict: 'profile_id,agent_id' });

  if (error) {
    throw error;
  }
};

export const deleteAgentForProfile = async (profileId: string, agentId: string) => {
  const { error } = await supabase
    .from('agent_conversations')
    .delete()
    .eq('profile_id', profileId)
    .eq('agent_id', agentId);

  if (error) {
    throw error;
  }
};
