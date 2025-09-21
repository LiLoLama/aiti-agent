import { Chat } from '../data/sampleChats';
import { AgentSettings, DEFAULT_AGENT_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'aiti-agent-settings';
const CHATS_STORAGE_KEY = 'aiti-agent-chats';
const FOLDERS_STORAGE_KEY = 'aiti-agent-folders';

export function loadAgentSettings(): AgentSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AGENT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_AGENT_SETTINGS,
        chatBackgroundImage: window.localStorage.getItem('chatBackgroundImage')
      };
    }

    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      ...DEFAULT_AGENT_SETTINGS,
      ...parsed,
      chatBackgroundImage:
        parsed.chatBackgroundImage ?? window.localStorage.getItem('chatBackgroundImage')
    };
  } catch (error) {
    console.error('Failed to load agent settings', error);
    return DEFAULT_AGENT_SETTINGS;
  }
}

export function saveAgentSettings(settings: AgentSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save agent settings', error);
  }
}

export function loadChats(fallback: Chat[]): Chat[] {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Chat[];
    return parsed.length ? parsed : fallback;
  } catch (error) {
    console.error('Failed to load chats', error);
    return fallback;
  }
}

export function saveChats(chats: Chat[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error('Failed to save chats', error);
  }
}

export function loadCustomFolders(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load custom folders', error);
    return [];
  }
}

export function saveCustomFolders(folders: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error('Failed to save custom folders', error);
  }
}
