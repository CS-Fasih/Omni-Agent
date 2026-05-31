import chalk from 'chalk';
import { quotaTracker } from '../../quota/tracker.js';
import { getConfiguredProviders } from '../../keys/store.js';
import { PROVIDERS } from '../../providers/registry.js';
import { countMessagesTokens } from '../../context/token-counter.js';
import type { AgentContext } from '../../context/types.js';
import { showQuotaStatus } from '../renderer.js';

export function handleStatusCommand(context?: AgentContext): void {
  console.log(chalk.bold.white('\n╭─── Status ───╮'));

  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    console.log(chalk.gray('\nNo API keys configured.'));
    console.log(chalk.white('Add keys: /keys add <provider> <key>'));
    console.log();
    return;
  }

  console.log(chalk.white(`\nConfigured providers: ${configuredProviders.length}`));
  console.log(chalk.white(`Session tokens used: ${context?.totalTokensUsed?.toLocaleString?.() ?? 0}`));
  if (context) {
    console.log(chalk.white(`Messages in context: ${context.messages.length}`));
    console.log(chalk.white(`Context tokens: ${countMessagesTokens(context.messages).toLocaleString()}`));
    console.log(chalk.white(`Compaction count: ${context.compactionCount}`));
    console.log(chalk.white(`Provider switches: ${context.providerHistory.length}`));
  }

  const capacities: Record<string, { provider: string; keyId: string; rpm: number; tpm: number; rpd: number; tpd: number; overall: number }> = {};

  for (const providerId of configuredProviders) {
    const provider = PROVIDERS[providerId];
    if (!provider) continue;
    const keys = quotaTracker.getKeysForProvider(providerId);
    for (const key of keys) {
      const cap = quotaTracker.getCapacity(providerId, key.keyId);
      const compositeKey = `${providerId}:${key.keyId}`;
      capacities[compositeKey] = {
        provider: provider.displayName,
        keyId: key.keyId,
        rpm: cap.rpmPercent,
        tpm: cap.tpmPercent,
        rpd: cap.rpdPercent,
        tpd: cap.tpdPercent,
        overall: cap.overallPercent,
      };
    }
  }

  showQuotaStatus(capacities);

  if (context?.providerHistory.length) {
    console.log(chalk.bold.white('\nProvider Switch History:'));
    for (const sw of context.providerHistory.slice(-10)) {
      const reason = sw.reason === 'rate_limit'
        ? chalk.yellow(sw.reason)
        : sw.reason === 'context_size'
          ? chalk.blue(sw.reason)
          : chalk.gray(sw.reason);
      console.log(
        chalk.gray(`  ${sw.from}`) +
          ' → ' +
          chalk.white(sw.to) +
          chalk.gray(` [${reason}]`) +
          chalk.gray(` ${sw.tokensAfter - sw.tokensBefore > 0 ? '+' : ''}${sw.tokensAfter - sw.tokensBefore}t`)
      );
    }
  }

  console.log();
}
