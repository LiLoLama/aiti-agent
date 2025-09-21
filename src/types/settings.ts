export type AgentAuthType = 'none' | 'apiKey' | 'basic' | 'oauth';

export interface AgentSettings {
  profileName: string;
  profileRole: string;
  profileAvatarImage: string | null;
  agentAvatarImage: string | null;
  webhookUrl: string;
  authType: AgentAuthType;
  apiKey?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  oauthToken?: string;
  responseFormat: 'text' | 'json';
  pushToTalkEnabled: boolean;
  colorScheme: 'light' | 'dark';
  chatBackgroundImage: string | null;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  profileName: 'Max Mustermann',
  profileRole: 'AI Operations Lead',
  profileAvatarImage: null,
  agentAvatarImage: null,
  webhookUrl: '',
  authType: 'none',
  responseFormat: 'text',
  pushToTalkEnabled: true,
  colorScheme: 'dark',
  chatBackgroundImage: null
};
