import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  AgentDraft,
  AgentProfile,
  AgentUpdatePayload,
  AuthCredentials,
  AuthUser,
  ProfileUpdatePayload,
  RegistrationPayload,
  UserRole
} from '../types/auth';

interface AuthContextValue {
  currentUser: AuthUser | null;
  users: AuthUser[];
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<{ sessionExists: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  toggleUserActive: (userId: string, nextActive: boolean) => Promise<void>;
  addAgent: (agent: AgentDraft) => Promise<void>;
  updateAgent: (agentId: string, updates: AgentUpdatePayload) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
}

const USERS_STORAGE_KEY = 'aiti-auth-users';
const SESSION_STORAGE_KEY = 'aiti-auth-session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type StoredAgentProfile = AgentProfile;

type StoredAuthUser = Omit<AuthUser, 'hasRemoteProfile'> & {
  password: string;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomSegment = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `${randomSegment()}-${randomSegment().slice(0, 4)}-${randomSegment().slice(0, 4)}-${randomSegment().slice(0, 4)}-${randomSegment()}${randomSegment()}`.slice(0, 36);
};

const sanitizeTools = (tools: string[] | undefined): string[] => {
  if (!Array.isArray(tools)) {
    return [];
  }

  const normalized = tools
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);

  return Array.from(new Set(normalized));
};

const sanitizeAgent = (agent: AgentProfile): AgentProfile => ({
  id: agent.id,
  name: agent.name.trim().length > 0 ? agent.name.trim() : 'Unbenannter Agent',
  description: agent.description?.trim() ?? '',
  avatarUrl: agent.avatarUrl ?? null,
  tools: sanitizeTools(agent.tools),
  webhookUrl: agent.webhookUrl?.trim() ?? ''
});

const sanitizeAgents = (agents: StoredAgentProfile[] | undefined): StoredAgentProfile[] => {
  if (!agents) {
    return [];
  }

  return agents
    .filter((agent): agent is StoredAgentProfile => Boolean(agent) && typeof agent.id === 'string')
    .map((agent) => sanitizeAgent(agent));
};

const toAuthUser = (stored: StoredAuthUser): AuthUser => ({
  id: stored.id,
  name: stored.name,
  email: stored.email,
  role: stored.role,
  isActive: stored.isActive,
  avatarUrl: stored.avatarUrl ?? null,
  emailVerified: stored.emailVerified,
  agents: sanitizeAgents(stored.agents),
  bio: stored.bio,
  hasRemoteProfile: true
});

const createDefaultUser = (): StoredAuthUser => ({
  id: generateId(),
  name: 'Demo Nutzer',
  email: 'demo@aiti.local',
  role: 'admin',
  isActive: true,
  avatarUrl: null,
  emailVerified: true,
  agents: [],
  bio: '',
  password: 'aiti-demo'
});

const readStoredUsers = (): StoredAuthUser[] => {
  if (typeof window === 'undefined') {
    return [createDefaultUser()];
  }

  const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) {
    const defaults = [createDefaultUser()];
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<StoredAuthUser>>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = [createDefaultUser()];
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }

    return parsed
      .filter((candidate): candidate is Partial<StoredAuthUser> => Boolean(candidate) && typeof candidate === 'object')
      .map((candidate) => {
        const base: StoredAuthUser = {
          id: typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id : generateId(),
          name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : 'Neuer Nutzer',
          email:
            typeof candidate.email === 'string' && candidate.email.trim().length > 0
              ? candidate.email.trim().toLowerCase()
              : 'demo@aiti.local',
          role: candidate.role === 'admin' ? 'admin' : 'user',
          isActive: typeof candidate.isActive === 'boolean' ? candidate.isActive : true,
          avatarUrl: typeof candidate.avatarUrl === 'string' ? candidate.avatarUrl : null,
          emailVerified: typeof candidate.emailVerified === 'boolean' ? candidate.emailVerified : false,
          agents: sanitizeAgents(candidate.agents as StoredAgentProfile[]),
          bio: typeof candidate.bio === 'string' ? candidate.bio : '',
          password:
            typeof candidate.password === 'string' && candidate.password.length > 0
              ? candidate.password
              : 'aiti-demo'
        };

        return base;
      });
  } catch (error) {
    console.error('Konnte gespeicherte Nutzer nicht lesen.', error);
    const defaults = [createDefaultUser()];
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
};

const persistStoredUsers = (users: StoredAuthUser[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const readActiveSession = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  return stored && stored.trim().length > 0 ? stored : null;
};

const persistActiveSession = (sessionId: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
};

const ensureUniqueEmail = (users: StoredAuthUser[], email: string, excludeUserId?: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const conflict = users.some((user) => user.email === normalizedEmail && user.id !== excludeUserId);
  if (conflict) {
    throw new Error('Diese E-Mail-Adresse wird bereits verwendet.');
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const storedUsersRef = useRef<StoredAuthUser[]>([]);

  useEffect(() => {
    const storedUsers = readStoredUsers();
    storedUsersRef.current = storedUsers;
    const mappedUsers = storedUsers.map(toAuthUser);
    setUsers(mappedUsers);

    const activeSession = readActiveSession();
    setSessionUserId(activeSession);

    if (activeSession) {
      const matching = storedUsers.find((user) => user.id === activeSession);
      if (matching && matching.isActive) {
        setCurrentUser(toAuthUser(matching));
      }
    }

    setIsLoading(false);
  }, []);

  const updateStateFromUsers = useCallback(
    (nextUsers: StoredAuthUser[], nextSessionId: string | null) => {
      storedUsersRef.current = nextUsers;
      persistStoredUsers(nextUsers);
      setUsers(nextUsers.map(toAuthUser));

      if (nextSessionId) {
        const activeUser = nextUsers.find((user) => user.id === nextSessionId);
        setCurrentUser(activeUser ? toAuthUser(activeUser) : null);
      } else if (sessionUserId) {
        const activeUser = nextUsers.find((user) => user.id === sessionUserId);
        setCurrentUser(activeUser ? toAuthUser(activeUser) : null);
      } else {
        setCurrentUser(null);
      }
    },
    [sessionUserId]
  );

  const login = useCallback(async ({ email, password }: AuthCredentials) => {
    const normalizedEmail = email.trim().toLowerCase();
    const storedUsers = storedUsersRef.current;
    const matching = storedUsers.find((user) => user.email === normalizedEmail);

    if (!matching || matching.password !== password) {
      throw new Error('Ungültige Anmeldedaten.');
    }

    if (!matching.isActive) {
      throw new Error('Dieser Account ist deaktiviert. Bitte wende dich an eine Administratorin.');
    }

    persistActiveSession(matching.id);
    setSessionUserId(matching.id);
    setCurrentUser(toAuthUser(matching));
  }, []);

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const storedUsers = storedUsersRef.current;
      ensureUniqueEmail(storedUsers, email);

      const newUser: StoredAuthUser = {
        id: generateId(),
        name: name.trim().length > 0 ? name.trim() : 'Neuer Nutzer',
        email: email.trim().toLowerCase(),
        role: 'user',
        isActive: true,
        avatarUrl: null,
        emailVerified: false,
        agents: [],
        bio: '',
        password
      };

      const nextUsers = [...storedUsers, newUser];
      persistActiveSession(newUser.id);
      setSessionUserId(newUser.id);
      updateStateFromUsers(nextUsers, newUser.id);

      return { sessionExists: false };
    },
    [updateStateFromUsers]
  );

  const logout = useCallback(async () => {
    persistActiveSession(null);
    setSessionUserId(null);
    setCurrentUser(null);
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const storedUsers = storedUsersRef.current;
      const index = storedUsers.findIndex((user) => user.id === currentUser.id);
      if (index === -1) {
        throw new Error('Nutzer konnte nicht aktualisiert werden.');
      }

      const updatedUser: StoredAuthUser = {
        ...storedUsers[index],
        name: updates.name?.trim()?.length ? updates.name.trim() : storedUsers[index].name,
        avatarUrl: updates.avatarUrl ?? storedUsers[index].avatarUrl,
        bio:
          typeof updates.bio === 'string'
            ? updates.bio
            : typeof storedUsers[index].bio === 'string'
            ? storedUsers[index].bio
            : '',
        emailVerified:
          typeof updates.emailVerified === 'boolean' ? updates.emailVerified : storedUsers[index].emailVerified
      };

      const nextUsers = [...storedUsers];
      nextUsers[index] = updatedUser;
      updateStateFromUsers(nextUsers, currentUser.id);
    },
    [currentUser, updateStateFromUsers]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      const storedUsers = storedUsersRef.current;
      const index = storedUsers.findIndex((user) => user.id === userId);
      if (index === -1) {
        throw new Error('Nutzer wurde nicht gefunden.');
      }

      const updatedUser: StoredAuthUser = {
        ...storedUsers[index],
        isActive: nextActive
      };

      const nextUsers = [...storedUsers];
      nextUsers[index] = updatedUser;

      const nextSessionId = nextActive ? sessionUserId : sessionUserId === userId ? null : sessionUserId;
      if (sessionUserId === userId && !nextActive) {
        persistActiveSession(null);
        setSessionUserId(null);
      }

      updateStateFromUsers(nextUsers, nextSessionId);
    },
    [sessionUserId, updateStateFromUsers]
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const storedUsers = storedUsersRef.current;
      const index = storedUsers.findIndex((user) => user.id === currentUser.id);
      if (index === -1) {
        throw new Error('Nutzer konnte nicht aktualisiert werden.');
      }

      const newAgent: StoredAgentProfile = sanitizeAgent({
        id: generateId(),
        ...agent
      });

      const updatedUser: StoredAuthUser = {
        ...storedUsers[index],
        agents: [...sanitizeAgents(storedUsers[index].agents), newAgent]
      };

      const nextUsers = [...storedUsers];
      nextUsers[index] = updatedUser;
      updateStateFromUsers(nextUsers, currentUser.id);
    },
    [currentUser, updateStateFromUsers]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const storedUsers = storedUsersRef.current;
      const index = storedUsers.findIndex((user) => user.id === currentUser.id);
      if (index === -1) {
        throw new Error('Nutzer konnte nicht aktualisiert werden.');
      }

      const agents = sanitizeAgents(storedUsers[index].agents);
      const agentIndex = agents.findIndex((agent) => agent.id === agentId);
      if (agentIndex === -1) {
        throw new Error('Agent wurde nicht gefunden.');
      }

      const updatedAgent: StoredAgentProfile = sanitizeAgent({
        ...agents[agentIndex],
        ...updates
      });

      const nextAgents = [...agents];
      nextAgents[agentIndex] = updatedAgent;

      const nextUsers = [...storedUsers];
      nextUsers[index] = {
        ...storedUsers[index],
        agents: nextAgents
      };

      updateStateFromUsers(nextUsers, currentUser.id);
    },
    [currentUser, updateStateFromUsers]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const storedUsers = storedUsersRef.current;
      const index = storedUsers.findIndex((user) => user.id === currentUser.id);
      if (index === -1) {
        throw new Error('Nutzer konnte nicht aktualisiert werden.');
      }

      const agents = sanitizeAgents(storedUsers[index].agents);
      const nextAgents = agents.filter((agent) => agent.id !== agentId);

      const nextUsers = [...storedUsers];
      nextUsers[index] = {
        ...storedUsers[index],
        agents: nextAgents
      };

      updateStateFromUsers(nextUsers, currentUser.id);
    },
    [currentUser, updateStateFromUsers]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      users,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      toggleUserActive,
      addAgent,
      updateAgent,
      removeAgent
    }),
    [addAgent, currentUser, isLoading, login, logout, register, removeAgent, toggleUserActive, updateAgent, updateProfile, users]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb eines AuthProvider verwendet werden.');
  }

  return context;
};
