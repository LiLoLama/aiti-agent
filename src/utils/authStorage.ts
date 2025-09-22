import { AuthUser } from '../types/auth';

type StoredUser = AuthUser & { password: string };

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
    agentsBuilt: 12,
    avatarUrl: null,
    emailVerified: true,
    bio: 'Verwaltet den AITI Explorer Agent.'
  },
  {
    id: 'user-001',
    name: 'Svenja Beispiel',
    email: 'svenja@example.com',
    password: 'passwort123',
    role: 'user',
    isActive: true,
    agentsBuilt: 4,
    avatarUrl: null,
    emailVerified: true,
    bio: 'Produktmanagerin mit Fokus auf Automatisierungen.'
  },
  {
    id: 'user-002',
    name: 'Lukas Demo',
    email: 'lukas@example.com',
    password: 'passwort123',
    role: 'user',
    isActive: false,
    agentsBuilt: 1,
    avatarUrl: null,
    emailVerified: false,
    bio: 'Experimentiert gerade mit eigenen Agenten.'
  }
];

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
    return [...defaultUsers];
  }

  const stored = window.localStorage.getItem(USERS_KEY);
  const users = safeParse<StoredUser[]>(stored, defaultUsers);

  if (!stored) {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  return users;
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
