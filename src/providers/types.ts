export type TaskType =
  | 'fast_reasoning'
  | 'long_context'
  | 'coding'
  | 'multimodal'
  | 'large_model'
  | 'batch'
  | 'general';

export interface ModelDefinition {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutput: number;
  strengths: TaskType[];
  isFree: boolean;
}

export interface RateLimitDefinition {
  rpm?: number;
  tpm?: number;
  rpd?: number;
  tpd?: number;
}

export interface ProviderDefinition {
  id: string;
  displayName: string;
  baseURL: string;
  apiKeyHeader: string;
  apiKeyFormat: string;
  models: ModelDefinition[];
  freeTierLimits: RateLimitDefinition;
  rateLimitStatusCodes: number[];
  rateLimitErrorPatterns: string[];
  retryAfterHeader: string;
  extraHeaders?: Record<string, string>;
  requiresKey: boolean;
  isLocal: boolean;
  routingPriority: number;
  strengthsFor: TaskType[];
}
