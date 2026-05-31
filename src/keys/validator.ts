import type { ProviderKeyInfo, KeyValidationResult } from './types.js';
import { getProvider } from '../providers/registry.js';

export function validateKey(providerId: string, key: string): KeyValidationResult {
  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, provider: providerId, message: `Unknown provider: ${providerId}` };
  }

  if (provider.requiresKey && (!key || key.trim().length === 0)) {
    return { valid: false, provider: providerId, message: `Key is required for ${provider.displayName}` };
  }

  for (const [envProvider, pattern] of Object.entries(PROVIDER_KEY_PATTERNS)) {
    if (envProvider === providerId && pattern) {
      if (!pattern.test(key.trim())) {
        return {
          valid: false,
          provider: providerId,
          message: `Key format doesn't match expected pattern for ${provider.displayName}. Expected format like: ${pattern}`,
        };
      }
    }
  }

  return { valid: true, provider: providerId, message: 'Key format looks valid' };
}

const PROVIDER_KEY_PATTERNS: Record<string, RegExp> = {
  groq: /^gsk_/,
  gemini: /^AIza/,
  cerebras: /^csk-/,
  sambanova: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  openrouter: /^sk-or-/,
  github_models: /^ghp_/,
  nvidia_nim: /^nvapi-/,
  mistral: /^[a-zA-Z0-9]{16,}$/,
  cohere: /^[a-zA-Z0-9]{32,}$/,
  fireworks: /^fw_/,
};

export function testKey(providerId: string, key: string): Promise<KeyValidationResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return Promise.resolve({ valid: false, provider: providerId, message: `Unknown provider: ${providerId}` });
  }

  const formatResult = validateKey(providerId, key);
  if (!formatResult.valid) return Promise.resolve(formatResult);

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
    return Promise.resolve({ valid: false, provider: providerId, message: 'No free model available for testing' });
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
