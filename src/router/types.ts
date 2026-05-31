import type { TaskType } from '../providers/types.js';
import type { ModelDefinition, ProviderDefinition } from '../providers/types.js';

export interface TaskProfile {
  taskType: TaskType;
  estimatedTokens: number;
  messagePreview: string;
}

export interface ProviderSelection {
  providerId: string;
  keyId: string;
  model: ModelDefinition;
  score: number;
}

export interface RoutingDecision {
  selection: ProviderSelection;
  fallbackChain: string[];
  needsCompaction: boolean;
  reason: string;
}

export const FALLBACK_CHAINS: Record<TaskType, string[]> = {
  fast_reasoning: ['groq', 'gemini', 'cerebras', 'nvidia_nim'],
  coding: ['groq', 'gemini', 'openrouter', 'sambanova', 'nvidia_nim', 'github_models'],
  long_context: ['gemini', 'sambanova', 'openrouter'],
  multimodal: ['gemini'],
  large_model: ['sambanova', 'groq', 'openrouter', 'nvidia_nim'],
  batch: ['cerebras', 'gemini', 'groq'],
  general: ['groq', 'gemini', 'openrouter', 'cerebras', 'sambanova', 'nvidia_nim', 'github_models', 'mistral', 'fireworks', 'ollama'],
};
