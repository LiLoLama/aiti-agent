import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { AuthChangeEvent, PostgrestError, Session } from '@supabase/supabase-js';
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
  avatar_url: string | null;
  role: UserRole | null;
  created_at: string | null;
  updated_at: string | null;
  agents: string | null;
  bio: string | null;
  email_verified: string | null;
  is_active: boolean | null;
  name: string | null;
};

const isRowLevelSecurityError = (error: PostgrestError) =>
  error.message.toLowerCase().includes('row-level security');

const sanitizeAgent = (agent: AgentProfile): AgentProfile => ({
  ...agent,
  name: agent.name.trim(),
  description: agent.description.trim(),
  tools: agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0),
  webhookUrl: agent.webhookUrl.trim()
});

const parseAgents = (value: string | null): AgentProfile[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((candidate): candidate is AgentProfile => Boolean(candidate))
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        avatarUrl: candidate.avatarUrl ?? null,
        tools: candidate.tools ?? [],
        webhookUrl: candidate.webhookUrl ?? ''
      }))
      .map(sanitizeAgent);
  } catch (error) {
    console.error('Agents konnten nicht geparst werden.', error);
    return [];
  }
};

const stringifyAgents = (agents: AgentProfile[]): string => JSON.stringify(agents);

const resolveDisplayName = (row: ProfileRow | null, fallbackEmail: string | null, override?: string) => {
  if (override && override.trim().length > 0) {
    return override.trim();
  }

  const display = row?.display_name ?? row?.name;
  if (display && display.trim().length > 0) {
    return display.trim();
  }

  if (fallbackEmail) {
    return fallbackEmail.split('@')[0] ?? fallbackEmail;
  }

  return 'Neuer Nutzer';
};

const mapRowToAuthUser = (row: ProfileRow, overrideName?: string): AuthUser => ({
  id: row.id,
  name: resolveDisplayName(row, row.email, overrideName),
  email: row.email ?? '',
  role: row.role ?? 'user',
  isActive: row.is_active ?? true,
  avatarUrl: row.avatar_url,
  emailVerified: (row.email_verified ?? '').toLowerCase() === 'true',
  agents: parseAgents(row.agents),
  bio: row.bio ?? undefined,
  hasRemoteProfile: true
});

const createFallbackAuthUser = (
  session: Session,
  options?: { displayName?: string; email?: string }
): AuthUser => ({
  id: session.user.id,
  name:
    options?.displayName?.trim() && options.displayName.trim().length > 0
      ? options.displayName.trim()
      : session.user.user_metadata?.name?.trim() ?? session.user.email ?? 'Neuer Nutzer',
  email: options?.email ?? session.user.email ?? '',
  role: 'user',
  isActive: true,
  avatarUrl: session.user.user_metadata?.avatar_url ?? null,
  emailVerified: Boolean(session.user.email_confirmed_at),
  agents: [],
  bio: '',
  hasRemoteProfile: false
});

class ProfilePolicyError extends Error {
  fallbackUser: AuthUser;

  constructor(message: string, fallbackUser: AuthUser) {
    super(message);
    this.name = 'ProfilePolicyError';
    this.fallbackUser = fallbackUser;
    Object.setPrototypeOf(this, ProfilePolicyError.prototype);
  }
}

const createProfileInsertPayload = (
  session: Session,
  options?: { displayName?: string; email?: string }
) => {
  const now = new Date().toISOString();
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
    created_at: now,
    updated_at: now,
    agents: stringifyAgents([]),
    bio: '',
    email_verified: session.user.email_confirmed_at ? 'true' : 'false',
    is_active: true
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const ensureSession = useCallback(async (): Promise<Session> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }

    if (!data.session) {
      throw new Error('Keine aktive Session gefunden.');
    }

    return data.session;
  }, []);

  const ensureProfileForSession = useCallback(
    async (session: Session, options?: { displayName?: string; email?: string }) => {
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRow>();

      if (existingError) {
        if (isRowLevelSecurityError(existingError)) {
          const fallbackUser = createFallbackAuthUser(session, options);
          throw new ProfilePolicyError(
            'Profil konnte nicht geladen werden: Die Row-Level-Security-Policies für "profiles" erlauben keinen Zugriff. Bitte passe deine Supabase-Policies an.',
            fallbackUser
          );
        }

        if (existingError.code !== 'PGRST116') {
          throw new Error(existingError.message);
        }
      }

      if (existing) {
        return mapRowToAuthUser(existing, options?.displayName);
      }

      const insertPayload = createProfileInsertPayload(session, options);
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select()
        .single<ProfileRow>();

      if (insertError) {
        if (isRowLevelSecurityError(insertError)) {
          const fallbackUser = createFallbackAuthUser(session, options);
          throw new ProfilePolicyError(
            'Profil konnte nicht gespeichert werden: Die Row-Level-Security-Policies für "profiles" erlauben das Anlegen nicht. Bitte ergänze passende Policies in Supabase.',
            fallbackUser
          );
        }

        throw new Error(insertError.message);
      }

      return mapRowToAuthUser(inserted, options?.displayName);
    },
    []
  );

  const fetchAllProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .returns<ProfileRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    return rows.map((row: ProfileRow) => mapRowToAuthUser(row));
  }, []);

  const updateUsersState = useCallback((updatedUser: AuthUser) => {
    setUsers((previous) => {
      const index = previous.findIndex((user) => user.id === updatedUser.id);
      if (index === -1) {
        return [...previous, updatedUser];
      }

      const nextUsers = [...previous];
      nextUsers[index] = updatedUser;
      return nextUsers;
    });
  }, []);

  const handleSession = useCallback(
    async (session: Session | null, options?: { displayName?: string; email?: string }) => {
      if (!session) {
        setCurrentUser(null);
        setUsers([]);
        return null;
      }

      try {
        const ensuredProfile = await ensureProfileForSession(session, options);

        setCurrentUser(ensuredProfile);

        if (ensuredProfile.role === 'admin') {
          try {
            const allProfiles = await fetchAllProfiles();
            setUsers(allProfiles);
          } catch (error) {
            console.error('Profile konnten nicht geladen werden.', error);
            setUsers([ensuredProfile]);
          }
        } else {
          setUsers([ensuredProfile]);
        }

        return ensuredProfile;
      } catch (error) {
        if (error instanceof ProfilePolicyError) {
          setCurrentUser(error.fallbackUser);
          setUsers([error.fallbackUser]);
          throw error;
        }

        console.error('Profil konnte nicht geladen werden.', error);
        setCurrentUser(null);
        setUsers([]);
        throw error;
      }
    },
    [ensureProfileForSession, fetchAllProfiles]
  );

  useEffect(() => {
    let isActive = true;

    const initialise = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!isActive) {
          return;
        }

        await handleSession(data.session ?? null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void initialise();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setIsLoading(true);
        void handleSession(session).finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });
      }
    );

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, [handleSession]);

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.session) {
        throw new Error('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      }

      const profile = await handleSession(data.session);

      if (profile && !profile.isActive) {
        await supabase.auth.signOut();
        throw new Error('Dein Zugang ist aktuell deaktiviert. Bitte kontaktiere das Admin-Team.');
      }
    },
    [handleSession]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Bitte gib einen Namen an.');
      }

      const normalizedEmail = email.toLowerCase().trim();

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
        throw new Error(error.message);
      }

      const sessionExists = Boolean(data.session);

      if (data.session) {
        await handleSession(data.session, { displayName: trimmedName, email: normalizedEmail });
      }

      return { sessionExists };
    },
    [handleSession]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      if (!currentUser.hasRemoteProfile) {
        throw new Error(
          'Dein Profil kann aktuell nicht gespeichert werden, weil kein Supabase-Profil vorhanden ist. Bitte prüfe die Row-Level-Security-Policies für "profiles" und versuche es erneut.'
        );
      }

      const session = await ensureSession();
      await ensureProfileForSession(session, {
        displayName: currentUser.name,
        email: currentUser.email
      });

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) {
        payload.display_name = updates.name.trim();
      }

      if (updates.avatarUrl !== undefined) {
        payload.avatar_url = updates.avatarUrl;
      }

      if (updates.bio !== undefined) {
        payload.bio = updates.bio;
      }

      if (updates.emailVerified !== undefined) {
        payload.email_verified = updates.emailVerified ? 'true' : 'false';
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', currentUser.id)
        .select()
        .single<ProfileRow>();

      if (error) {
        throw new Error(error.message);
      }

      const updatedUser = mapRowToAuthUser(data);
      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
  );

  const persistAgents = useCallback(
    async (profileId: string, agents: AgentProfile[]) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          agents: stringifyAgents(agents.map(sanitizeAgent)),
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)
        .select()
        .single<ProfileRow>();

      if (error) {
        throw new Error(error.message);
      }

      return mapRowToAuthUser(data);
    },
    []
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      if (!currentUser.hasRemoteProfile) {
        throw new Error(
          'Neue Agents können nicht gespeichert werden, solange kein Supabase-Profil existiert. Bitte ergänze die notwendigen Policies für "profiles".'
        );
      }

      const trimmedName = agent.name.trim();
      if (!trimmedName) {
        throw new Error('Bitte gib einen Agent-Namen an.');
      }

      const session = await ensureSession();
      await ensureProfileForSession(session, {
        displayName: currentUser.name,
        email: currentUser.email
      });

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

      const nextAgents = [...currentUser.agents, newAgent];
      const updatedUser = await persistAgents(currentUser.id, nextAgents);

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, persistAgents, updateUsersState]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      if (!currentUser.hasRemoteProfile) {
        throw new Error(
          'Agents können nicht aktualisiert werden, solange kein Supabase-Profil vorhanden ist. Bitte passe die Policies für "profiles" an.'
        );
      }

      const session = await ensureSession();
      await ensureProfileForSession(session, {
        displayName: currentUser.name,
        email: currentUser.email
      });

      const nextAgents = currentUser.agents.map((agent) =>
        agent.id === agentId
          ? sanitizeAgent({
              ...agent,
              ...updates,
              name: updates.name?.trim() ?? agent.name,
              description: updates.description ?? agent.description,
              avatarUrl: updates.avatarUrl ?? agent.avatarUrl,
              tools: updates.tools ?? agent.tools,
              webhookUrl: updates.webhookUrl ?? agent.webhookUrl
            })
          : agent
      );

      const updatedUser = await persistAgents(currentUser.id, nextAgents);

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, persistAgents, updateUsersState]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      if (!currentUser.hasRemoteProfile) {
        throw new Error(
          'Agents können nicht gelöscht werden, solange kein Supabase-Profil existiert. Bitte prüfe die Policies für "profiles".'
        );
      }

      const session = await ensureSession();
      await ensureProfileForSession(session, {
        displayName: currentUser.name,
        email: currentUser.email
      });

      const nextAgents = currentUser.agents.filter((agent) => agent.id !== agentId);

      const updatedUser = await persistAgents(currentUser.id, nextAgents);

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, persistAgents, updateUsersState]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      if (currentUser.role !== 'admin') {
        throw new Error('Nur Administratoren können Nutzer aktivieren oder deaktivieren.');
      }

      if (!currentUser.hasRemoteProfile) {
        throw new Error(
          'Nutzerstatus kann nicht geändert werden, solange kein Supabase-Profil vorhanden ist. Bitte ergänze passende Policies für "profiles".'
        );
      }

      const session = await ensureSession();
      await ensureProfileForSession(session, {
        displayName: currentUser.name,
        email: currentUser.email
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .maybeSingle<ProfileRow>();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return;
      }

      const updatedUser = mapRowToAuthUser(data);
      updateUsersState(updatedUser);

      if (updatedUser.id === currentUser.id) {
        setCurrentUser(updatedUser);
        if (!nextActive) {
          await supabase.auth.signOut();
        }
      }
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
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
    [
      addAgent,
      currentUser,
      isLoading,
      login,
      logout,
      register,
      removeAgent,
      toggleUserActive,
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
