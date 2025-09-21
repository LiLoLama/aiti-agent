export type AgentAuthType = 'none' | 'apiKey' | 'basic' | 'oauth';

export interface AgentSettings {
  profileName: string;
  profileRole: string;
  webhookUrl: string;
  authType: AgentAuthType;
  apiKey?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  oauthToken?: string;
  responseFormat: 'text' | 'json';
  pushToTalkEnabled: boolean;
  colorScheme: string;
  chatBackgroundImage?: string | null;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  profileName: 'Max Mustermann',
  profileRole: 'AI Operations Lead',
  webhookUrl: '',
  authType: 'none',
  responseFormat: 'text',
  pushToTalkEnabled: true,
  colorScheme: '#212121',
  chatBackgroundImage: null
};
