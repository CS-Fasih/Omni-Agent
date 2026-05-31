import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToolResult } from '../types.js';

export async function listDir(args: { path?: string; recursive?: boolean }): Promise<ToolResult> {
  try {
    const dirPath = resolve(args.path ?? '.');
    if (!existsSync(dirPath)) {
      return {
        id: '',
        name: 'list_dir',
        result: `Directory not found: ${dirPath}`,
        success: false,
        error: 'Directory not found',
      };
    }

    const entries = readdirSync(dirPath, { withFileTypes: true });
    const dirs: string[] = [];
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        dirs.push(`📁 ${entry.name}/`);
      } else if (entry.isFile()) {
        try {
          const stats = statSync(resolve(dirPath, entry.name));
          files.push(`📄 ${entry.name} (${stats.size} bytes)`);
        } catch {
          files.push(`📄 ${entry.name}`);
        }
      } else {
        files.push(`🔗 ${entry.name}`);
      }
    }

    const result = [`Directory: ${dirPath}`, ''];
    if (dirs.length > 0) {
      result.push('Directories:');
      dirs.forEach(d => result.push(`  ${d}`));
      result.push('');
    }
    if (files.length > 0) {
      result.push('Files:');
      files.forEach(f => result.push(`  ${f}`));
    }

    return {
      id: '',
      name: 'list_dir',
      result: result.join('\n') || '(empty directory)',
      success: true,
    };
  } catch (err: any) {
    return {
      id: '',
      name: 'list_dir',
      result: `Error listing directory: ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}
