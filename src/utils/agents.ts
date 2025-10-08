import type { AgentProfile } from '../types/auth';

const getCrypto = () => (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);

export const sanitizeAgentProfile = (agent: AgentProfile): AgentProfile => ({
  ...agent,
  name: agent.name.trim(),
  description: agent.description.trim(),
  avatarUrl: agent.avatarUrl ?? null,
  tools: agent.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0),
  webhookUrl: agent.webhookUrl.trim()
});

export const createAgentId = () => {
  const cryptoApi = getCrypto();
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  return `agent-${Math.random().toString(36).slice(2, 10)}`;
};
