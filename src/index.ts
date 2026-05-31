#!/usr/bin/env node
import 'dotenv/config';
import { startRepl } from './cli/repl.js';

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  process.exit(0);
});

startRepl().catch((err) => {
  console.error('Failed to start OmniLLM:', err.message);
  process.exit(1);
});
