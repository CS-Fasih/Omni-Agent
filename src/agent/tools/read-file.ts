import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type { ToolResult } from '../types.js';

export async function readFile(args: { path: string; offset?: number; limit?: number }): Promise<ToolResult> {
  try {
    const filePath = resolve(args.path);
    if (!existsSync(filePath)) {
      return {
        id: '',
        name: 'read_file',
        result: `File not found: ${filePath}`,
        success: false,
        error: 'File not found',
      };
    }

    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return {
        id: '',
        name: 'read_file',
        result: `Path is a directory, not a file: ${filePath}`,
        success: false,
        error: 'Is a directory',
      };
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (args.offset !== undefined || args.limit !== undefined) {
      const offset = args.offset ?? 0;
      const limit = args.limit ?? lines.length;
      const sliced = lines.slice(offset, offset + limit).join('\n');
      return {
        id: '',
        name: 'read_file',
        result: `File: ${filePath} (lines ${offset + 1}-${Math.min(offset + limit, lines.length)} of ${lines.length})\n\n${sliced}`,
        success: true,
      };
    }

    return {
      id: '',
      name: 'read_file',
      result: `File: ${filePath} (${lines.length} lines, ${content.length} bytes)\n\n${content}`,
      success: true,
    };
  } catch (err: any) {
    return {
      id: '',
      name: 'read_file',
      result: `Error reading file: ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}
