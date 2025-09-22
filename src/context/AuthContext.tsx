import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { supabase } from '../utils/supabase';
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
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  toggleUserActive: (userId: string, nextActive: boolean) => Promise<void>;
  addAgent: (agent: AgentDraft) => Promise<void>;
  updateAgent: (agentId: string, updates: AgentUpdatePayload) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole | null;
  is_active: boolean | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  bio: string | null;
}

const mapProfile = (row: ProfileRow, agents: AgentProfile[] = []): AuthUser => ({
  id: row.id,
  name: row.name?.trim() || row.email,
  email: row.email,
  role: row.role ?? 'user',
  isActive: row.is_active ?? true,
  avatarUrl: row.avatar_url,
  emailVerified: row.email_verified ?? false,
  agents,
  bio: row.bio ?? undefined
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(
    async (userId: string): Promise<AuthUser | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Profil konnte nicht geladen werden: ${error.message}`);
      }

      return mapProfile(data as ProfileRow, []);
    },
    []
  );

  const fetchAllUsers = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*');

    if (error) {
      throw new Error(`Nutzerliste konnte nicht geladen werden: ${error.message}`);
    }

    const profiles = (data as ProfileRow[]) ?? [];
    return profiles.map((profile) => mapProfile(profile, []));
  }, []);

  const refreshState = useCallback(
    async (shouldLoadUsers = true) => {
      setIsLoading(true);
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        const authUser = session?.user ?? null;

        if (!authUser) {
          setCurrentUser(null);
          setUsers([]);
          return;
        }

        const profile = await fetchProfile(authUser.id);

        if (!profile) {
          const name =
            typeof authUser.user_metadata?.name === 'string'
              ? authUser.user_metadata.name
              : authUser.email ?? 'Neuer Nutzer';

          const { error } = await supabase.from('profiles').insert({
            id: authUser.id,
            email: authUser.email,
            name,
            role: 'user',
            is_active: true,
            avatar_url: null,
            email_verified: Boolean(authUser.email_confirmed_at),
            bio: null
          });

          if (error) {
            throw new Error(`Profil konnte nicht erstellt werden: ${error.message}`);
          }

          const newProfile = await fetchProfile(authUser.id);
          setCurrentUser(newProfile);
          if (shouldLoadUsers && newProfile?.role === 'admin') {
            setUsers(await fetchAllUsers());
          } else {
            setUsers([]);
          }
          return;
        }

        setCurrentUser(profile);

        if (shouldLoadUsers && profile.role === 'admin') {
          setUsers(await fetchAllUsers());
        } else {
          setUsers([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [fetchAllUsers, fetchProfile]
  );

  useEffect(() => {
    refreshState().catch((error) => {
      console.error(error);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      refreshState().catch((error) => {
        console.error(error);
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshState]);

  const login = useCallback(
    async ({ email, password }: AuthCredentials) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Anmeldung fehlgeschlagen.');
      }

      const profile = await fetchProfile(user.id);

      if (profile && !profile.isActive) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        throw new Error('Dein Zugang ist aktuell deaktiviert. Bitte kontaktiere das Admin-Team.');
      }

      await refreshState();
    },
    [fetchProfile, refreshState]
  );

  const register = useCallback(
    async ({ name, email, password }: RegistrationPayload) => {
      const trimmedName = name.trim();
      const normalizedEmail = email.toLowerCase().trim();

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

      const user = data.user;
      if (!user) {
        throw new Error('Registrierung fehlgeschlagen.');
      }

      if (data.session) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: normalizedEmail,
          name: trimmedName,
          role: 'user',
          is_active: true,
          avatar_url: null,
          email_verified: Boolean(user.email_confirmed_at),
          bio: null
        });

        if (profileError && profileError.code !== '42501') {
          throw new Error(`Profil konnte nicht gespeichert werden: ${profileError.message}`);
        }

        if (profileError?.code === '42501') {
          console.info(
            'Profile-Insert aufgrund von RLS verweigert. Profil wird beim nächsten Login automatisch angelegt.'
          );
        }
      } else {
        console.info(
          'Keine aktive Session nach Registrierung – Profilanlage wird auf den ersten Login verschoben.'
        );
      }

      await refreshState(false);
    },
    [refreshState]
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    setCurrentUser(null);
    setUsers([]);
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      const payload: Record<string, unknown> = {};

      if (typeof updates.name === 'string') {
        payload.name = updates.name.trim();
      }

      if (typeof updates.bio === 'string') {
        payload.bio = updates.bio;
      }

      if ('avatarUrl' in updates) {
        payload.avatar_url = updates.avatarUrl ?? null;
      }

      if ('emailVerified' in updates) {
        payload.email_verified = updates.emailVerified ?? false;
      }

      if (Object.keys(payload).length === 0) {
        return;
      }

      const { error } = await supabase.from('profiles').update(payload).eq('id', currentUser.id);

      if (error) {
        throw new Error(`Profil konnte nicht aktualisiert werden: ${error.message}`);
      }

      if (typeof updates.name === 'string' && updates.name.trim()) {
        await supabase.auth.updateUser({ data: { name: updates.name.trim() } });
      }

      await refreshState();
    },
    [currentUser, refreshState]
  );

  const addAgent = useCallback(
    async (agent: AgentDraft) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      console.warn('Agent-Verwaltung ist deaktiviert, da keine agents-Tabelle konfiguriert ist.', agent);
      throw new Error('Agent-Verwaltung ist in dieser Supabase-Konfiguration nicht verfügbar.');
    },
    [currentUser]
  );

  const updateAgent = useCallback(
    async (agentId: string, updates: AgentUpdatePayload) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      console.warn('Agent-Verwaltung ist deaktiviert, Update-Anfrage ignoriert.', agentId, updates);
      throw new Error('Agent-Verwaltung ist in dieser Supabase-Konfiguration nicht verfügbar.');
    },
    [currentUser]
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!currentUser) {
        throw new Error('Kein Nutzer angemeldet.');
      }

      console.warn('Agent-Verwaltung ist deaktiviert, Lösch-Anfrage ignoriert.', agentId);
      throw new Error('Agent-Verwaltung ist in dieser Supabase-Konfiguration nicht verfügbar.');
    },
    [currentUser]
  );

  const toggleUserActive = useCallback(
    async (userId: string, nextActive: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: nextActive })
        .eq('id', userId);

      if (error) {
        throw new Error(`Nutzerstatus konnte nicht geändert werden: ${error.message}`);
      }

      if (currentUser && currentUser.id === userId && !nextActive) {
        await logout();
        return;
      }

      await refreshState();
    },
    [currentUser, logout, refreshState]
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
      updateAgent,
      updateProfile,
      toggleUserActive,
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
