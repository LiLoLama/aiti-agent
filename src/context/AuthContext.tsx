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
import { supabase } from '../utils/supabase';

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  bio: string | null;
  email_verified: string | null;
  is_active: boolean | null;
};

type AgentConversationRow = {
  profile_id: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_description: string | null;
  agent_avatar_url: string | null;
  agent_webhook_url: string | null;
  agent_tools: unknown;
};

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

const sanitizeTools = (tools: unknown): string[] => {
  if (!Array.isArray(tools)) {
    return [];
  }

  const sanitized = tools
    .filter((tool): tool is string => typeof tool === 'string' && tool.trim().length > 0)
    .map((tool) => tool.trim());

  return Array.from(new Set(sanitized));
};

const sanitizeAgentDraft = (draft: AgentDraft) => ({
  name: draft.name?.trim().length ? draft.name.trim() : 'Unbenannter Agent',
  description: draft.description?.trim() ?? '',
  avatarUrl: draft.avatarUrl ?? null,
  tools: sanitizeTools(draft.tools),
  webhookUrl: draft.webhookUrl?.trim() ?? ''
});

const mapConversationRowToAgent = (row: AgentConversationRow): AgentProfile | null => {
  if (!row.agent_id) {
    return null;
  }

  return {
    id: row.agent_id,
    name: row.agent_name?.trim().length ? row.agent_name.trim() : 'Unbenannter Agent',
    description: row.agent_description?.trim() ?? '',
    avatarUrl: row.agent_avatar_url ?? null,
    tools: sanitizeTools(row.agent_tools),
    webhookUrl: row.agent_webhook_url?.trim() ?? ''
  };
};

const resolveUserRole = (value: string | null | undefined): UserRole => (value === 'admin' ? 'admin' : 'user');

const toBoolean = (value: string | null | undefined) => value?.toLowerCase() === 'true';

const mapProfileRowToAuthUser = (row: ProfileRow, agents: AgentProfile[]): AuthUser => {
  const nameCandidate = [row.display_name, row.name, row.email]
    .find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
    ?.trim();

  const normalizedEmail = typeof row.email === 'string' && row.email.length > 0 ? row.email : '';

  return {
    id: row.id,
    name: nameCandidate ?? 'AITI Nutzer',
    email: normalizedEmail,
    role: resolveUserRole(row.role),
    isActive: typeof row.is_active === 'boolean' ? row.is_active : true,
    avatarUrl: row.avatar_url ?? null,
    emailVerified: toBoolean(row.email_verified),
    agents,
    bio: row.bio ?? '',
    hasRemoteProfile: true
  };
};

const createUuid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}-${Math.random()
        .toString(16)
        .slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 14)}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchAndSetUsers = useCallback(
    async (activeUserId?: string | null) => {
      const targetUserId = activeUserId ?? sessionUserId ?? null;

      const { data: profileRows, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) {
        throw new Error(profilesError.message ?? 'Profile konnten nicht geladen werden.');
      }

      const { data: conversationRows, error: conversationsError } = await supabase
        .from('agent_conversations')
        .select(
          'profile_id, agent_id, agent_name, agent_description, agent_avatar_url, agent_webhook_url, agent_tools'
        );
      if (conversationsError) {
        throw new Error(conversationsError.message ?? 'Agenten konnten nicht geladen werden.');
      }

      const groupedAgents = new Map<string, AgentProfile[]>();
      for (const row of conversationRows ?? []) {
        if (!row?.profile_id) {
          continue;
        }

        const agent = mapConversationRowToAgent(row);
        if (!agent) {
          continue;
        }

        const existing = groupedAgents.get(row.profile_id) ?? [];
        existing.push(agent);
        groupedAgents.set(row.profile_id, existing);
      }

      const mappedUsers = (profileRows ?? []).map((row) => mapProfileRowToAuthUser(row, groupedAgents.get(row.id) ?? []));

      if (!isMountedRef.current) {
        return;
      }

      setUsers(mappedUsers);

      if (targetUserId) {
        const active = mappedUsers.find((user) => user.id === targetUserId) ?? null;
        setCurrentUser(active);
      } else {
        setCurrentUser(null);
      }
    },
    [sessionUserId]
  );

  useEffect(() => {
    let isSubscribed = true;

    const initialize = async () => {
      setIsLoading(true);
      try {
        const { data: sessionResponse, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        if (!isSubscribed) {
          return;
        }

        const activeUserId = sessionResponse.session?.user?.id ?? null;
        setSessionUserId(activeUserId);
        await fetchAndSetUsers(activeUserId);
      } catch (error) {
        console.error('Konnte Auth-Daten nicht laden.', error);
        if (isMountedRef.current) {
          setUsers([]);
          setCurrentUser(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) {
        return;
      }

      const nextUserId = session?.user?.id ?? null;
      setSessionUserId(nextUserId);
      void fetchAndSetUsers(nextUserId);
    });

    return () => {
      isSubscribed = false;
      subscription?.subscription.unsubscribe();
    };
  }, [fetchAndSetUsers]);

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        throw new Error(error.message ?? 'Anmeldung fehlgeschlagen.');
      }

      const userId = data.user?.id ?? null;
      setSessionUserId(userId);
      await fetchAndSetUsers(userId);
    },
    [fetchAndSetUsers]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: trimmedName,
            name: trimmedName
          }
        }
      });

      if (error) {
        throw new Error(error.message ?? 'Registrierung fehlgeschlagen.');
      }

      const supabaseUser = data.user;
      if (supabaseUser) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: supabaseUser.id,
          email: supabaseUser.email ?? normalizedEmail,
          display_name: trimmedName || supabaseUser.email || 'Neuer Nutzer',
          name: trimmedName || null,
          avatar_url: null,
          role: 'user',
          bio: '',
          email_verified: supabaseUser.email_confirmed_at ? 'true' : 'false',
          is_active: true
        });

        if (profileError) {
          throw new Error(profileError.message ?? 'Profil konnte nicht gespeichert werden.');
        }

        await fetchAndSetUsers(supabaseUser.id);
      } else {
        await fetchAndSetUsers(null);
      }

      return { sessionExists: Boolean(data.session) };
    },
    [fetchAndSetUsers]
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message ?? 'Abmeldung fehlgeschlagen.');
    }

    setSessionUserId(null);
    await fetchAndSetUsers(null);
  }, [fetchAndSetUsers]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const trimmedName = updates.name?.trim();
      const preparedUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (typeof trimmedName === 'string' && trimmedName.length > 0) {
        preparedUpdates.display_name = trimmedName;
        preparedUpdates.name = trimmedName;
      }

      if (updates.avatarUrl !== undefined) {
        preparedUpdates.avatar_url = updates.avatarUrl;
      }

      if (typeof updates.bio === 'string') {
        preparedUpdates.bio = updates.bio;
      }

      if (typeof updates.emailVerified === 'boolean') {
        preparedUpdates.email_verified = updates.emailVerified ? 'true' : 'false';
      }

      const { error } = await supabase.from('profiles').update(preparedUpdates).eq('id', currentUser.id);
      if (error) {
        throw new Error(error.message ?? 'Profil konnte nicht aktualisiert werden.');
      }

      await fetchAndSetUsers(currentUser.id);
    },
    [currentUser, fetchAndSetUsers]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message ?? 'Nutzerstatus konnte nicht geändert werden.');
      }

      if (currentUser?.id === userId && !nextActive) {
        await logout();
        return;
      }

      await fetchAndSetUsers(currentUser?.id ?? sessionUserId ?? null);
    },
    [currentUser?.id, fetchAndSetUsers, logout, sessionUserId]
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const sanitized = sanitizeAgentDraft(agent);
      const timestamp = new Date().toISOString();
      const agentId = createUuid();

      const { error } = await supabase.from('agent_conversations').insert({
        id: createUuid(),
        profile_id: currentUser.id,
        agent_id: agentId,
        agent_name: sanitized.name,
        agent_description: sanitized.description,
        agent_avatar_url: sanitized.avatarUrl,
        agent_tools: sanitized.tools,
        agent_webhook_url: sanitized.webhookUrl,
        messages: [],
        summary: null,
        last_message_at: null,
        title: sanitized.name,
        created_at: timestamp,
        updated_at: timestamp
      });

      if (error) {
        throw new Error(error.message ?? 'Agent konnte nicht erstellt werden.');
      }

      await fetchAndSetUsers(currentUser.id);
    },
    [currentUser, fetchAndSetUsers]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const sanitized = sanitizeAgentDraft({
        name: updates.name ?? '',
        description: updates.description ?? '',
        avatarUrl: updates.avatarUrl ?? null,
        tools: updates.tools ?? [],
        webhookUrl: updates.webhookUrl ?? ''
      });

      const { error } = await supabase
        .from('agent_conversations')
        .update({
          agent_name: sanitized.name,
          agent_description: sanitized.description,
          agent_avatar_url: sanitized.avatarUrl,
          agent_tools: sanitized.tools,
          agent_webhook_url: sanitized.webhookUrl,
          title: sanitized.name,
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', currentUser.id)
        .eq('agent_id', agentId);

      if (error) {
        throw new Error(error.message ?? 'Agent konnte nicht aktualisiert werden.');
      }

      await fetchAndSetUsers(currentUser.id);
    },
    [currentUser, fetchAndSetUsers]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein aktiver Nutzer gefunden.');
      }

      const { error } = await supabase
        .from('agent_conversations')
        .delete()
        .eq('profile_id', currentUser.id)
        .eq('agent_id', agentId);

      if (error) {
        throw new Error(error.message ?? 'Agent konnte nicht entfernt werden.');
      }

      await fetchAndSetUsers(currentUser.id);
    },
    [currentUser, fetchAndSetUsers]
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
