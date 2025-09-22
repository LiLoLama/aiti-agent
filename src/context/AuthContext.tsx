import {
  createContext,
  useCallback,
  useContext,
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
  RegistrationPayload
} from '../types/auth';
import {
  loadCurrentUserId,
  loadStoredUsers,
  saveCurrentUserId,
  saveStoredUsers,
  StoredUser,
  toAuthUser
} from '../utils/authStorage';

interface AuthContextValue {
  currentUser: AuthUser | null;
  users: AuthUser[];
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: ProfileUpdatePayload) => void;
  toggleUserActive: (userId: string, nextActive: boolean) => void;
  addAgent: (agent: AgentDraft) => void;
  updateAgent: (agentId: string, updates: AgentUpdatePayload) => void;
  removeAgent: (agentId: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const createUserFromRegistration = (payload: RegistrationPayload): StoredUser => ({
  id:
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `user-${Math.random().toString(36).slice(2, 10)}`,
  name: payload.name.trim(),
  email: payload.email.toLowerCase(),
  password: payload.password,
  role: 'user',
  isActive: true,
  avatarUrl: null,
  emailVerified: false,
  bio: '',
  agents: []
});

const sanitizeAgent = (agent: AgentProfile): AgentProfile => ({
  ...agent,
  name: agent.name.trim(),
  description: agent.description,
  tools: agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0),
  webhookUrl: agent.webhookUrl.trim()
});

const sanitizeUsers = (users: StoredUser[]): AuthUser[] =>
  users.map((user) => ({
    ...toAuthUser(user),
    agents: user.agents.map(sanitizeAgent)
  }));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>(() => loadStoredUsers());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadCurrentUserId());

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId]
  );

  const persistUsers = useCallback((nextUsers: StoredUser[]) => {
    setUsers(nextUsers);
    saveStoredUsers(nextUsers);
  }, []);

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = users.find((user) => user.email === normalizedEmail);

      if (!existingUser || existingUser.password !== password) {
        throw new Error('E-Mail oder Passwort ist ungültig.');
      }

      if (!existingUser.isActive) {
        throw new Error('Dein Zugang ist aktuell deaktiviert. Bitte kontaktiere das Admin-Team.');
      }

      setCurrentUserId(existingUser.id);
      saveCurrentUserId(existingUser.id);
    },
    [users]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const trimmedName = name.trim();
      const normalizedEmail = email.toLowerCase().trim();

      if (!trimmedName) {
        throw new Error('Bitte gib einen Namen an.');
      }

      const emailAlreadyExists = users.some((user) => user.email === normalizedEmail);

      if (emailAlreadyExists) {
        throw new Error('Für diese E-Mail existiert bereits ein Account.');
      }

      const newUser = createUserFromRegistration({
        name: trimmedName,
        email: normalizedEmail,
        password
      });
      const nextUsers = [...users, newUser];

      persistUsers(nextUsers);
      setCurrentUserId(newUser.id);
      saveCurrentUserId(newUser.id);
    },
    [persistUsers, users]
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
    saveCurrentUserId(null);
  }, []);

  const updateProfile = useCallback(
    (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        return;
      }

      const nextUsers = users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              ...updates,
              name: updates.name?.trim() ?? user.name
            }
          : user
      );

      persistUsers(nextUsers);
    },
    [currentUser, persistUsers, users]
  );

  const addAgent = useCallback(
    (agent: AgentDraft) => {
      if (!currentUser) {
        return;
      }

      const trimmedName = agent.name.trim();
      if (!trimmedName) {
        throw new Error('Bitte gib einen Agent-Namen an.');
      }

      const newAgent: AgentProfile = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `agent-${Math.random().toString(36).slice(2, 10)}`,
        name: trimmedName,
        description: agent.description.trim(),
        avatarUrl: agent.avatarUrl ?? null,
        tools: agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0),
        webhookUrl: agent.webhookUrl.trim()
      };

      const nextUsers = users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              agents: [...user.agents, newAgent]
            }
          : user
      );

      persistUsers(nextUsers);
    },
    [currentUser, persistUsers, users]
  );

  const updateAgent = useCallback(
    (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        return;
      }

      const nextUsers = users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              agents: user.agents.map((agent) =>
                agent.id === agentId
                  ? {
                      ...agent,
                      ...updates,
                      name: updates.name?.trim() ?? agent.name,
                      description: updates.description ?? agent.description,
                      avatarUrl: updates.avatarUrl ?? agent.avatarUrl,
                      tools: updates.tools
                        ? updates.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0)
                        : agent.tools,
                      webhookUrl: updates.webhookUrl?.trim() ?? agent.webhookUrl
                    }
                  : agent
              )
            }
          : user
      );

      persistUsers(nextUsers);
    },
    [currentUser, persistUsers, users]
  );

  const removeAgent = useCallback(
    (agentId: string) => {
      if (!currentUser) {
        return;
      }

      const nextUsers = users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              agents: user.agents.filter((agent) => agent.id !== agentId)
            }
          : user
      );

      persistUsers(nextUsers);
    },
    [currentUser, persistUsers, users]
  );

  const toggleUserActive = useCallback(
    (userId: string, nextActive: boolean) => {
      const nextUsers = users.map((user) =>
        user.id === userId
          ? {
              ...user,
              isActive: nextActive
            }
          : user
      );

      persistUsers(nextUsers);

      if (currentUser && currentUser.id === userId && !nextActive) {
        logout();
      }
    },
    [currentUser, logout, persistUsers, users]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser: currentUser ? toAuthUser(currentUser) : null,
      users: sanitizeUsers(users),
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
      addAgent,
      currentUser,
      login,
      logout,
      register,
      toggleUserActive,
      removeAgent,
      updateAgent,
      updateProfile,
      users
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
