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
  AgentUpdatePayload,
  AuthCredentials,
  AuthUser,
  ProfileUpdatePayload,
  RegistrationPayload
} from '../types/auth';
import { supabase } from '../lib/supabaseClient';
import {
  addAgentToList,
  buildProfileUpdate,
  createProfileInsertPayload,
  mapProfileRowToAuthUser,
  removeAgentFromList,
  updateAgentInList
} from '../utils/supabaseProfiles';
import type { ProfileRow } from '../utils/supabaseProfiles';

interface AuthContextValue {
  currentUser: AuthUser | null;
  users: AuthUser[];
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  toggleUserActive: (userId: string, nextActive: boolean) => Promise<void>;
  addAgent: (agent: AgentDraft) => Promise<void>;
  updateAgent: (agentId: string, updates: AgentUpdatePayload) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILES_TABLE = 'profiles';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const resolveIdentifier = (identifier: string) => {
  const numericId = Number(identifier);
  return Number.isNaN(numericId) ? identifier : numericId;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const refreshProfiles = useCallback(
    async (activeEmail: string | null = sessionEmail) => {
      const { data, error } = await supabase
        .from(PROFILES_TABLE)
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Profile konnten nicht geladen werden.', error);
        throw new Error('Profile konnten nicht geladen werden.');
      }

      const mappedUsers = (data ?? []).map((row) => mapProfileRowToAuthUser(row as ProfileRow));
      setUsers(mappedUsers);

      const email = activeEmail ? normalizeEmail(activeEmail) : null;
      if (email) {
        setCurrentUser(mappedUsers.find((user) => user.email === email) ?? null);
      } else {
        setCurrentUser(null);
      }

      return mappedUsers;
    },
    [sessionEmail]
  );

  useEffect(() => {
    let isMounted = true;

    const initialise = async () => {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Supabase Session konnte nicht geladen werden.', error);
        return;
      }

      if (!isMounted) {
        return;
      }

      const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
      setSessionEmail(email);

      if (email) {
        try {
          await refreshProfiles(email);
        } catch (loadError) {
          console.error(loadError);
        }
      } else {
        setCurrentUser(null);
      }
    };

    initialise();

    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => {
      const email = nextSession?.user?.email ? normalizeEmail(nextSession.user.email) : null;
      setSessionEmail(email);

      if (email) {
        refreshProfiles(email).catch((error) => {
          console.error('Profile konnten nach Auth-Änderung nicht geladen werden.', error);
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [refreshProfiles]);

  const ensureProfileForEmail = useCallback(
    async (email: string, fallbackName: string | null = null) => {
      const normalizedEmail = normalizeEmail(email);
      const existingUsers = await refreshProfiles(normalizedEmail).catch(() => null);

      if (existingUsers && existingUsers.some((user) => user.email === normalizedEmail)) {
        return;
      }

      const insertPayload = createProfileInsertPayload({
        name: fallbackName?.trim() && fallbackName.trim().length > 0 ? fallbackName.trim() : normalizedEmail,
        email: normalizedEmail,
        isActive: true,
        role: 'user'
      });

      const { error } = await supabase.from(PROFILES_TABLE).insert(insertPayload);

      if (error) {
        console.error('Profil konnte nicht angelegt werden.', error);
        throw new Error('Profil konnte nicht angelegt werden.');
      }

      await refreshProfiles(normalizedEmail);
    },
    [refreshProfiles]
  );

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      setSessionEmail(normalizedEmail);

      const fallbackName = data.user?.user_metadata?.name ?? normalizedEmail;
      await ensureProfileForEmail(normalizedEmail, fallbackName);
    },
    [ensureProfileForEmail]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const trimmedName = name.trim();
      const normalizedEmail = normalizeEmail(email);

      if (!trimmedName) {
        throw new Error('Bitte gib einen Namen an.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: trimmedName }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const insertPayload = createProfileInsertPayload({
        name: trimmedName,
        email: normalizedEmail,
        isActive: true,
        role: 'user'
      });

      const { error: insertError } = await supabase.from(PROFILES_TABLE).insert(insertPayload);

      if (insertError) {
        console.error('Profil konnte nicht angelegt werden.', insertError);
        throw new Error('Profil konnte nicht angelegt werden.');
      }

      const sessionUserEmail = data.user?.email ? normalizeEmail(data.user.email) : null;
      if (sessionUserEmail) {
        setSessionEmail(sessionUserEmail);
        await refreshProfiles(sessionUserEmail);
      } else {
        await refreshProfiles();
      }
    },
    [refreshProfiles]
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }

    setCurrentUser(null);
    setSessionEmail(null);
    setUsers([]);
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      const trimmedName = updates.name?.trim();
      const updatePayload = buildProfileUpdate(currentUser, {
        name: trimmedName ?? currentUser.name,
        bio: updates.bio ?? currentUser.bio ?? '',
        avatarUrl: updates.avatarUrl ?? currentUser.avatarUrl ?? null,
        emailVerified: updates.emailVerified ?? currentUser.emailVerified
      });

      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update(updatePayload)
        .eq('id', resolveIdentifier(currentUser.id));

      if (error) {
        console.error('Profil konnte nicht aktualisiert werden.', error);
        throw new Error('Profil konnte nicht aktualisiert werden.');
      }

      await refreshProfiles(currentUser.email);
    },
    [currentUser, refreshProfiles]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update({ zugang: nextActive })
        .eq('id', resolveIdentifier(userId));

      if (error) {
        console.error('Zugangsstatus konnte nicht angepasst werden.', error);
        throw new Error('Zugangsstatus konnte nicht angepasst werden.');
      }

      await refreshProfiles(sessionEmail);
    },
    [refreshProfiles, sessionEmail]
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      const nextAgents = addAgentToList(currentUser.agents, agent);
      const updatePayload = buildProfileUpdate(currentUser, {
        agents: nextAgents
      });

      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update(updatePayload)
        .eq('id', resolveIdentifier(currentUser.id));

      if (error) {
        console.error('Agent konnte nicht angelegt werden.', error);
        throw new Error('Agent konnte nicht angelegt werden.');
      }

      await refreshProfiles(currentUser.email);
    },
    [currentUser, refreshProfiles]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      const nextAgents = updateAgentInList(currentUser.agents, agentId, updates);
      const updatePayload = buildProfileUpdate(currentUser, { agents: nextAgents });

      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update(updatePayload)
        .eq('id', resolveIdentifier(currentUser.id));

      if (error) {
        console.error('Agent konnte nicht aktualisiert werden.', error);
        throw new Error('Agent konnte nicht aktualisiert werden.');
      }

      await refreshProfiles(currentUser.email);
    },
    [currentUser, refreshProfiles]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      const nextAgents = removeAgentFromList(currentUser.agents, agentId);
      const updatePayload = buildProfileUpdate(currentUser, { agents: nextAgents });

      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update(updatePayload)
        .eq('id', resolveIdentifier(currentUser.id));

      if (error) {
        console.error('Agent konnte nicht entfernt werden.', error);
        throw new Error('Agent konnte nicht entfernt werden.');
      }

      await refreshProfiles(currentUser.email);
    },
    [currentUser, refreshProfiles]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      users,
      login,
      register,
      logout,
      updateProfile,
      toggleUserActive,
      addAgent,
      updateAgent,
      removeAgent
    }),
    [addAgent, currentUser, login, logout, register, removeAgent, toggleUserActive, updateAgent, updateProfile, users]
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
