import type { TaskType, ModelDefinition, ProviderDefinition } from '../providers/types.js';
import { PROVIDERS, getBestModel } from '../providers/registry.js';
import type { ProviderSelection } from './types.js';
import { QuotaTracker, quotaTracker as defaultTracker } from '../quota/tracker.js';
import { getKeys } from '../keys/store.js';

export function selectProvider(
  taskType: TaskType,
  availableProviders: string[],
  quotaTrackerInstance: QuotaTracker,
  estimatedTokens: number,
  excludeProvider?: string
): ProviderSelection | null {
  const scored: (ProviderSelection & { score: number })[] = [];

  for (const pid of availableProviders) {
    if (pid === excludeProvider) continue;
    const def = PROVIDERS[pid];
    if (!def) continue;

    if (def.isLocal && !availableProviders.includes('ollama')) continue;

    const keys = getKeys(pid);
    if (keys.length === 0 && def.requiresKey) continue;

    const bestKey = findBestKey(pid, keys.map(k => k.id), quotaTrackerInstance, estimatedTokens);
    if (!bestKey && def.requiresKey) continue;

    const keyId = bestKey ?? 'local';

    let score = def.routingPriority * 10;
    if (def.strengthsFor.includes(taskType)) score -= 5;

    const model = getBestModel(pid, taskType);
    if (!model) continue;

    if (model.contextWindow < estimatedTokens * 1.5) score += 3;

    scored.push({
      providerId: pid,
      keyId,
      model,
      score,
    });
  }

  scored.sort((a, b) => a.score - b.score);

  if (scored.length === 0) {
    if (availableProviders.includes('ollama') && !excludeProvider) {
      const ollamaDef = PROVIDERS.ollama;
      if (ollamaDef) {
        return {
          providerId: 'ollama',
          keyId: 'local',
          model: ollamaDef.models[0],
          score: 99,
        };
      }
    }
    return null;
  }

  return scored[0];
}

function findBestKey(
  providerId: string,
  keyIds: string[],
  quotaTrackerInstance: QuotaTracker,
  estimatedTokens: number
): string | null {
  for (const keyId of keyIds) {
    const result = quotaTrackerInstance.check(providerId, keyId, estimatedTokens);
    if (result.canProceed) return keyId;
  }
  return null;
}

import { FALLBACK_CHAINS } from './types.js';

export function getFallbackChain(taskType: TaskType, availableProviders: string[]): string[] {
  const chain = FALLBACK_CHAINS[taskType] ?? FALLBACK_CHAINS.general;
  return chain.filter(pid => availableProviders.includes(pid));
}
