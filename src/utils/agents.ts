import type { AgentProfile } from '../types/auth';

const getCrypto = () => (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);

const formatUuidFromBytes = (bytes: Uint8Array) => {
  const hex: string[] = [];
  bytes.forEach((value, index) => {
    if (index === 6) {
      // Version 4 UUID: high nibble 0100
      hex.push(((value & 0x0f) | 0x40).toString(16).padStart(2, '0'));
    } else if (index === 8) {
      // Variant 1 UUID: high bits 10xx
      hex.push(((value & 0x3f) | 0x80).toString(16).padStart(2, '0'));
    } else {
      hex.push(value.toString(16).padStart(2, '0'));
    }
  });

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
};

const fallbackUuid = () => {
  const cryptoApi = getCrypto();
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return formatUuidFromBytes(bytes);
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return formatUuidFromBytes(bytes);
};

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

  return fallbackUuid();
};
