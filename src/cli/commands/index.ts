import type { AgentContext } from '../../context/types.js';
import { handleKeysCommand } from './keys.js';
import { handleStatusCommand } from './status.js';
import { handleModelCommand } from './model.js';
import { handleCompactCommand } from './compact.js';
import { handleHelpCommand } from './help.js';

export type CommandHandler = (args: string[], context: AgentContext | null) => Promise<boolean> | boolean;

export async function dispatchCommand(input: string, context: AgentContext | null): Promise<boolean> {
  if (!input.startsWith('/')) return false;

  const parts = input.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'keys':
      await handleKeysCommand(args);
      return true;

    case 'status':
      handleStatusCommand(context ?? undefined);
      return true;

    case 'model':
      handleModelCommand(args);
      return true;

    case 'compact':
      handleCompactCommand(context);
      return true;

    case 'help':
      handleHelpCommand();
      return true;

    default:
      console.log(`Unknown command: /${command}. Type /help for available commands.`);
      return true;
  }
}

export { handleKeysCommand, handleStatusCommand, handleModelCommand, handleCompactCommand, handleHelpCommand };
