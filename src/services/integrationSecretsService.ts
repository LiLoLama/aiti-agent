import { AgentAuthType, AgentSettings } from '../types/settings';

export interface IntegrationSecretRecord {
  id: string;
  profile_id: string;
  webhook_url: string | null;
  auth_type: string | null;
  api_key: string | null;
  basic_username: string | null;
  basic_password: string | null;
  oauth_token: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const STORAGE_KEY = 'aiti-integration-secrets-v1';

interface SecretsStore {
  records: IntegrationSecretRecord[];
}

const DEFAULT_STORE: SecretsStore = {
  records: []
};

const readStore = (): SecretsStore => {
  if (typeof window === 'undefined') {
    return DEFAULT_STORE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STORE;
  }

  try {
    const parsed = JSON.parse(raw) as SecretsStore;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
      return DEFAULT_STORE;
    }

    return {
      records: parsed.records
    };
  } catch (error) {
    console.warn('Integrations-Secrets konnten nicht gelesen werden.', error);
    return DEFAULT_STORE;
  }
};

const writeStore = (store: SecretsStore) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Integrations-Secrets konnten nicht gespeichert werden.', error);
  }
};

const isAgentAuthType = (value: unknown): value is AgentAuthType =>
  value === 'none' || value === 'apiKey' || value === 'basic' || value === 'oauth';

export async function fetchIntegrationSecret(profileId: string): Promise<IntegrationSecretRecord | null> {
  const store = readStore();
  const record = store.records.find((entry) => entry.profile_id === profileId);
  return record ?? null;
}

export const applyIntegrationSecretToSettings = (
  settings: AgentSettings,
  record: IntegrationSecretRecord | null
): AgentSettings => {
  if (!record) {
    return {
      ...settings,
      webhookUrl: settings.webhookUrl ?? '',
      authType: settings.authType ?? 'none',
      apiKey: undefined,
      basicAuthUsername: undefined,
      basicAuthPassword: undefined,
      oauthToken: undefined
    };
  }

  const authType = isAgentAuthType(record.auth_type) ? record.auth_type : 'none';

  return {
    ...settings,
    webhookUrl: record.webhook_url?.trim() ?? '',
    authType,
    apiKey: authType === 'apiKey' ? record.api_key ?? undefined : undefined,
    basicAuthUsername: authType === 'basic' ? record.basic_username ?? undefined : undefined,
    basicAuthPassword: authType === 'basic' ? record.basic_password ?? undefined : undefined,
    oauthToken: authType === 'oauth' ? record.oauth_token ?? undefined : undefined
  };
};

export interface UpsertIntegrationSecretPayload {
  profileId: string;
  webhookUrl: string;
  authType: AgentAuthType;
  apiKey?: string | null;
  basicAuthUsername?: string | null;
  basicAuthPassword?: string | null;
  oauthToken?: string | null;
}

export async function upsertIntegrationSecret(
  payload: UpsertIntegrationSecretPayload
): Promise<IntegrationSecretRecord> {
  const timestamp = new Date().toISOString();

  const prepared: IntegrationSecretRecord = {
    id: payload.profileId,
    profile_id: payload.profileId,
    webhook_url: payload.webhookUrl,
    auth_type: payload.authType,
    api_key: payload.authType === 'apiKey' ? payload.apiKey ?? null : null,
    basic_username: payload.authType === 'basic' ? payload.basicAuthUsername ?? null : null,
    basic_password: payload.authType === 'basic' ? payload.basicAuthPassword ?? null : null,
    oauth_token: payload.authType === 'oauth' ? payload.oauthToken ?? null : null,
    created_at: timestamp,
    updated_at: timestamp
  };

  const store = readStore();
  const existingIndex = store.records.findIndex((entry) => entry.profile_id === payload.profileId);

  if (existingIndex >= 0) {
    store.records[existingIndex] = {
      ...store.records[existingIndex],
      ...prepared,
      created_at: store.records[existingIndex].created_at ?? prepared.created_at,
      updated_at: timestamp
    };
  } else {
    store.records.push(prepared);
  }

  writeStore(store);

  return store.records.find((entry) => entry.profile_id === payload.profileId) ?? prepared;
}
