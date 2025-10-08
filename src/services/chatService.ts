import { Chat, ChatAttachment, ChatMessage } from '../data/sampleChats';

export interface FolderRecord {
  id: string;
  profile_id: string;
  name: string;
  created_at: string | null;
  updated_at?: string | null;
}

export interface ChatRow {
  id: string;
  profile_id: string;
  title?: string | null;
  name?: string | null;
  folder_id?: string | null;
  messages?: ChatMessage[];
  summary?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChatUpdatePayload {
  title?: string;
  folderId?: string | null;
  messages?: ChatMessage[];
  summary?: string | null;
  lastMessageAt?: string | null;
}

const CHATS_PREFIX = 'aiti-agent-chats:';
const FOLDERS_PREFIX = 'aiti-agent-folders:';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const segments = Array.from({ length: 5 }, () => Math.random().toString(16).slice(2, 10));
  return `${segments[0]}-${segments[1].slice(0, 4)}-${segments[2].slice(0, 4)}-${segments[3].slice(0, 4)}-${segments[4]}${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 36);
};

const chatsKey = (profileId: string) => `${CHATS_PREFIX}${profileId}`;
const foldersKey = (profileId: string) => `${FOLDERS_PREFIX}${profileId}`;

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

const loadFolders = (profileId: string): FolderRecord[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(foldersKey(profileId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<FolderRecord>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((folder) => {
        const id = typeof folder.id === 'string' ? folder.id : generateId();
        const name = typeof folder.name === 'string' && folder.name.trim().length > 0 ? folder.name.trim() : 'Ordner';

        return {
          id,
          profile_id: profileId,
          name,
          created_at: typeof folder.created_at === 'string' ? folder.created_at : null,
          updated_at: typeof folder.updated_at === 'string' ? folder.updated_at : null
        };
      })
      .filter((folder) => folder.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Ordner konnten nicht aus dem Speicher geladen werden.', error);
    return [];
  }
};

const saveFolders = (profileId: string, folders: FolderRecord[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(foldersKey(profileId), JSON.stringify(folders));
};

const loadChats = (profileId: string): ChatRow[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(chatsKey(profileId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<ChatRow & Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) => ({
        id: typeof row.id === 'string' ? row.id : generateId(),
        profile_id: profileId,
        title: typeof row.title === 'string' ? row.title : typeof row.name === 'string' ? row.name : null,
        name: typeof row.name === 'string' ? row.name : typeof row.title === 'string' ? row.title : null,
        folder_id: typeof row.folder_id === 'string' ? row.folder_id : null,
        messages: parseMessages(row.messages),
        summary: typeof row.summary === 'string' ? row.summary : null,
        last_message_at: typeof row.last_message_at === 'string' ? row.last_message_at : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : null
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
  } catch (error) {
    console.error('Chats konnten nicht aus dem Speicher geladen werden.', error);
    return [];
  }
};

const saveChats = (profileId: string, chats: ChatRow[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(chatsKey(profileId), JSON.stringify(chats));
};

export const fetchFoldersForProfile = async (profileId: string): Promise<FolderRecord[]> => {
  return loadFolders(profileId);
};

export const createFolderForProfile = async (
  profileId: string,
  name: string
): Promise<FolderRecord> => {
  const trimmedName = name.trim();
  const folders = loadFolders(profileId);
  const timestamp = new Date().toISOString();
  const newFolder: FolderRecord = {
    id: generateId(),
    profile_id: profileId,
    name: trimmedName.length > 0 ? trimmedName : 'Ordner',
    created_at: timestamp,
    updated_at: timestamp
  };

  const nextFolders = [...folders, newFolder].sort((a, b) => a.name.localeCompare(b.name));
  saveFolders(profileId, nextFolders);
  return newFolder;
};

export const deleteFolderById = async (profileId: string, folderId: string) => {
  const folders = loadFolders(profileId);
  const nextFolders = folders.filter((folder) => folder.id !== folderId);
  saveFolders(profileId, nextFolders);
};

export const detachFolderFromChats = async (profileId: string, folderId: string) => {
  const chats = loadChats(profileId);
  const nextChats = chats.map((chat) =>
    chat.folder_id === folderId
      ? {
          ...chat,
          folder_id: null,
          updated_at: new Date().toISOString()
        }
      : chat
  );
  saveChats(profileId, nextChats);
};

export const fetchChatsForProfile = async (profileId: string): Promise<ChatRow[]> => {
  return loadChats(profileId);
};

export const mapChatRowToChat = (
  row: ChatRow,
  foldersById: Map<string, FolderRecord>
): Chat => {
  const title = (row.title ?? row.name ?? 'Neuer Chat').trim();
  const messages = parseMessages(row.messages);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const previewSource = row.summary ?? lastMessage?.content ?? '';
  const folderId = row.folder_id ?? undefined;
  const folderName = folderId ? foldersById.get(folderId)?.name : undefined;
  const lastTimestamp = row.last_message_at ?? row.updated_at ?? row.created_at ?? new Date().toISOString();

  return {
    id: row.id,
    name: title.length > 0 ? title : 'Neuer Chat',
    folder: folderName,
    folderId,
    messages,
    preview: toPreview(previewSource),
    lastUpdated: formatDisplayTime(lastTimestamp)
  };
};

export const createChatForProfile = async (
  profileId: string,
  chat: Chat
) => {
  const chats = loadChats(profileId);
  const timestamp = new Date().toISOString();
  const prepared: ChatRow = {
    id: chat.id,
    profile_id: profileId,
    title: chat.name,
    name: chat.name,
    folder_id: chat.folderId ?? null,
    messages: chat.messages,
    summary: chat.preview,
    last_message_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp
  };

  const nextChats = [prepared, ...chats.filter((existing) => existing.id !== chat.id)];
  saveChats(profileId, nextChats);
};

export const updateChatRow = async (
  profileId: string,
  chatId: string,
  updates: ChatUpdatePayload
) => {
  const chats = loadChats(profileId);
  const index = chats.findIndex((chat) => chat.id === chatId);
  if (index === -1) {
    throw new Error('Chat wurde nicht gefunden.');
  }

  const now = new Date().toISOString();
  const current = chats[index];
  const next: ChatRow = {
    ...current,
    ...(typeof updates.title === 'string' ? { title: updates.title, name: updates.title } : {}),
    ...(updates.folderId !== undefined ? { folder_id: updates.folderId ?? null } : {}),
    ...(updates.messages ? { messages: updates.messages } : {}),
    ...(typeof updates.summary === 'string' ? { summary: updates.summary } : {}),
    ...(typeof updates.lastMessageAt === 'string' ? { last_message_at: updates.lastMessageAt } : {}),
    updated_at: now
  };

  const nextChats = [...chats];
  nextChats[index] = next;
  saveChats(profileId, nextChats);
};

export const deleteChatById = async (profileId: string, chatId: string) => {
  const chats = loadChats(profileId);
  const nextChats = chats.filter((chat) => chat.id !== chatId);
  saveChats(profileId, nextChats);
};
