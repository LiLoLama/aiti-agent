import { AgentDraft, AgentProfile, AgentUpdatePayload, AuthUser } from '../types/auth';

export interface ProfileRow {
  id: number;
  name: string | null;
  mail: string | null;
  zugang: boolean | null;
  agent_anzahl: number | null;
  agent_beschreibung: string | null;
  created_at?: string | null;
  admin: boolean | null;
}

export interface ProfileMetadata {
  bio: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  agents: AgentProfile[];
}

const createAgentId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `agent-${Math.random().toString(36).slice(2, 10)}`;

export const sanitizeAgent = (agent: AgentProfile): AgentProfile => ({
  ...agent,
  id: agent.id || createAgentId(),
  name: agent.name?.trim() && agent.name.trim().length > 0 ? agent.name.trim() : 'Unbenannter Agent',
  description: agent.description?.trim() ?? '',
  avatarUrl: agent.avatarUrl ?? null,
  tools: Array.isArray(agent.tools)
    ? agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0)
    : [],
  webhookUrl: agent.webhookUrl?.trim() ?? ''
});

const metadataDefaults: ProfileMetadata = {
  bio: '',
  avatarUrl: null,
  emailVerified: false,
  agents: []
};

export const parseMetadata = (value: string | null): ProfileMetadata => {
  if (!value) {
    return {
      bio: metadataDefaults.bio,
      avatarUrl: metadataDefaults.avatarUrl,
      emailVerified: metadataDefaults.emailVerified,
      agents: []
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<ProfileMetadata>;
    return {
      bio: parsed.bio ?? '',
      avatarUrl: parsed.avatarUrl ?? null,
      emailVerified: parsed.emailVerified ?? false,
      agents: Array.isArray(parsed.agents)
        ? parsed.agents.map((agent) => sanitizeAgent(agent as AgentProfile))
        : []
    };
  } catch (error) {
    console.warn('Konnte Profildaten nicht parsen, verwende Standardwerte.', error);
    return {
      bio: metadataDefaults.bio,
      avatarUrl: metadataDefaults.avatarUrl,
      emailVerified: metadataDefaults.emailVerified,
      agents: []
    };
  }
};

export const serializeMetadata = (metadata: Partial<ProfileMetadata>): string => {
  const merged: ProfileMetadata = {
    bio: metadata.bio ?? metadataDefaults.bio,
    avatarUrl: metadata.avatarUrl ?? metadataDefaults.avatarUrl,
    emailVerified: metadata.emailVerified ?? metadataDefaults.emailVerified,
    agents: Array.isArray(metadata.agents)
      ? metadata.agents.map((agent) => sanitizeAgent(agent))
      : []
  };

  return JSON.stringify(merged);
};

export const mapProfileRowToAuthUser = (row: ProfileRow): AuthUser => {
  const metadata = parseMetadata(row.agent_beschreibung ?? null);

  return {
    id: String(row.id),
    name: row.name?.trim() ?? 'Unbenannter Nutzer',
    email: row.mail?.toLowerCase() ?? '',
    role: row.admin ? 'admin' : 'user',
    isActive: row.zugang ?? false,
    avatarUrl: metadata.avatarUrl,
    emailVerified: metadata.emailVerified,
    agents: metadata.agents,
    bio: metadata.bio
  };
};

export const createProfileInsertPayload = (payload: {
  name: string;
  email: string;
  isActive?: boolean;
  role?: 'user' | 'admin';
}) => ({
  name: payload.name,
  mail: payload.email,
  zugang: payload.isActive ?? true,
  admin: payload.role === 'admin',
  agent_anzahl: 0,
  agent_beschreibung: serializeMetadata({ agents: [], bio: '', avatarUrl: null, emailVerified: false })
});

export const buildProfileUpdate = (current: AuthUser, updates: Partial<{
  name: string;
  bio: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  agents: AgentProfile[];
  isActive: boolean;
  role: 'user' | 'admin';
}>) => {
  const metadata = serializeMetadata({
    bio: updates.bio ?? current.bio ?? '',
    avatarUrl: updates.avatarUrl ?? current.avatarUrl ?? null,
    emailVerified: updates.emailVerified ?? current.emailVerified,
    agents: updates.agents ?? current.agents
  });

  return {
    name: updates.name ?? current.name,
    mail: current.email,
    zugang: updates.isActive ?? current.isActive,
    admin: (updates.role ?? current.role) === 'admin',
    agent_anzahl: (updates.agents ?? current.agents).length,
    agent_beschreibung: metadata
  };
};

export const applyAgentMutation = (
  agents: AgentProfile[],
  mutation: (current: AgentProfile[]) => AgentProfile[]
) => mutation(agents).map((agent) => sanitizeAgent(agent));

export const addAgentToList = (agents: AgentProfile[], draft: AgentDraft): AgentProfile[] => {
  const sanitizedDraft: AgentProfile = sanitizeAgent({
    id: createAgentId(),
    name: draft.name,
    description: draft.description,
    avatarUrl: draft.avatarUrl,
    tools: draft.tools,
    webhookUrl: draft.webhookUrl
  });

  return [...agents, sanitizedDraft];
};

export const updateAgentInList = (
  agents: AgentProfile[],
  agentId: string,
  updates: AgentUpdatePayload
): AgentProfile[] =>
  agents.map((agent) => (agent.id === agentId ? sanitizeAgent({ ...agent, ...updates, id: agent.id }) : agent));

export const removeAgentFromList = (agents: AgentProfile[], agentId: string): AgentProfile[] =>
  agents.filter((agent) => agent.id !== agentId);
