import type { KeyValidationResult } from './types.js';
import { getProvider } from '../providers/registry.js';

export function validateKey(providerId: string, key: string): KeyValidationResult {
  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, provider: providerId, message: `Unknown provider: ${providerId}. Run /keys add to see available providers.` };
  }
  if (!provider.requiresKey) {
    return { valid: true, provider: providerId, message: 'No key required for this provider.' };
  }
  if (!key || key.trim().length === 0) {
    return { valid: false, provider: providerId, message: 'Key cannot be empty.' };
  }
  return { valid: true, provider: providerId, message: `Key accepted for ${provider.displayName}.` };
}

export async function testKey(providerId: string, key: string): Promise<KeyValidationResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, provider: providerId, message: `Unknown provider: ${providerId}` };
  }

  const formatResult = validateKey(providerId, key);
  if (!formatResult.valid) return formatResult;

  const apiKey = provider.apiKeyFormat.replace('{key}', key.trim());
  const headers: Record<string, string> = {
    [provider.apiKeyHeader]: apiKey,
    'Content-Type': 'application/json',
  };
  if (provider.extraHeaders) {
    Object.assign(headers, provider.extraHeaders);
  }

  const defaultModel = provider.models.find(m => m.isFree) ?? provider.models[0];
  if (!defaultModel) {
    return { valid: false, provider: providerId, message: 'No free model available for testing' };
  }

  return fetch(`${provider.baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: defaultModel.id,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(10000),
  })
    .then(async (res) => {
      if (res.status === 200) {
        return { valid: true, provider: providerId, message: `Key is valid! Using ${defaultModel.displayName}` };
      }
      if (res.status === 401 || res.status === 403) {
        const body = await res.text().catch(() => '');
        return { valid: false, provider: providerId, message: `Invalid key: ${body.slice(0, 100)}` };
      }
      return { valid: true, provider: providerId, message: `Key appears valid (status ${res.status}), using ${defaultModel.displayName}` };
    })
    .catch((err: Error) => ({
      valid: false,
      provider: providerId,
      message: `Connection failed: ${err.message}`,
    }));
}
