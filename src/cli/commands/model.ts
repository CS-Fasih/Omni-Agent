import chalk from 'chalk';
import { PROVIDERS, getBestModel } from '../../providers/registry.js';
import { getConfiguredProviders } from '../../keys/store.js';

let forcedProvider: string | null = null;
let forcedModel: string | null = null;

export function getForcedProvider(): string | null {
  return forcedProvider;
}

export function getForcedModel(): string | null {
  return forcedModel;
}

export function handleModelCommand(args: string[]): void {
  const providerId = args[0];

  if (!providerId) {
    console.log(chalk.bold.white('\nCurrent override:'));
    if (forcedProvider) {
      console.log(
        chalk.white(`  Provider: ${forcedProvider}`) +
        (forcedModel ? chalk.gray(` (${forcedModel})`) : '')
      );
    } else {
      console.log(chalk.gray('  Auto (no override)'));
    }

    console.log(chalk.bold.white('\nAvailable providers:'));
    const configured = getConfiguredProviders();
    for (const pid of configured) {
      const provider = PROVIDERS[pid];
      if (!provider) continue;
      const models = provider.models.filter(m => m.isFree);
      console.log(
        chalk.white(`  ${pid}`) +
        chalk.gray(` — ${provider.displayName}`) +
        chalk.gray(` (${models.length} free models)`)
      );
    }
    return;
  }

  if (providerId === 'auto') {
    forcedProvider = null;
    forcedModel = null;
    console.log(chalk.green('✓ Switched to auto provider selection'));
    return;
  }

  const provider = PROVIDERS[providerId];
  if (!provider) {
    console.log(chalk.red(`Unknown provider: ${providerId}`));
    console.log(chalk.gray('Use /model to see available providers'));
    return;
  }

  const modelId = args[1];
  if (modelId) {
    const model = provider.models.find(m => m.id === modelId);
    if (!model) {
      console.log(chalk.red(`Unknown model: ${modelId} for ${providerId}`));
      console.log(chalk.gray('Available models:'));
      provider.models.forEach(m => {
        console.log(chalk.gray(`  ${m.id} (${m.displayName})`));
      });
      return;
    }
    forcedModel = modelId;
  } else {
    const best = getBestModel(providerId, 'general');
    forcedModel = best?.id ?? provider.models[0].id;
  }

  forcedProvider = providerId;
  console.log(
    chalk.green(`✓ Forced provider to ${provider.displayName}`) +
    (forcedModel ? chalk.gray(` (${forcedModel})`) : '')
  );
}
