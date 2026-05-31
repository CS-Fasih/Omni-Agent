import type { ToolCall, ToolResult } from '../types.js';
import { readFile } from './read-file.js';
import { writeFile } from './write-file.js';
import { runShell } from './run-shell.js';
import { webFetch } from './web-fetch.js';
import { listDir } from './list-dir.js';

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
          offset: { type: 'number', description: 'Starting line number (0-based)' },
          limit: { type: 'number', description: 'Maximum number of lines to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating directories if needed',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_shell',
      description: 'Execute a shell command and return the output',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run' },
          directory: { type: 'string', description: 'Working directory for the command' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch (must start with http:// or https://)' },
          method: { type: 'string', description: 'HTTP method (default: GET)' },
          headers: { type: 'object', description: 'Additional HTTP headers' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List files and directories in a given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (default: current directory)' },
          recursive: { type: 'boolean', description: 'Whether to list recursively' },
        },
        required: [],
      },
    },
  },
];

export async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  const args = JSON.parse(toolCall.function.arguments) as Record<string, any>;

  let result: ToolResult;

  switch (toolCall.function.name) {
    case 'read_file':
      result = await readFile(args as any);
      break;
    case 'write_file':
      result = await writeFile(args as any);
      break;
    case 'run_shell':
      result = await runShell(args as any);
      break;
    case 'web_fetch':
      result = await webFetch(args as any);
      break;
    case 'list_dir':
      result = await listDir(args as any);
      break;
    default:
      result = {
        id: toolCall.id,
        name: toolCall.function.name,
        result: `Unknown tool: ${toolCall.function.name}`,
        success: false,
        error: `Unknown tool: ${toolCall.function.name}`,
      };
  }

  result.id = toolCall.id;
  return result;
}
