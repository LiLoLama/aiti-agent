import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { createAgentId, sanitizeAgentProfile } from '../utils/agents';

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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface StoredAuthUser extends AuthUser {
  password: string;
}

interface PersistedAuthState {
  users: StoredAuthUser[];
  currentUserId: string | null;
}

const STORAGE_KEY = 'aiti-auth-state-v1';

const DEFAULT_STATE: PersistedAuthState = {
  users: [],
  currentUserId: null
};

const toAuthUser = (user: StoredAuthUser | null | undefined): AuthUser | null => {
  if (!user) {
    return null;
  }

  const { password: _password, ...rest } = user;
  return rest;
};

const readPersistedState = (): PersistedAuthState => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedAuthState;
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_STATE;
    }

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : null
    };
  } catch (error) {
    console.warn('Gespeicherter Auth-State konnte nicht gelesen werden.', error);
    return DEFAULT_STATE;
  }
};

const writePersistedState = (state: PersistedAuthState) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Auth-State konnte nicht gespeichert werden.', error);
  }
};

const prepareStoredUser = (
  payload: RegistrationPayload & { role?: UserRole; password: string }
): StoredAuthUser => {
  const id = createAgentId();
  const displayName = payload.name?.trim() || payload.email.trim();
  const normalizedEmail = payload.email.trim().toLowerCase();

  return {
    id,
    name: displayName,
    email: normalizedEmail,
    role: payload.role ?? 'user',
    isActive: true,
    avatarUrl: null,
    emailVerified: false,
    agents: [],
    bio: '',
    hasRemoteProfile: true,
    password: payload.password
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedAuthState>(DEFAULT_STATE);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    const nextState = readPersistedState();
    setState(nextState);
    setIsInitialized(true);
    setIsLoading(false);
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    writePersistedState(state);
  }, [state, isInitialized]);

  const currentStoredUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const currentUser = useMemo(() => toAuthUser(currentStoredUser), [currentStoredUser]);

  const publicUsers = useMemo(
    () => state.users.map((user) => toAuthUser(user)).filter((user): user is AuthUser => Boolean(user)),
    [state.users]
  );

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const normalizedEmail = email.trim().toLowerCase();
      const storedUser = state.users.find((user) => user.email === normalizedEmail);

      if (!storedUser) {
        throw new Error('Nutzer wurde nicht gefunden.');
      }

      if (!storedUser.isActive) {
        throw new Error('Dieser Nutzer ist deaktiviert.');
      }

      if (storedUser.password !== password) {
        throw new Error('Ungültige Zugangsdaten.');
      }

      setState((previous) => ({
        ...previous,
        currentUserId: storedUser.id
      }));
    },
    [state.users]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = state.users.find((user) => user.email === normalizedEmail);

      if (existingUser) {
        setState((previous) => ({
          ...previous,
          currentUserId: existingUser.id
        }));

        return { sessionExists: true };
      }

      const newUser = prepareStoredUser({ name, email: normalizedEmail, password });

      setState((previous) => ({
        users: [...previous.users, newUser],
        currentUserId: newUser.id
      }));

      return { sessionExists: false };
    },
    [state.users]
  );

  const logout = useCallback(async () => {
    setState((previous) => ({
      ...previous,
      currentUserId: null
    }));
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      setState((previous) => {
        if (!previous.currentUserId) {
          return previous;
        }

        const users = previous.users.map((user) => {
          if (user.id !== previous.currentUserId) {
            return user;
          }

          return {
            ...user,
            ...(typeof updates.name === 'string' ? { name: updates.name.trim() } : {}),
            ...(typeof updates.avatarUrl !== 'undefined' ? { avatarUrl: updates.avatarUrl } : {}),
            ...(typeof updates.bio === 'string' ? { bio: updates.bio } : {}),
            ...(typeof updates.emailVerified === 'boolean'
              ? { emailVerified: updates.emailVerified }
              : {})
          };
        });

        return {
          ...previous,
          users
        };
      });
    },
    []
  );

  const toggleUserActive = useCallback(async (userId: string, nextActive: boolean) => {
    setState((previous) => {
      const users = previous.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              isActive: nextActive
            }
          : user
      );

      const currentUserId =
        previous.currentUserId && previous.currentUserId === userId && !nextActive
          ? null
          : previous.currentUserId;

      return {
        users,
        currentUserId
      };
    });
  }, []);

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      setState((previous) => {
        if (!previous.currentUserId) {
          throw new Error('Kein Nutzer angemeldet.');
        }

        const newAgent: AgentProfile = sanitizeAgentProfile({
          id: createAgentId(),
          name: agent.name,
          description: agent.description,
          avatarUrl: agent.avatarUrl,
          tools: agent.tools,
          webhookUrl: agent.webhookUrl
        });

        const users = previous.users.map((user) => {
          if (user.id !== previous.currentUserId) {
            return user;
          }

          return {
            ...user,
            agents: [...user.agents, newAgent]
          };
        });

        return {
          ...previous,
          users
        };
      });
    },
    []
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      setState((previous) => {
        if (!previous.currentUserId) {
          return previous;
        }

        const users = previous.users.map((user) => {
          if (user.id !== previous.currentUserId) {
            return user;
          }

          const agents = user.agents.map((agent) => {
            if (agent.id !== agentId) {
              return agent;
            }

            const merged = sanitizeAgentProfile({
              ...agent,
              ...updates,
              id: agent.id
            });

            return merged;
          });

          return {
            ...user,
            agents
          };
        });

        return {
          ...previous,
          users
        };
      });
    },
    []
  );

  const removeAgent = useCallback(async (agentId: string) => {
    setState((previous) => {
      if (!previous.currentUserId) {
        return previous;
      }

      const users = previous.users.map((user) => {
        if (user.id !== previous.currentUserId) {
          return user;
        }

        return {
          ...user,
          agents: user.agents.filter((agent) => agent.id !== agentId)
        };
      });

      return {
        ...previous,
        users
      };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      users: publicUsers,
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
    [
      currentUser,
      publicUsers,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      toggleUserActive,
      addAgent,
      updateAgent,
      removeAgent
    ]
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
