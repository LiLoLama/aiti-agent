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
import {
  deleteAgentForProfile,
  fetchAgentProfilesForProfile,
  fetchAgentProfilesForProfiles,
  saveAgentMetadataForProfile
} from '../services/chatService';
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

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  created_at: string | null;
  updated_at: string | null;
  bio: string | null;
  email_verified: string | null;
  is_active: boolean | null;
  name: string | null;
};

const isRowLevelSecurityError = (error: PostgrestError) =>
  error.message.toLowerCase().includes('row-level security');

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

const mapRowToAuthUser = (row: ProfileRow, agents: AgentProfile[], overrideName?: string): AuthUser => ({
  id: row.id,
  name: resolveDisplayName(row, row.email, overrideName),
  email: row.email ?? '',
  role: row.role ?? 'user',
  isActive: row.is_active ?? true,
  avatarUrl: row.avatar_url,
  emailVerified: (row.email_verified ?? '').toLowerCase() === 'true',
  agents,
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
    bio: '',
    email_verified: session.user.email_confirmed_at ? 'true' : 'false',
    is_active: true
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastSessionAccessTokenRef = useRef<string | null>(null);

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

  const loadAgentsForProfile = useCallback(async (profileId: string): Promise<AgentProfile[]> => {
    try {
      const agents = await fetchAgentProfilesForProfile(profileId);
      return agents.map(sanitizeAgentProfile);
    } catch (error) {
      console.error('Agents konnten nicht geladen werden.', error);
      return [];
    }
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
        const agents = await loadAgentsForProfile(existing.id);
        return mapRowToAuthUser(existing, agents, options?.displayName);
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

      const agents = await loadAgentsForProfile(inserted.id);
      return mapRowToAuthUser(inserted, agents, options?.displayName);
    },
    [loadAgentsForProfile]
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
    const profileIds = rows.map((row) => row.id);
    let agentsByProfile: Record<string, AgentProfile[]> = {};

    try {
      agentsByProfile = await fetchAgentProfilesForProfiles(profileIds);
    } catch (error) {
      console.error('Agents konnten nicht geladen werden.', error);
    }

    return rows.map((row: ProfileRow) => mapRowToAuthUser(row, agentsByProfile[row.id] ?? []));
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
      lastSessionAccessTokenRef.current = session?.access_token ?? null;
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
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'TOKEN_REFRESHED') {
          lastSessionAccessTokenRef.current = session?.access_token ?? null;
          return;
        }

        if (
          session?.access_token === lastSessionAccessTokenRef.current &&
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
        ) {
          return;
        }

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

      const updatedUser = mapRowToAuthUser(data, currentUser.agents);
      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
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

      const newAgent: AgentProfile = sanitizeAgentProfile({
        id: createAgentId(),
        name: trimmedName,
        description: agent.description,
        avatarUrl: agent.avatarUrl ?? null,
        tools: agent.tools,
        webhookUrl: agent.webhookUrl
      });

      await saveAgentMetadataForProfile(currentUser.id, newAgent);

      const updatedUser: AuthUser = {
        ...currentUser,
        agents: [...currentUser.agents, newAgent]
      };

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
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

      const targetAgent = currentUser.agents.find((agent) => agent.id === agentId);
      if (!targetAgent) {
        throw new Error('Agent wurde nicht gefunden.');
      }

      const updatedAgent = sanitizeAgentProfile({
        ...targetAgent,
        ...updates,
        name: updates.name ?? targetAgent.name,
        description: updates.description ?? targetAgent.description,
        avatarUrl: updates.avatarUrl ?? targetAgent.avatarUrl,
        tools: updates.tools ?? targetAgent.tools,
        webhookUrl: updates.webhookUrl ?? targetAgent.webhookUrl
      });

      await saveAgentMetadataForProfile(currentUser.id, updatedAgent);

      const nextAgents = currentUser.agents.map((agent) =>
        agent.id === agentId ? updatedAgent : agent
      );

      const updatedUser: AuthUser = {
        ...currentUser,
        agents: nextAgents
      };

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
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

      await deleteAgentForProfile(currentUser.id, agentId);

      const nextAgents = currentUser.agents.filter((agent) => agent.id !== agentId);
      const updatedUser: AuthUser = {
        ...currentUser,
        agents: nextAgents
      };

      setCurrentUser(updatedUser);
      updateUsersState(updatedUser);
    },
    [currentUser, ensureProfileForSession, ensureSession, updateUsersState]
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

      const existingAgents =
        userId === currentUser.id
          ? currentUser.agents
          : users.find((user) => user.id === userId)?.agents ?? [];
      const updatedUser = mapRowToAuthUser(data, existingAgents);
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
