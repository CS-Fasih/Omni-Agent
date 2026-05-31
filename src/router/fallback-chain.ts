import type { TaskType } from '../providers/types.js';
import { FALLBACK_CHAINS } from './types.js';

export function getOrderedFallbackChain(
  taskType: TaskType,
  availableProviders: string[],
  excludeProvider?: string
): string[] {
  const chain = FALLBACK_CHAINS[taskType] ?? FALLBACK_CHAINS.general;
  return chain
    .filter(pid => pid !== excludeProvider && availableProviders.includes(pid));
}

export function getNextProvider(
  taskType: TaskType,
  availableProviders: string[],
  currentProvider: string,
  exhaustedProviders: string[]
): string | null {
  const chain = getOrderedFallbackChain(taskType, availableProviders, currentProvider);
  return chain.find(pid => !exhaustedProviders.includes(pid)) ?? null;
}

export function allProvidersExhausted(
  taskType: TaskType,
  availableProviders: string[],
  exhaustedProviders: string[]
): boolean {
  const chain = FALLBACK_CHAINS[taskType] ?? FALLBACK_CHAINS.general;
  return chain.every(pid => !availableProviders.includes(pid) || exhaustedProviders.includes(pid));
}
