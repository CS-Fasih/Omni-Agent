import chalk from 'chalk';
import type { AgentContext } from '../../context/types.js';
import { countMessagesTokens } from '../../context/token-counter.js';

export function handleCompactCommand(context: AgentContext | null): void {
  if (!context) {
    console.log(chalk.gray('No active context to compact.'));
    return;
  }

  const tokens = countMessagesTokens(context.messages);
  console.log(
    chalk.white(`Manual compaction triggered.`) +
    chalk.gray(` Current tokens: ${tokens.toLocaleString()}`)
  );
  console.log(chalk.gray('Context will be compacted on the next API call.'));
}
