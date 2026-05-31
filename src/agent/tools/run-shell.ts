import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolResult } from '../types.js';

const execAsync = promisify(exec);

export async function runShell(args: {
  command: string;
  directory?: string;
  timeout?: number;
}): Promise<ToolResult> {
  try {
    const options: any = {
      timeout: args.timeout ?? 30000,
      maxBuffer: 1024 * 1024,
    };
    if (args.directory) {
      options.cwd = args.directory;
    }

    const { stdout, stderr } = await execAsync(args.command, options);
    const output = [stdout, stderr ? `\n[stderr]: ${stderr}` : ''].filter(Boolean).join('\n');

    return {
      id: '',
      name: 'run_shell',
      result: output || '(no output)',
      success: true,
    };
  } catch (err: any) {
    const stdout = err.stdout ?? '';
    const stderr = err.stderr ?? '';
    const output = [stdout, stderr].filter(Boolean).join('\n');

    return {
      id: '',
      name: 'run_shell',
      result: output || `Command failed: ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}
