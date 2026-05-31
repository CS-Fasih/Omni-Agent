import * as readline from 'node:readline';
import chalk from 'chalk';
import type { AgentContext } from '../context/types.js';
import { createContext } from '../context/manager.js';
import { runAgent } from '../agent/loop.js';
import { quotaTracker } from '../quota/tracker.js';
import { getConfiguredProviders } from '../keys/store.js';
import { PROVIDERS } from '../providers/registry.js';
import { dispatchCommand } from './commands/index.js';
import { interactiveAddKey } from './commands/keys.js';
import { renderer, showWelcome, showStatusBar } from './renderer.js';
import { getForcedProvider, getForcedModel } from './commands/model.js';

async function runStartupWizard(): Promise<boolean> {
  console.log(chalk.yellow('No API keys found.') + chalk.gray(' Add one now?'));
  console.log(chalk.gray('  ') + chalk.white('Press Enter') + chalk.gray(' to skip, or type ') + chalk.white('y') + chalk.gray(' to add:'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  try {
    const answer = await new Promise<string>(resolve => {
      rl.question(chalk.gray('  > '), resolve);
    });
    if (!answer || (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes')) {
      console.log(chalk.gray('  Skipped. Type /keys add anytime to configure.\n'));
      return false;
    }
  } finally {
    rl.close();
  }

  await interactiveAddKey();
  return getConfiguredProviders().length > 0;
}

export async function startRepl(): Promise<void> {
  showWelcome();

  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    await runStartupWizard();
  } else {
    console.log(
      chalk.gray(
        `Ready with ${configured.length} provider${configured.length > 1 ? 's' : ''}: ` +
          configured.join(', ')
      )
    );
    console.log(chalk.gray('Type your message or /help for commands.\n'));
  }

  let context: AgentContext | null = createContext('Interactive session');
  let switchCount = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> '),
    terminal: true,
    historySize: 100,
  });

  rl.on('SIGINT', () => {
    console.log(chalk.gray('\nGoodbye!'));
    rl.close();
    process.exit(0);
  });

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (['/exit', '/quit', 'exit'].includes(trimmed.toLowerCase())) {
      console.log(chalk.gray('Goodbye!'));
      rl.close();
      process.exit(0);
    }

    if (trimmed.startsWith('/')) {
      await dispatchCommand(trimmed, context);
      rl.prompt();
      return;
    }

    try {
      context = context ?? createContext(trimmed);
      context = { ...context, currentStep: 'Processing request' };

      context = await runAgent(trimmed, context, {
        renderer,
        maxProviderSwitches: 5,
        maxToolCalls: 25,
      });

      switchCount = context.providerHistory.length;

      const capacities: Record<string, { label: string; percent: number }> = {};
      const configuredProviders = getConfiguredProviders();
      for (const pid of configuredProviders) {
        const keys = quotaTracker.getKeysForProvider(pid);
        if (keys.length > 0) {
          const cap = quotaTracker.getCapacity(pid, keys[0].keyId);
          capacities[pid] = {
            label: PROVIDERS[pid]?.displayName ?? pid,
            percent: cap.overallPercent,
          };
        }
      }

      const statusLine = showStatusBar(
        context.currentProvider,
        '',
        context.totalTokensUsed,
        switchCount,
        capacities
      );
      console.log('\n' + statusLine);
      console.log();
    } catch (err: any) {
      console.log(chalk.red(`\n✗ Error: ${err.message}`));
    }

    rl.prompt();
  });
}
