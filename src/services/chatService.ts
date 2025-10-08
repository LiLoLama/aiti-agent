import { Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';
import type { AgentProfile } from '../types/auth';
import { sanitizeAgentProfile } from '../utils/agents';

export interface AgentConversationRow {
  id: string;
  profile_id: string;
  agent_id: string | null;
  title?: string | null;
  messages?: ChatMessage[];
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

const STORAGE_KEY = 'aiti-agent-conversations-v1';

const readStore = (): AgentConversationRow[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as AgentConversationRow[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    console.warn('Konversationen konnten nicht geladen werden.', error);
    return [];
  }
};

const writeStore = (rows: AgentConversationRow[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch (error) {
    console.warn('Konversationen konnten nicht gespeichert werden.', error);
  }
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

const storeRows = (updater: (rows: AgentConversationRow[]) => AgentConversationRow[]) => {
  const nextRows = updater(readStore());
  writeStore(nextRows);
};

export const fetchChatsForProfile = async (profileId: string): Promise<AgentConversationRow[]> => {
  const rows = readStore().filter((row) => row.profile_id === profileId);

  return rows.sort((a, b) => {
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

export const createChatForProfile = async (
  profileId: string,
  chat: Chat,
  agent?: AgentProfile
) => {
  const sanitizedAgent = agent ? sanitizeAgentProfile(agent) : undefined;
  const now = new Date().toISOString();

  storeRows((rows) => {
    const existingIndex = rows.findIndex(
      (row) => row.profile_id === profileId && row.agent_id === chat.agentId
    );

    const baseRow: AgentConversationRow = {
      id: chat.id,
      profile_id: profileId,
      agent_id: chat.agentId,
      title: chat.name,
      messages: chat.messages,
      summary: chat.preview,
      last_message_at: now,
      created_at: existingIndex >= 0 ? rows[existingIndex].created_at ?? now : now,
      updated_at: now,
      agent_name: sanitizedAgent?.name ?? chat.name,
      agent_description: sanitizedAgent?.description ?? null,
      agent_avatar_url: sanitizedAgent?.avatarUrl ?? null,
      agent_tools: sanitizedAgent?.tools ?? [],
      agent_webhook_url: sanitizedAgent?.webhookUrl ?? null
    };

    if (existingIndex >= 0) {
      const nextRows = [...rows];
      nextRows[existingIndex] = {
        ...rows[existingIndex],
        ...baseRow
      };
      return nextRows;
    }

    return [...rows, baseRow];
  });
};

export const updateChatRow = async (chatId: string, updates: AgentConversationUpdatePayload) => {
  const now = new Date().toISOString();

  storeRows((rows) =>
    rows.map((row) => {
      if (row.id !== chatId) {
        return row;
      }

      return {
        ...row,
        ...(typeof updates.title === 'string' ? { title: updates.title } : {}),
        ...(updates.messages ? { messages: updates.messages } : {}),
        ...(typeof updates.summary === 'string' ? { summary: updates.summary } : {}),
        ...(typeof updates.lastMessageAt === 'string'
          ? { last_message_at: updates.lastMessageAt, updated_at: updates.lastMessageAt }
          : { updated_at: now })
      };
    })
  );
};

export const mapRowToAgentProfile = (row: AgentConversationRow): AgentProfile | null => {
  const agentId = typeof row.agent_id === 'string' ? row.agent_id : null;
  if (!agentId) {
    return null;
  }

  return sanitizeAgentProfile({
    id: agentId,
    name: (row.agent_name ?? row.title ?? 'AITI Agent').trim(),
    description: row.agent_description ?? '',
    avatarUrl: row.agent_avatar_url ?? null,
    tools: Array.isArray(row.agent_tools) ? row.agent_tools : [],
    webhookUrl: row.agent_webhook_url ?? ''
  });
};

export const fetchAgentProfilesForProfile = async (profileId: string): Promise<AgentProfile[]> => {
  const rows = readStore().filter((row) => row.profile_id === profileId);
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

  const rows = readStore().filter((row) => profileIds.includes(row.profile_id));
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
  const now = new Date().toISOString();
  let createdId = sanitized.id;

  storeRows((rows) => {
    const nextRows = [...rows];
    const existingIndex = nextRows.findIndex(
      (row) => row.profile_id === profileId && row.agent_id === sanitized.id
    );

    if (existingIndex >= 0) {
      nextRows[existingIndex] = {
        ...nextRows[existingIndex],
        agent_name: sanitized.name,
        agent_description: sanitized.description,
        agent_avatar_url: sanitized.avatarUrl ?? null,
        agent_tools: sanitized.tools,
        agent_webhook_url: sanitized.webhookUrl,
        title: sanitized.name,
        updated_at: now
      };
      createdId = nextRows[existingIndex].id;
      return nextRows;
    }

    const newRow: AgentConversationRow = {
      id: sanitized.id,
      profile_id: profileId,
      agent_id: sanitized.id,
      agent_name: sanitized.name,
      agent_description: sanitized.description,
      agent_avatar_url: sanitized.avatarUrl ?? null,
      agent_tools: sanitized.tools,
      agent_webhook_url: sanitized.webhookUrl,
      title: sanitized.name,
      summary: null,
      messages: [],
      created_at: now,
      updated_at: now,
      last_message_at: null
    };

    nextRows.push(newRow);
    return nextRows;
  });

  return createdId;
};

export const deleteAgentForProfile = async (profileId: string, agentId: string) => {
  storeRows((rows) => rows.filter((row) => !(row.profile_id === profileId && row.agent_id === agentId)));
};
