import type { ProviderDefinition } from './types.js';

export const PROVIDERS: Record<string, ProviderDefinition> = {

  groq: {
    id: 'groq',
    displayName: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        displayName: 'Llama 3.3 70B',
        contextWindow: 32768,
        maxOutput: 8192,
        strengths: ['fast_reasoning', 'coding', 'general'],
        isFree: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        displayName: 'Llama 3.1 8B (instant)',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['fast_reasoning'],
        isFree: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        displayName: 'Mixtral 8x7B',
        contextWindow: 32768,
        maxOutput: 8192,
        strengths: ['coding', 'general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 30, tpm: 6000, rpd: 14400 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate_limit_exceeded', 'Rate limit reached'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 1,
    strengthsFor: ['fast_reasoning', 'coding'],
  },

  gemini: {
    id: 'gemini',
    displayName: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        contextWindow: 1000000,
        maxOutput: 8192,
        strengths: ['long_context', 'multimodal', 'general'],
        isFree: true,
      },
      {
        id: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutput: 8192,
        strengths: ['long_context', 'multimodal'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 15, rpd: 1500, tpm: 1000000 },
    rateLimitStatusCodes: [429, 503],
    rateLimitErrorPatterns: ['RESOURCE_EXHAUSTED', 'quota exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 2,
    strengthsFor: ['long_context', 'multimodal'],
  },

  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'llama3.1-70b',
        displayName: 'Llama 3.1 70B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['batch', 'general'],
        isFree: true,
      },
      {
        id: 'llama3.1-8b',
        displayName: 'Llama 3.1 8B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['fast_reasoning', 'batch'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 30, tpm: 60000, tpd: 1000000 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate_limit', 'quota_exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 3,
    strengthsFor: ['batch'],
  },

  sambanova: {
    id: 'sambanova',
    displayName: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'Meta-Llama-3.3-70B-Instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['large_model', 'general'],
        isFree: true,
      },
      {
        id: 'Meta-Llama-3.1-405B-Instruct',
        displayName: 'Llama 3.1 405B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['large_model', 'coding'],
        isFree: true,
      },
      {
        id: 'Qwen2.5-72B-Instruct',
        displayName: 'Qwen 2.5 72B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['coding', 'general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 10, tpd: 200000 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'quota'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 4,
    strengthsFor: ['large_model'],
  },

  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/omnillm',
      'X-Title': 'OmniLLM CLI',
    },
    models: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        displayName: 'Llama 3.3 70B (free)',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
      {
        id: 'deepseek/deepseek-r1:free',
        displayName: 'DeepSeek R1 (free)',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['coding', 'fast_reasoning'],
        isFree: true,
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        displayName: 'Gemini 2.0 Flash (free)',
        contextWindow: 1000000,
        maxOutput: 4096,
        strengths: ['long_context'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 20 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'credits'],
    retryAfterHeader: 'x-ratelimit-reset-requests',
    requiresKey: true,
    isLocal: false,
    routingPriority: 5,
    strengthsFor: ['general'],
  },

  github_models: {
    id: 'github_models',
    displayName: 'GitHub Models',
    baseURL: 'https://models.inference.ai.azure.com',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutput: 4096,
        strengths: ['coding', 'general'],
        isFree: true,
      },
      {
        id: 'meta-llama-3.3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpd: 150, rpm: 10 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 6,
    strengthsFor: ['coding'],
  },

  nvidia_nim: {
    id: 'nvidia_nim',
    displayName: 'NVIDIA NIM',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'deepseek-ai/deepseek-r1',
        displayName: 'DeepSeek R1',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['coding', 'fast_reasoning'],
        isFree: true,
      },
      {
        id: 'meta/llama-3.3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 40, rpd: 1000 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'quota exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 7,
    strengthsFor: ['coding'],
  },

  mistral: {
    id: 'mistral',
    displayName: 'Mistral (La Plateforme)',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'mistral-small-latest',
        displayName: 'Mistral Small',
        contextWindow: 32768,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 1, rpd: 500 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['too many requests'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 9,
    strengthsFor: ['general'],
  },

  fireworks: {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 10 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 10,
    strengthsFor: ['general'],
  },

  ollama: {
    id: 'ollama',
    displayName: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer ollama',
    models: [
      {
        id: 'llama3.2',
        displayName: 'Llama 3.2 (local)',
        contextWindow: 4096,
        maxOutput: 2048,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: {},
    rateLimitStatusCodes: [],
    rateLimitErrorPatterns: [],
    retryAfterHeader: '',
    requiresKey: false,
    isLocal: true,
    routingPriority: 99,
    strengthsFor: ['general'],
  },
};

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS[id];
}

export function getModel(providerId: string, modelId: string) {
  const provider = PROVIDERS[providerId];
  if (!provider) return undefined;
  return provider.models.find(m => m.id === modelId);
}

export function getBestModel(providerId: string, taskType: import('./types.js').TaskType) {
  const provider = PROVIDERS[providerId];
  if (!provider) return undefined;
  const taskModels = provider.models.filter(m => m.strengths.includes(taskType) && m.isFree);
  if (taskModels.length) return taskModels[0];
  return provider.models.find(m => m.isFree) ?? provider.models[0];
}
