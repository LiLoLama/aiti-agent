export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  agentsBuilt: number;
  avatarUrl: string | null;
  emailVerified: boolean;
  bio?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationPayload {
  name: string;
  email: string;
  password: string;
}

export type ProfileUpdatePayload = Partial<
  Pick<AuthUser, 'name' | 'avatarUrl' | 'bio'> & { emailVerified?: boolean }
>;
