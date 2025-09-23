import { AgentProfile, AuthUser } from '../types/auth';

type StoredUser = AuthUser & { password: string };

const createAgentId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `agent-${Math.random().toString(36).slice(2, 10)}`;

const USERS_KEY = 'aiti-auth-users';
const CURRENT_USER_KEY = 'aiti-auth-current-user';

const defaultUsers: StoredUser[] = [
  {
    id: 'admin-001',
    name: 'AITI Admin',
    email: 'admin@aiti.local',
    password: 'admin',
    role: 'admin',
    isActive: true,
    avatarUrl: null,
    emailVerified: true,
    bio: 'Verwaltet den AITI Explorer Agent.',
    hasRemoteProfile: true,
    agents: [
      {
        id: 'agent-admin-001',
        name: 'Explorer Agent',
        description: 'Unterstützt das Team bei Rechercheaufgaben und Marktanalysen.',
        avatarUrl: null,
        tools: ['Recherche', 'Analyse-Dashboards'],
        webhookUrl: 'https://hooks.aiti.local/explorer'
      },
      {
        id: 'agent-admin-002',
        name: 'Onboarding Coach',
        description: 'Automatisiert das Nutzer-Onboarding und beantwortet Standardfragen.',
        avatarUrl: null,
        tools: ['FAQ-Datenbank', 'Kalenderzugriff'],
        webhookUrl: 'https://hooks.aiti.local/onboarding'
      }
    ]
  },
  {
    id: 'user-001',
    name: 'Svenja Beispiel',
    email: 'svenja@example.com',
    password: 'passwort123',
    role: 'user',
    isActive: true,
    avatarUrl: null,
    emailVerified: true,
    bio: 'Produktmanagerin mit Fokus auf Automatisierungen.',
    hasRemoteProfile: true,
    agents: [
      {
        id: 'agent-user-001',
        name: 'Marketing Scout',
        description: 'Findet inspirierende Kampagnenideen und erstellt Content-Briefs.',
        avatarUrl: null,
        tools: ['Canva API', 'Keyword-Recherche'],
        webhookUrl: 'https://hooks.aiti.local/marketing-scout'
      }
    ]
  },
  {
    id: 'user-002',
    name: 'Lukas Demo',
    email: 'lukas@example.com',
    password: 'passwort123',
    role: 'user',
    isActive: false,
    avatarUrl: null,
    emailVerified: false,
    bio: 'Experimentiert gerade mit eigenen Agenten.',
    hasRemoteProfile: true,
    agents: [
      {
        id: 'agent-user-002',
        name: 'Support Guide',
        description: 'Beantwortet wiederkehrende Supportanfragen aus dem Ticketsystem.',
        avatarUrl: null,
        tools: ['Helpdesk-API'],
        webhookUrl: 'https://hooks.aiti.local/support-guide'
      }
    ]
  }
];

const withAgentDefaults = (user: StoredUser): StoredUser => ({
  ...user,
  agents: Array.isArray(user.agents)
    ? (user.agents as Partial<AgentProfile>[]).map((agent, index) => ({
        id: agent?.id ?? `${user.id}-${index}-${createAgentId()}`,
        name: agent?.name?.trim() && agent.name.length > 0 ? agent.name : `Agent ${index + 1}`,
        description: agent?.description ?? '',
        avatarUrl: agent?.avatarUrl ?? null,
        tools: Array.isArray(agent?.tools)
          ? agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0)
          : [],
        webhookUrl: agent?.webhookUrl ?? ''
      }))
    : []
});

const isBrowser = typeof window !== 'undefined';

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Konnte Auth-Daten nicht laden, verwende Standardwerte.', error);
    return fallback;
  }
};

export const loadStoredUsers = (): StoredUser[] => {
  if (!isBrowser) {
    return defaultUsers.map(withAgentDefaults);
  }

  const stored = window.localStorage.getItem(USERS_KEY);
  const users = safeParse<StoredUser[]>(stored, defaultUsers);

  if (!stored) {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  return users.map(withAgentDefaults);
};

export const saveStoredUsers = (users: StoredUser[]) => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const loadCurrentUserId = (): string | null => {
  if (!isBrowser) {
    return defaultUsers[0].id;
  }

  const stored = window.localStorage.getItem(CURRENT_USER_KEY);
  return stored ? stored : null;
};

export const saveCurrentUserId = (userId: string | null) => {
  if (!isBrowser) {
    return;
  }

  if (!userId) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  window.localStorage.setItem(CURRENT_USER_KEY, userId);
};

export const toAuthUser = (user: StoredUser): AuthUser => {
  const { password: _password, ...authUser } = user;
  return authUser;
};

export type { StoredUser };
