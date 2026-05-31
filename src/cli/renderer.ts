import chalk from 'chalk';
import type { AgentRenderer } from '../agent/loop.js';
import type { ToolCall } from '../agent/types.js';
import type { ProviderSwitch } from '../context/types.js';

let currentProvider = '';
let currentModel = '';

export const renderer: AgentRenderer = {
  showThinking(provider: string, model: string): void {
    currentProvider = provider;
    currentModel = model;
    process.stdout.write(chalk.gray(`\n[${provider}/${model}] `));
  },

  streamToken(token: string): void {
    process.stdout.write(token);
  },

  showToolUse(toolCalls: ToolCall[]): void {
    process.stdout.write('\n');
    for (const tc of toolCalls) {
      console.log(
        chalk.blue('●') +
          ' ' +
          chalk.white(tc.function.name) +
          ' ' +
          chalk.gray(truncate(tc.function.arguments, 100))
      );
    }
  },

  showProviderSwitch(from: string, to: string): void {
    if (!from) return;
    console.log(
      chalk.yellow('\n⟳ Switching to ') +
        chalk.bold(to) +
        chalk.gray(' (from ' + from + ')')
    );
  },

  showStatus(message: string): void {
    console.log(chalk.gray(message));
  },

  showWarning(message: string): void {
    console.log(chalk.yellow('⚠ ' + message));
  },

  showError(error: any): void {
    console.log(chalk.red('✗ ' + (error?.message ?? String(error))));
  },

  showResponse(content: string): void {
    if (content) {
      process.stdout.write('\n');
    } else {
      process.stdout.write(chalk.gray(' (no content)') + '\n');
    }
  },
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export function showWelcome(): void {
  console.log('');
  console.log(
    '  ' + chalk.bold.cyan('OmniLLM CLI') + chalk.gray('  v1.0.0')
  );
  console.log(
    chalk.gray('  Type ') +
      chalk.white('/help') +
      chalk.gray(' for commands.')
  );
  console.log('');
}

export function showStatusBar(
  provider: string,
  model: string,
  tokensUsed: number,
  switches: number,
  capacities: Record<string, { label: string; percent: number }>
): string {
  const parts: string[] = [];

  if (provider) {
    parts.push(chalk.gray(`Provider: ${chalk.white(`${provider}/${model}`)}`));
  }
  parts.push(chalk.gray(`Tokens: ${chalk.white(formatNumber(tokensUsed))}`));
  if (switches > 0) {
    parts.push(chalk.gray(`Switches: ${chalk.yellow(String(switches))}`));
  }

  const capParts: string[] = [];
  for (const [id, cap] of Object.entries(capacities)) {
    const bar = makeBar(cap.percent);
    capParts.push(chalk.gray(`${id}: ${bar} ${cap.percent}%`));
    if (capParts.length >= 3) break;
  }

  const separator = chalk.gray(' │ ');
  return (
    chalk.gray('───') +
    ' ' +
    parts.join(separator) +
    (capParts.length > 0 ? separator : '') +
    capParts.join(' ')
  );
}

function makeBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  if (percent >= 90) return chalk.red('█'.repeat(filled) + '□'.repeat(empty));
  if (percent >= 70) return chalk.yellow('█'.repeat(filled) + '□'.repeat(empty));
  return chalk.green('█'.repeat(filled) + '□'.repeat(empty));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function showKeyAdded(info: { provider: string; keyId: string; maskedKey: string }): void {
  console.log(
    chalk.green('✓ ') +
      chalk.white(`${info.provider} key added`) +
      chalk.gray(` (id: ${info.keyId})`)
  );
}

export function showKeyList(keys: Record<string, any[]>): void {
  if (Object.keys(keys).length === 0) {
    console.log(chalk.gray('No API keys configured.'));
    return;
  }

  for (const [providerId, keyList] of Object.entries(keys)) {
    console.log(chalk.bold.white(`\n${providerId}:`));
    for (const k of keyList) {
      const label = k.label ? chalk.gray(` (${k.label})`) : '';
      console.log(
        chalk.gray(`  • ${k.keyId}${label}${k.maskedKey ? ' — ' + k.maskedKey : ''}`)
      );
    }
  }
}

export function showQuotaStatus(capacities: Record<string, { provider: string; keyId: string; rpm: number; tpm: number; rpd: number; tpd: number; overall: number }>): void {
  console.log(chalk.bold.white('\nQuota Status:'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const [, cap] of Object.entries(capacities)) {
    const overallBar = makeBar(cap.overall);
    console.log(
      chalk.white(`  ${cap.provider}`) +
        chalk.gray(` (${cap.keyId}):`) +
        ` ${overallBar} ${cap.overall}%`
    );
    console.log(
      chalk.gray(
        `    RPM: ${cap.rpm}%  TPM: ${cap.tpm}%  RPD: ${cap.rpd}%  TPD: ${cap.tpd}%`
      )
    );
  }
}
