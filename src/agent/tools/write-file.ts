import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ToolResult } from '../types.js';

export async function writeFile(args: { path: string; content: string }): Promise<ToolResult> {
  try {
    const filePath = resolve(args.path);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, args.content, 'utf-8');
    const stats = existsSync(filePath) ? `(${args.content.length} bytes)` : '';

    return {
      id: '',
      name: 'write_file',
      result: `Successfully wrote: ${filePath} ${stats}`,
      success: true,
    };
  } catch (err: any) {
    return {
      id: '',
      name: 'write_file',
      result: `Error writing file: ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}
