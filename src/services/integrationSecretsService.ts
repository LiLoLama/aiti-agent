import { AgentAuthType, AgentSettings } from '../types/settings';
import { supabase } from '../utils/supabase';

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

const isAgentAuthType = (value: unknown): value is AgentAuthType =>
  value === 'none' || value === 'apiKey' || value === 'basic' || value === 'oauth';

const INTEGRATION_SECRET_COLUMNS =
  'id, profile_id, webhook_url, auth_type, api_key, basic_username, basic_password, oauth_token, created_at, updated_at';

export async function fetchIntegrationSecret(profileId: string): Promise<IntegrationSecretRecord | null> {
  const { data, error } = await supabase
    .from('integration_secrets')
    .select(INTEGRATION_SECRET_COLUMNS)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as IntegrationSecretRecord | null) ?? null;
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
  const prepared = {
    profile_id: payload.profileId,
    webhook_url: payload.webhookUrl,
    auth_type: payload.authType,
    api_key: payload.authType === 'apiKey' ? payload.apiKey ?? null : null,
    basic_username: payload.authType === 'basic' ? payload.basicAuthUsername ?? null : null,
    basic_password: payload.authType === 'basic' ? payload.basicAuthPassword ?? null : null,
    oauth_token: payload.authType === 'oauth' ? payload.oauthToken ?? null : null,
    updated_at: timestamp
  };

  const { data, error } = await supabase
    .from('integration_secrets')
    .upsert(prepared, { onConflict: 'profile_id' })
    .select(INTEGRATION_SECRET_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as IntegrationSecretRecord;
}
