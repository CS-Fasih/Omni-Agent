import { encodingForModel, type Tiktoken } from 'js-tiktoken';
import type { Message, ContentPart } from './types.js';

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = encodingForModel('gpt-4');
  }
  return encoder;
}

export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

function extractMessageText(msg: Message): string {
  if (typeof msg.content === 'string') return msg.content;
  if (!Array.isArray(msg.content)) return '';
  return msg.content
    .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
    .map(p => p.text)
    .join(' ');
}

const TOKEN_OVERHEAD_PER_MESSAGE = 4;

export function countMessageTokens(message: Message): number {
  const text = extractMessageText(message);
  let tokens = TOKEN_OVERHEAD_PER_MESSAGE;

  tokens += countTokens(message.role || '');
  tokens += countTokens(text);
  if (message.name) tokens += countTokens(message.name);

  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += countTokens(tc.function.name);
      tokens += countTokens(tc.function.arguments);
      tokens += countTokens(tc.id);
    }
  }

  if (message.tool_call_id) {
    tokens += countTokens(message.tool_call_id);
  }

  return tokens;
}

export function countMessagesTokens(messages: Message[]): number {
  let total = 3;
  for (const msg of messages) {
    total += countMessageTokens(msg);
  }
  return total;
}

export function estimateResponseTokens(messages: Message[]): number {
  const totalInput = countMessagesTokens(messages);
  return Math.min(Math.ceil(totalInput * 0.3), 4096);
}

export function estimateNextCallTokens(context: import('./types.js').AgentContext): number {
  const msgTokens = countMessagesTokens(context.messages);
  return msgTokens + estimateResponseTokens(context.messages);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

export function extractText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
    .map(p => p.text)
    .join(' ');
}
