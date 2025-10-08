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
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
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
import { supabase } from '../utils/supabase';
import { createAgentId, sanitizeAgentProfile } from '../utils/agents';
import {
  deleteAgentForProfile,
  fetchAgentMetadataForProfile,
  fetchAgentMetadataForProfiles,
  saveAgentMetadataForProfile
} from '../services/chatService';

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

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  bio: string | null;
  email_verified: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const PROFILE_COLUMNS =
  'id, email, display_name, name, avatar_url, role, bio, email_verified, is_active, created_at, updated_at';

const resolveDisplayName = (row: ProfileRow, fallbackEmail: string | null, override?: string) => {
  if (override && override.trim().length > 0) {
    return override.trim();
  }

  const display = row.display_name ?? row.name;
  if (display && display.trim().length > 0) {
    return display.trim();
  }

  if (fallbackEmail) {
    return fallbackEmail.split('@')[0] ?? fallbackEmail;
  }

  return 'Neuer Nutzer';
};

const mapRowToAuthUser = (row: ProfileRow, agents: AgentProfile[], overrideName?: string): AuthUser => ({
  id: row.id,
  name: resolveDisplayName(row, row.email, overrideName),
  email: row.email ?? '',
  role: row.role ?? 'user',
  isActive: row.is_active ?? true,
  avatarUrl: row.avatar_url ?? null,
  emailVerified: (row.email_verified ?? '').toLowerCase() === 'true',
  agents,
  bio: row.bio ?? undefined,
  hasRemoteProfile: true
});

const createProfileInsertPayload = (
  session: Session,
  options?: { displayName?: string; email?: string }
) => {
  const email = options?.email ?? session.user.email ?? '';
  const name =
    options?.displayName?.trim() && options.displayName.trim().length > 0
      ? options.displayName.trim()
      : session.user.user_metadata?.name?.trim() ?? email.split('@')[0] ?? 'Neuer Nutzer';

  return {
    id: session.user.id,
    email,
    display_name: name,
    name,
    avatar_url: session.user.user_metadata?.avatar_url ?? null,
    role: 'user' as UserRole,
    bio: '',
    email_verified: session.user.email_confirmed_at ? 'true' : 'false',
    is_active: true
  };
};

const ensureProfileForSession = async (
  session: Session,
  options?: { displayName?: string; email?: string }
): Promise<ProfileRow> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as ProfileRow;
  }

  const insertPayload = createProfileInsertPayload(session, options);

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as ProfileRow;
};

const fetchAllProfilesWithAgents = async (): Promise<AuthUser[]> => {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS);

  if (error) {
    throw error;
  }

  const rows = (data as ProfileRow[]) ?? [];
  const agentMap = await fetchAgentMetadataForProfiles(rows.map((row) => row.id));

  return rows.map((row) => mapRowToAuthUser(row, agentMap.get(row.id) ?? []));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastSessionAccessTokenRef = useRef<string | null>(null);

  const handleSession = useCallback(
    async (session: Session | null, options?: { profileRow?: ProfileRow }) => {
      if (!session) {
        lastSessionAccessTokenRef.current = null;
        setCurrentUser(null);
        setUsers([]);
        setIsLoading(false);
        return;
      }

      if (lastSessionAccessTokenRef.current === session.access_token && currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const profileRow =
          options?.profileRow ?? (await ensureProfileForSession(session, { email: session.user.email ?? undefined }));

        if (profileRow.is_active === false) {
          await supabase.auth.signOut();
          throw new Error('Dieser Nutzer ist deaktiviert.');
        }

        const agents = await fetchAgentMetadataForProfile(profileRow.id);
        const authUser = mapRowToAuthUser(profileRow, agents);
        setCurrentUser(authUser);
        lastSessionAccessTokenRef.current = session.access_token;

        if (authUser.role === 'admin') {
          const allUsers = await fetchAllProfilesWithAgents();
          setUsers(allUsers);
        } else {
          setUsers([authUser]);
        }
      } catch (error) {
        console.error('Session konnte nicht geladen werden.', error);
        setCurrentUser(null);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    let isMounted = true;

    const loadInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        await handleSession(data.session ?? null);
      } catch (error) {
        console.error('Initiale Session konnte nicht geladen werden.', error);
        if (isMounted) {
          setCurrentUser(null);
          setUsers([]);
          setIsLoading(false);
        }
      }
    };

    void loadInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session) => {
        void handleSession(session ?? null);
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [handleSession]);

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.session) {
        throw new Error('Anmeldung fehlgeschlagen.');
      }

      const profileRow = await ensureProfileForSession(data.session);

      if (profileRow.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Dieser Nutzer ist deaktiviert.');
      }

      await handleSession(data.session, { profileRow });
    },
    [handleSession]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const session = data.session ?? null;

      if (session) {
        const profileRow = await ensureProfileForSession(session, { displayName: name, email });
        await handleSession(session, { profileRow });
      }

      return { sessionExists: Boolean(session) };
    },
    [handleSession]
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }

    setCurrentUser(null);
    setUsers([]);
    lastSessionAccessTokenRef.current = null;
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer.');
      }

      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (typeof updates.name === 'string') {
        updatePayload.display_name = updates.name;
        updatePayload.name = updates.name;
      }

      if (updates.avatarUrl !== undefined) {
        updatePayload.avatar_url = updates.avatarUrl;
      }

      if (updates.bio !== undefined) {
        updatePayload.bio = updates.bio ?? null;
      }

      if (updates.emailVerified !== undefined) {
        updatePayload.email_verified = updates.emailVerified ? 'true' : 'false';
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', currentUser.id)
        .select(PROFILE_COLUMNS)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const profileRow = data as ProfileRow;
      const updatedUser = mapRowToAuthUser(profileRow, currentUser.agents);
      setCurrentUser(updatedUser);
      setUsers((previous) =>
        previous.map((user) => (user.id === updatedUser.id ? { ...updatedUser } : user))
      );
    },
    [currentUser]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedRow = data as ProfileRow;

      setUsers((previous) =>
        previous.map((user) => {
          if (user.id !== userId) {
            return user;
          }

          return mapRowToAuthUser(updatedRow, user.agents);
        })
      );

      setCurrentUser((previous) =>
        previous && previous.id === userId
          ? mapRowToAuthUser(updatedRow, previous.agents)
          : previous
      );
    },
    []
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer.');
      }

      const newAgent: AgentProfile = sanitizeAgentProfile({
        id: createAgentId(),
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl ?? null,
        tools: agent.tools,
        webhookUrl: agent.webhookUrl
      });

      await saveAgentMetadataForProfile(currentUser.id, newAgent);

      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              agents: [...previous.agents, newAgent]
            }
          : previous
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === currentUser.id
            ? {
                ...user,
                agents: [...user.agents, newAgent]
              }
            : user
        )
      );
    },
    [currentUser]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer.');
      }

      const existingAgent = currentUser.agents.find((agent) => agent.id === agentId);
      if (!existingAgent) {
        throw new Error('Agent wurde nicht gefunden.');
      }

      const updatedAgent: AgentProfile = sanitizeAgentProfile({
        ...existingAgent,
        ...updates
      });

      await saveAgentMetadataForProfile(currentUser.id, updatedAgent);

      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              agents: previous.agents.map((agent) =>
                agent.id === agentId ? updatedAgent : agent
              )
            }
          : previous
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === currentUser.id
            ? {
                ...user,
                agents: user.agents.map((agent) => (agent.id === agentId ? updatedAgent : agent))
              }
            : user
        )
      );
    },
    [currentUser]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer.');
      }

      await deleteAgentForProfile(currentUser.id, agentId);

      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              agents: previous.agents.filter((agent) => agent.id !== agentId)
            }
          : previous
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === currentUser.id
            ? {
                ...user,
                agents: user.agents.filter((agent) => agent.id !== agentId)
              }
            : user
        )
      );
    },
    [currentUser]
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
    [currentUser, users, isLoading, login, register, logout, updateProfile, toggleUserActive, addAgent, updateAgent, removeAgent]
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
