import chalk from 'chalk';

export function handleHelpCommand(): void {
  console.log(chalk.bold.cyan('\n╭─── OmniLLM CLI Help ───╮\n'));

  console.log(chalk.bold.white('Commands:'));
  console.log(chalk.white('  /keys add <provider> <key>') + chalk.gray('  — Add an API key'));
  console.log(chalk.white('  /keys list') + chalk.gray('                 — List all configured keys'));
  console.log(chalk.white('  /keys remove <provider> <id>') + chalk.gray(' — Remove a key'));
  console.log(chalk.white('  /keys test <provider>') + chalk.gray('      — Test a key\'s validity'));
  console.log(chalk.white('  /status') + chalk.gray('                    — Show quota and session status'));
  console.log(chalk.white('  /model [provider] [model]') + chalk.gray('  — Force provider/model selection'));
  console.log(chalk.white('  /model auto') + chalk.gray('                — Reset to auto provider selection'));
  console.log(chalk.white('  /compact') + chalk.gray('                   — Manually trigger context compaction'));
  console.log(chalk.white('  /help') + chalk.gray('                      — Show this help'));
  console.log(chalk.white('  /exit, /quit, exit') + chalk.gray('          — Quit OmniLLM'));

  console.log(chalk.bold.white('\nProviders:'));
  const providers = [
    ['groq', 'Groq (fast inference)'],
    ['gemini', 'Google AI Studio (1M context)'],
    ['cerebras', 'Cerebras (batch)'],
    ['sambanova', 'SambaNova (405B models)'],
    ['openrouter', 'OpenRouter (multi-model)'],
    ['github_models', 'GitHub Models (GPT-4o free)'],
    ['nvidia_nim', 'NVIDIA NIM'],
    ['mistral', 'Mistral La Plateforme'],
    ['cohere', 'Cohere'],
    ['fireworks', 'Fireworks AI'],
    ['ollama', 'Ollama (local, no key needed)'],
  ];

  for (const [id, desc] of providers) {
    console.log(
      chalk.white(`  ${id}`.padEnd(18)) + chalk.gray(desc)
    );
  }

  console.log(chalk.bold.white('\nEnvironment Variables:'));
  console.log(chalk.gray('  Set API keys in ~/.config/omnillm/keys.json or via /keys add'));
  console.log(chalk.gray('  See .env.example for all env var options'));

  console.log(chalk.bold.white('\nHow it works:'));
  console.log(chalk.gray('  • Auto-routes to the best available free provider'));
  console.log(chalk.gray('  • Switches providers when rate limits are hit'));
  console.log(chalk.gray('  • Compacts conversation context when switching to smaller-window models'));
  console.log(chalk.gray('  • Tracks RPM/TPM/RPD/TPD quotas per key'));
  console.log(chalk.gray('  • Keys are encrypted and stored locally (~/.config/omnillm/)'));

  console.log();
}
