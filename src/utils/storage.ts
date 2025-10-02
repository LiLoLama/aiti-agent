import { Chat } from '../data/sampleChats';
import { AgentSettings, DEFAULT_AGENT_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'aiti-agent-settings';
const CHATS_STORAGE_KEY = 'aiti-agent-chats';
const FOLDERS_STORAGE_KEY = 'aiti-agent-folders';
const PROFILE_AVATAR_STORAGE_KEY = 'aiti-agent-profile-avatar';
const AGENT_AVATAR_STORAGE_KEY = 'aiti-agent-agent-avatar';

function readImageFromStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(key);
  return typeof stored === 'string' ? stored : null;
}

function persistImage(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
}

export function loadAgentSettings(): AgentSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AGENT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const storedProfileAvatar = readImageFromStorage(PROFILE_AVATAR_STORAGE_KEY);
    const storedAgentAvatar = readImageFromStorage(AGENT_AVATAR_STORAGE_KEY);

    if (!raw) {
      return {
        ...DEFAULT_AGENT_SETTINGS,
        profileAvatarImage: storedProfileAvatar,
        agentAvatarImage: storedAgentAvatar
      };
    }

    const rawParsed = JSON.parse(raw) as Partial<AgentSettings> & {
      chatBackgroundImage?: unknown;
    };
    const {
      chatBackgroundImage: _removedBackground,
      apiKey: _storedApiKey,
      basicAuthPassword: _storedBasicPassword,
      oauthToken: _storedOauthToken,
      ...parsed
    } = rawParsed;
    const colorScheme = parsed.colorScheme === 'light' || parsed.colorScheme === 'dark'
      ? parsed.colorScheme
      : DEFAULT_AGENT_SETTINGS.colorScheme;

    const profileAvatarImage =
      typeof parsed.profileAvatarImage === 'string' ? parsed.profileAvatarImage : storedProfileAvatar;
    const agentAvatarImage =
      typeof parsed.agentAvatarImage === 'string' ? parsed.agentAvatarImage : storedAgentAvatar;

    const sanitizedForStorage: Record<string, unknown> = {
      ...parsed,
      colorScheme
    };

    delete sanitizedForStorage.profileAvatarImage;
    delete sanitizedForStorage.agentAvatarImage;
    delete sanitizedForStorage.apiKey;
    delete sanitizedForStorage.basicAuthPassword;
    delete sanitizedForStorage.oauthToken;

    if (Object.keys(sanitizedForStorage).length > 0) {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizedForStorage));
    } else {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }

    persistImage(PROFILE_AVATAR_STORAGE_KEY, profileAvatarImage ?? null);
    persistImage(AGENT_AVATAR_STORAGE_KEY, agentAvatarImage ?? null);
    return {
      ...DEFAULT_AGENT_SETTINGS,
      ...parsed,
      colorScheme,
      profileAvatarImage: profileAvatarImage ?? null,
      agentAvatarImage: agentAvatarImage ?? null,
      apiKey: undefined,
      basicAuthPassword: undefined,
      oauthToken: undefined
    };
  } catch (error) {
    console.error('Failed to load agent settings', error);
    return {
      ...DEFAULT_AGENT_SETTINGS,
      profileAvatarImage: readImageFromStorage(PROFILE_AVATAR_STORAGE_KEY),
      agentAvatarImage: readImageFromStorage(AGENT_AVATAR_STORAGE_KEY)
    };
  }
}

export function saveAgentSettings(settings: AgentSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const { chatBackgroundImage: _unusedBackground, ...incomingSettings } = settings as AgentSettings & {
      chatBackgroundImage?: unknown;
    };

    const prepared: AgentSettings = {
      ...DEFAULT_AGENT_SETTINGS,
      ...incomingSettings,
      profileAvatarImage: settings.profileAvatarImage ?? null,
      agentAvatarImage: settings.agentAvatarImage ?? null
    };

    const {
      profileAvatarImage,
      agentAvatarImage,
      apiKey: _apiKey,
      basicAuthPassword: _basicAuthPassword,
      oauthToken: _oauthToken,
      ...settingsWithoutImages
    } = prepared;

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settingsWithoutImages)
    );

    persistImage(PROFILE_AVATAR_STORAGE_KEY, profileAvatarImage);
    persistImage(AGENT_AVATAR_STORAGE_KEY, agentAvatarImage);
  } catch (error) {
    console.error('Failed to save agent settings', error);
    throw error instanceof Error ? error : new Error('Failed to save agent settings');
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
