import chalk from 'chalk';
import { addKey, removeKey, listKeys } from '../../keys/store.js';
import { validateKey, testKey } from '../../keys/validator.js';
import { showKeyAdded, showKeyList } from '../renderer.js';

export async function handleKeysCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'add': {
      const providerId = args[1];
      const key = args[2];
      const labelIdx = args.indexOf('--label');
      const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

      if (!providerId || !key) {
        console.log(chalk.red('Usage: /keys add <provider> <key> [--label name]'));
        return;
      }

      const validation = validateKey(providerId, key);
      if (!validation.valid) {
        console.log(chalk.yellow(`⚠ ${validation.message}`));
        return;
      }

      const info = addKey(providerId, key, label);
      showKeyAdded(info);
      break;
    }

    case 'list': {
      const keys = listKeys();
      showKeyList(keys);
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
      console.log(chalk.gray('Available commands:'));
      console.log(chalk.white('  /keys add <provider> <key>') + chalk.gray(' — Add an API key'));
      console.log(chalk.white('  /keys list') + chalk.gray(' — List configured keys'));
      console.log(chalk.white('  /keys remove <provider> <keyId>') + chalk.gray(' — Remove a key'));
      console.log(chalk.white('  /keys test <provider> [key]') + chalk.gray(' — Test a key'));
      console.log(chalk.gray('\nProviders: groq, gemini, cerebras, sambanova, openrouter, github_models, nvidia_nim, mistral, cohere, fireworks, cloudflare, ollama'));
  }
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
