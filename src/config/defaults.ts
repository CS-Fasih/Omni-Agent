export const ROUTING_DEFAULTS: Record<string, string[]> = {
  coding: ['groq', 'gemini', 'openrouter', 'sambanova', 'nvidia_nim', 'github_models'],
  long_context: ['gemini', 'sambanova', 'openrouter'],
  fast_reasoning: ['groq', 'gemini', 'cerebras'],
  multimodal: ['gemini'],
  large_model: ['sambanova', 'groq', 'openrouter'],
  batch: ['cerebras', 'gemini', 'groq'],
  general: ['groq', 'gemini', 'openrouter', 'cerebras', 'sambanova', 'nvidia_nim', 'github_models', 'mistral', 'fireworks', 'ollama'],
};
