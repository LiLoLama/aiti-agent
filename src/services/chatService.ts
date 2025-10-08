import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { Chat, ChatMessage, ChatAttachment } from '../data/sampleChats';
import type { AgentProfile } from '../types/auth';
import { sanitizeAgentProfile } from '../utils/agents';

const TABLE_NAME = 'agent_conversations';

export interface AgentConversationRow {
  id: string;
  profile_id: string;
  agent_id: string | null;
  title?: string | null;
  messages?: unknown;
  summary?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  agent_name?: string | null;
  agent_description?: string | null;
  agent_avatar_url?: string | null;
  agent_tools?: unknown;
  agent_webhook_url?: string | null;
}

export interface AgentConversationUpdatePayload {
  title?: string;
  messages?: ChatMessage[];
  summary?: string | null;
  lastMessageAt?: string | null;
}

const parseMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: ChatMessage[] = [];

  for (const entry of value) {
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
      const attachments = Array.isArray(candidate.attachments)
        ? candidate.attachments.filter(
            (attachment): attachment is ChatAttachment =>
              Boolean(attachment) && typeof attachment === 'object' && typeof (attachment as any).id === 'string'
          )
        : undefined;

      messages.push({
        id: candidate.id,
        author: candidate.author,
        content: candidate.content,
        timestamp: candidate.timestamp,
        ...(attachments && attachments.length > 0 ? { attachments } : {})
      });
    }
  }

  return messages;
};

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

const parseAgentTools = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

export const mapRowToAgentProfile = (row: AgentConversationRow): AgentProfile | null => {
  const agentId = typeof row.agent_id === 'string' ? row.agent_id : null;

  if (!agentId) {
    return null;
  }

  const sanitized = sanitizeAgentProfile({
    id: agentId,
    name: (row.agent_name ?? row.title ?? 'AITI Agent').trim(),
    description: row.agent_description ?? '',
    avatarUrl: row.agent_avatar_url ?? null,
    tools: parseAgentTools(row.agent_tools),
    webhookUrl: row.agent_webhook_url ?? ''
  });

  return sanitized;
};

export const fetchChatsForProfile = async (profileId: string): Promise<AgentConversationRow[]> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('profile_id', profileId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<AgentConversationRow & Record<string, unknown>>;

  const normalizeTimestamp = (value: unknown): string | null => {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const coerced = new Date(value as any);
    const time = coerced.getTime();
    return Number.isNaN(time) ? null : coerced.toISOString();
  };

  return rows
    .map((row) => ({
      ...row,
      last_message_at: normalizeTimestamp(row.last_message_at),
      updated_at: normalizeTimestamp(row.updated_at),
      created_at: normalizeTimestamp(row.created_at)
    }))
    .sort((a, b) => {
      const aTime = a.last_message_at ?? a.updated_at ?? a.created_at;
      const bTime = b.last_message_at ?? b.updated_at ?? b.created_at;

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

const buildChatInsertPayload = (profileId: string, chat: Chat) => {
  const nowIso = new Date().toISOString();
  return {
    id: chat.id,
    profile_id: profileId,
    title: chat.name,
    messages: chat.messages,
    summary: chat.preview,
    last_message_at: nowIso,
    agent_id: chat.agentId
  };
};

const isMissingColumnError = (error: PostgrestError, column: string) =>
  error.message.toLowerCase().includes(`column "${column.toLowerCase()}`);

const buildAgentMetadataPayload = (agent?: AgentProfile) => {
  if (!agent) {
    return {} as Record<string, unknown>;
  }

  const sanitized = sanitizeAgentProfile(agent);

  return {
    agent_name: sanitized.name,
    agent_description: sanitized.description,
    agent_avatar_url: sanitized.avatarUrl,
    agent_tools: sanitized.tools,
    agent_webhook_url: sanitized.webhookUrl
  } as Record<string, unknown>;
};

export const createChatForProfile = async (
  profileId: string,
  chat: Chat,
  agent?: AgentProfile
) => {
  const payload = {
    ...buildChatInsertPayload(profileId, chat),
    ...buildAgentMetadataPayload(agent)
  };
  const attemptInsert = async (data: Record<string, unknown>) => {
    const { error } = await supabase.from(TABLE_NAME).insert(data);
    return error;
  };

  let currentPayload: Record<string, unknown> = { ...payload };
  let error = await attemptInsert(currentPayload);
  const handled = new Set<string>();

  while (error) {
    if (error.code === '23505') {
      const { id: _unusedId, profile_id: _unusedProfile, ...rest } = currentPayload;
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update(rest)
        .eq('profile_id', profileId)
        .eq('agent_id', chat.agentId);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    if (!handled.has('title') && 'title' in currentPayload && isMissingColumnError(error, 'title')) {
      handled.add('title');
      const { title: _unusedTitle, ...rest } = currentPayload;
      currentPayload = {
        ...rest,
        name: chat.name
      };
    } else if (!handled.has('summary') && 'summary' in currentPayload && isMissingColumnError(error, 'summary')) {
      handled.add('summary');
      const { summary: _unusedSummary, ...rest } = currentPayload;
      currentPayload = rest;
    } else if (
      !handled.has('last_message_at') &&
      'last_message_at' in currentPayload &&
      isMissingColumnError(error, 'last_message_at')
    ) {
      handled.add('last_message_at');
      const { last_message_at: _unusedTimestamp, ...rest } = currentPayload;
      currentPayload = rest;
    } else if (!handled.has('agent_id') && 'agent_id' in currentPayload && isMissingColumnError(error, 'agent_id')) {
      handled.add('agent_id');
      const { agent_id: _unusedAgent, ...rest } = currentPayload;
      currentPayload = rest;
    } else {
      throw error;
    }

    if (Object.keys(currentPayload).length === 0) {
      return;
    }

    error = await attemptInsert(currentPayload);
  }
};

export const updateChatRow = async (chatId: string, updates: AgentConversationUpdatePayload) => {
  const payload: Record<string, unknown> = {};

  if (typeof updates.title === 'string') {
    payload.title = updates.title;
  }

  if (updates.messages) {
    payload.messages = updates.messages;
  }

  if (typeof updates.summary === 'string') {
    payload.summary = updates.summary;
  }

  if (typeof updates.lastMessageAt === 'string') {
    payload.last_message_at = updates.lastMessageAt;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const attemptUpdate = async (data: Record<string, unknown>) => {
    const { error } = await supabase.from(TABLE_NAME).update(data).eq('id', chatId);
    return error;
  };

  let currentPayload: Record<string, unknown> = { ...payload };
  let error = await attemptUpdate(currentPayload);
  const handled = new Set<string>();

  while (error) {
    if (!handled.has('title') && 'title' in currentPayload && isMissingColumnError(error, 'title')) {
      handled.add('title');
      const { title: _unusedTitle, ...rest } = currentPayload;
      currentPayload = {
        ...rest,
        name: updates.title
      };
    } else if (!handled.has('summary') && 'summary' in currentPayload && isMissingColumnError(error, 'summary')) {
      handled.add('summary');
      const { summary: _unusedSummary, ...rest } = currentPayload;
      currentPayload = rest;
    } else if (
      !handled.has('last_message_at') &&
      'last_message_at' in currentPayload &&
      isMissingColumnError(error, 'last_message_at')
    ) {
      handled.add('last_message_at');
      const { last_message_at: _unusedTimestamp, ...rest } = currentPayload;
      currentPayload = rest;
    } else if (
      !handled.has('agent_id') &&
      'agent_id' in currentPayload &&
      isMissingColumnError(error, 'agent_id')
    ) {
      handled.add('agent_id');
      const { agent_id: _unusedAgent, ...rest } = currentPayload;
      currentPayload = rest;
    } else if (!handled.has('messages') && 'messages' in currentPayload && isMissingColumnError(error, 'messages')) {
      handled.add('messages');
      const { messages: _unusedMessages, ...rest } = currentPayload;
      currentPayload = rest;
    } else {
      throw error;
    }

    if (Object.keys(currentPayload).length === 0) {
      return;
    }

    error = await attemptUpdate(currentPayload);
  }
};

export const fetchAgentProfilesForProfile = async (profileId: string): Promise<AgentProfile[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_tools, agent_webhook_url, title'
    )
    .eq('profile_id', profileId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AgentConversationRow[];
  const seen = new Set<string>();
  const agents: AgentProfile[] = [];

  for (const row of rows) {
    const mapped = mapRowToAgentProfile(row);
    if (mapped && !seen.has(mapped.id)) {
      seen.add(mapped.id);
      agents.push(mapped);
    }
  }

  return agents;
};

export const fetchAgentProfilesForProfiles = async (
  profileIds: string[]
): Promise<Record<string, AgentProfile[]>> => {
  if (profileIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_tools, agent_webhook_url, title'
    )
    .in('profile_id', profileIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AgentConversationRow[];
  const result: Record<string, AgentProfile[]> = {};

  for (const row of rows) {
    const mapped = mapRowToAgentProfile(row);
    if (!mapped) {
      continue;
    }

    if (!result[row.profile_id]) {
      result[row.profile_id] = [];
    }

    if (!result[row.profile_id].some((agent) => agent.id === mapped.id)) {
      result[row.profile_id].push(mapped);
    }
  }

  return result;
};

export const saveAgentMetadataForProfile = async (profileId: string, agent: AgentProfile) => {
  const sanitized = sanitizeAgentProfile(agent);

  const basePayload = {
    agent_name: sanitized.name,
    agent_description: sanitized.description,
    agent_avatar_url: sanitized.avatarUrl,
    agent_tools: sanitized.tools,
    agent_webhook_url: sanitized.webhookUrl,
    title: sanitized.name,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: existingError } = await supabase
    .from(TABLE_NAME)
    .select('id')
    .eq('profile_id', profileId)
    .eq('agent_id', sanitized.id)
    .maybeSingle<{ id: string }>();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase.from(TABLE_NAME).update(basePayload).eq('id', existing.id);
    if (error) {
      throw error;
    }
    return existing.id;
  }

  const nowIso = new Date().toISOString();
  const insertPayload = {
    id: sanitized.id,
    profile_id: profileId,
    agent_id: sanitized.id,
    ...basePayload,
    created_at: nowIso,
    last_message_at: null,
    summary: null,
    messages: [] as ChatMessage[]
  };

  const { error } = await supabase.from(TABLE_NAME).insert(insertPayload);

  if (error) {
    throw error;
  }

  return insertPayload.id;
};

export const deleteAgentForProfile = async (profileId: string, agentId: string) => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('profile_id', profileId)
    .eq('agent_id', agentId);

  if (error) {
    throw error;
  }
};
