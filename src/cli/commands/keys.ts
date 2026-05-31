import * as readline from 'node:readline';
import chalk from 'chalk';
import { addKey, removeKey, listKeys, getKeys } from '../../keys/store.js';
import { validateKey, testKey } from '../../keys/validator.js';
import { PROVIDERS } from '../../providers/registry.js';

const PROVIDER_LIST = [
  { id: 'groq', desc: 'fast inference, Llama 3.3 70B' },
  { id: 'gemini', desc: '1M context, multimodal' },
  { id: 'cerebras', desc: '1M tokens/day' },
  { id: 'sambanova', desc: '405B model free' },
  { id: 'openrouter', desc: '30+ free models' },
  { id: 'github_models', desc: 'GPT-4o free' },
  { id: 'nvidia_nim', desc: 'DeepSeek R1 free' },
  { id: 'mistral', desc: 'Mistral Small free' },
  { id: 'cohere', desc: 'Cohere free tier' },
  { id: 'fireworks', desc: 'Llama 3.3 70B free' },
  { id: 'ollama', desc: 'local, no key needed' },
];

function getProviderDesc(id: string): string {
  const p = PROVIDER_LIST.find(p => p.id === id);
  return p?.desc ?? '';
}

function getProviderDisplay(id: string): string {
  const p = PROVIDERS[id];
  return p?.displayName ?? id;
}

async function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer.trim()));
  });
}

async function askHidden(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write('\x1B[?25l');
    let buf = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(prompt);
    const onData = (chunk: Buffer) => {
      const str = chunk.toString();
      for (const ch of str) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.stdout.write('\x1B[?25h');
          resolve(buf);
          return;
        }
        if (ch === '\x7f' || ch === '\b') {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (ch === '\x03') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.stdout.write('\x1B[?25h');
          resolve('');
          return;
        } else {
          buf += ch;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function interactiveProviderSelect(rl: readline.Interface): Promise<string> {
  console.log(chalk.bold.white('\n  Select a provider:'));
  PROVIDER_LIST.forEach((p, i) => {
    const num = chalk.cyan(String(i + 1).padStart(2, ' '));
    console.log(`  ${num}. ${chalk.white(p.id.padEnd(16))} ${chalk.gray(p.desc)}`);
  });
  console.log('');

  while (true) {
    const input = await askQuestion(rl, chalk.gray('  Enter number or provider name: '));
    if (!input) return '';
    const num = parseInt(input, 10);
    if (num >= 1 && num <= PROVIDER_LIST.length) return PROVIDER_LIST[num - 1].id;
    const match = PROVIDER_LIST.find(p => p.id === input || p.id.startsWith(input));
    if (match) return match.id;
    console.log(chalk.yellow(`  Unknown provider: ${input}`));
  }
}

export async function interactiveAddKey(
  preSelectedProvider?: string,
  preSelectedKey?: string
): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let providerId = preSelectedProvider;
  let key = preSelectedKey;

  if (!providerId) {
    providerId = await interactiveProviderSelect(rl);
    if (!providerId) {
      console.log(chalk.gray('  Skipped.\n'));
      rl.close();
      return;
    }
  } else if (!PROVIDERS[providerId]) {
    console.log(chalk.yellow(`  Unknown provider: ${providerId}. Showing list...`));
    providerId = await interactiveProviderSelect(rl);
    if (!providerId) {
      console.log(chalk.gray('  Skipped.\n'));
      rl.close();
      return;
    }
  }

  if (!key) {
    const providerDisplay = getProviderDisplay(providerId);
    key = await askHidden(rl, chalk.gray(`  Paste your ${providerDisplay} API key: `));
    if (!key) {
      console.log(chalk.gray('  Skipped.\n'));
      rl.close();
      return;
    }
  }

  const validation = validateKey(providerId, key);
  if (!validation.valid) {
    console.log(chalk.yellow(`  ${validation.message}\n`));
    rl.close();
    return;
  }

  const info = addKey(providerId, key);
  console.log(chalk.green(`\n  ✓ ${getProviderDisplay(providerId)} key added successfully.`) + chalk.gray(` (id: ${info.keyId})`));
  console.log();
  rl.close();
}

export async function handleKeysCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand) {
    await handleKeysMenu();
    return;
  }

  switch (subcommand) {
    case 'add': {
      const providerId = args[1];
      const key = args[2];
      const labelIdx = args.indexOf('--label');
      const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

      if (!providerId || !key) {
        await interactiveAddKey(providerId, key);
        return;
      }

      const validation = validateKey(providerId, key);
      if (!validation.valid) {
        console.log(chalk.yellow(`${validation.message}`));
        return;
      }

      const info = addKey(providerId, key, label);
      console.log(chalk.green(`✓ ${getProviderDisplay(providerId)} key added`) + chalk.gray(` (id: ${info.keyId})`));
      break;
    }

    case 'list': {
      showKeyTable();
      break;
    }

    case 'remove': {
      const providerId = args[1];
      const keyIdOrLabel = args[2];

      if (!providerId) {
        console.log(chalk.red('Usage: /keys remove <provider> <keyId|label>'));
        return;
      }

      const removed = removeKey(providerId, keyIdOrLabel);
      if (removed) {
        console.log(chalk.green(`✓ Key removed from ${providerId}`));
      } else {
        console.log(chalk.red(`✗ Key not found in ${providerId}`));
      }
      break;
    }

    case 'test': {
      const providerId = args[1];
      if (!providerId) {
        console.log(chalk.red('Usage: /keys test <provider> <key>'));
        return;
      }

      const actualKey = await resolveTestKey(providerId, args[2]);
      if (!actualKey) {
        console.log(chalk.red(`Could not retrieve key for ${providerId}`));
        return;
      }

      const result = await testKey(providerId, actualKey);
      if (result.valid) {
        console.log(chalk.green(`✓ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
      break;
    }

    default:
      console.log(chalk.red(`Unknown subcommand: ${subcommand}`));
      await handleKeysMenu();
  }
}

async function handleKeysMenu(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  console.log(chalk.bold.white('\n  What would you like to do?'));
  console.log(chalk.cyan('   1.') + chalk.white(' Add a new key'));
  console.log(chalk.cyan('   2.') + chalk.white(' List configured keys'));
  console.log(chalk.cyan('   3.') + chalk.white(' Remove a key'));
  console.log(chalk.cyan('   4.') + chalk.white(' Test a key'));
  console.log('');

  const choice = await askQuestion(rl, chalk.gray('  Enter number: '));
  rl.close();

  switch (choice) {
    case '1':
      await interactiveAddKey();
      break;
    case '2':
      showKeyTable();
      break;
    case '3':
      await handleKeysRemoveInteractive();
      break;
    case '4':
      await handleKeysTestInteractive();
      break;
    default:
      if (choice) console.log(chalk.yellow(`  Unknown option: ${choice}`));
  }
}

async function handleKeysRemoveInteractive(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const keys = listKeys();
  const entries = Object.entries(keys);
  if (entries.length === 0) {
    console.log(chalk.gray('No keys configured.'));
    rl.close();
    return;
  }

  console.log(chalk.bold.white('\n  Select key to remove:'));
  let idx = 1;
  const map: Record<string, string> = {};
  for (const [prov, keyList] of entries) {
    for (const k of keyList) {
      console.log(chalk.cyan(`  ${idx}.`) + chalk.white(` ${prov}`) + chalk.gray(` — ${k.keyId}`));
      map[String(idx)] = `${prov}:${k.keyId}`;
      idx++;
    }
  }
  console.log('');

  const choice = await askQuestion(rl, chalk.gray('  Enter number: '));
  rl.close();

  if (map[choice]) {
    const [prov, keyId] = map[choice].split(':');
    removeKey(prov, keyId);
    console.log(chalk.green(`  ✓ Key removed from ${prov}`));
  } else if (choice) {
    console.log(chalk.yellow(`  Unknown option: ${choice}`));
  }
}

async function handleKeysTestInteractive(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const keys = listKeys();
  const entries = Object.entries(keys);
  if (entries.length === 0) {
    console.log(chalk.gray('No keys to test.'));
    rl.close();
    return;
  }

  console.log(chalk.bold.white('\n  Select key to test:'));
  let idx = 1;
  const map: Record<string, string> = {};
  for (const [prov, keyList] of entries) {
    for (const k of keyList) {
      console.log(chalk.cyan(`  ${idx}.`) + chalk.white(` ${prov}`) + chalk.gray(` — ${k.keyId}`));
      map[String(idx)] = `${prov}`;
      idx++;
    }
  }
  console.log('');

  const choice = await askQuestion(rl, chalk.gray('  Enter number: '));
  rl.close();

  if (map[choice]) {
    const providerId = map[choice];
    const actualKey = await resolveTestKey(providerId);
    if (actualKey) {
      const result = await testKey(providerId, actualKey);
      if (result.valid) {
        console.log(chalk.green(`✓ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    }
  } else if (choice) {
    console.log(chalk.yellow(`  Unknown option: ${choice}`));
  }
}

function showKeyTable(): void {
  const allKeys = listKeys();
  const configuredSet = new Set(Object.keys(allKeys));

  const rows: { provider: string; keyId: string; added: string }[] = [];
  for (const prov of Object.keys(allKeys)) {
    const entries = getKeys(prov);
    for (const e of entries) {
      rows.push({
        provider: prov,
        keyId: e.id,
        added: formatTimeAgo(e.addedAt),
      });
    }
  }

  for (const p of PROVIDER_LIST) {
    if (!configuredSet.has(p.id)) {
      rows.push({ provider: p.id, keyId: '(no key)', added: '' });
    }
  }

  const c1 = 18;
  const c2 = 22;
  const c3 = 14;

  console.log();
  console.log(
    chalk.gray('╭') +
      '─'.repeat(c1 + 2) +
      chalk.gray('┬') +
      '─'.repeat(c2 + 2) +
      chalk.gray('┬') +
      '─'.repeat(c3 + 2) +
      chalk.gray('╮')
  );
  console.log(
    chalk.gray('│ ') +
      chalk.bold.white('Provider'.padEnd(c1)) +
      chalk.gray(' │ ') +
      chalk.bold.white('Key ID'.padEnd(c2)) +
      chalk.gray(' │ ') +
      chalk.bold.white('Added'.padEnd(c3)) +
      chalk.gray(' │')
  );
  console.log(
    chalk.gray('├') +
      '─'.repeat(c1 + 2) +
      chalk.gray('┼') +
      '─'.repeat(c2 + 2) +
      chalk.gray('┼') +
      '─'.repeat(c3 + 2) +
      chalk.gray('┤')
  );

  for (const row of rows) {
    const isConfigured = row.keyId !== '(no key)';
    const prefix = isConfigured ? chalk.green(' ✓ ') : chalk.gray(' — ');
    const prov = (isConfigured ? chalk.white : chalk.gray)(row.provider.padEnd(c1));
    const kid = (isConfigured ? chalk.gray : chalk.gray)(row.keyId.padEnd(c2));
    const add = chalk.gray(row.added.padEnd(c3));

    console.log(
      chalk.gray('│') +
        prefix +
        prov +
        chalk.gray(' │ ') +
        kid +
        chalk.gray(' │ ') +
        add +
        chalk.gray(' │')
    );
  }

  console.log(
    chalk.gray('╰') +
      '─'.repeat(c1 + 2) +
      chalk.gray('┴') +
      '─'.repeat(c2 + 2) +
      chalk.gray('┴') +
      '─'.repeat(c3 + 2) +
      chalk.gray('╯')
  );
  console.log();
}

function formatTimeAgo(ms: number): string {
  const now = Date.now();
  const diff = now - ms;

  if (diff < 1000) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function resolveTestKey(providerId: string, explicitKey?: string): Promise<string | undefined> {
  if (explicitKey) return explicitKey;
  const { getKeys, getDecryptedKey } = await import('../../keys/store.js');
  const keys = getKeys(providerId);
  if (keys.length === 0) {
    console.log(chalk.red(`No keys configured for ${providerId}`));
    return undefined;
  }
  return getDecryptedKey(providerId, keys[0].id);
}
