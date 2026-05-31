import OpenAI from 'openai';
import type { Message } from '../context/types.js';
import { PROVIDERS, getProvider } from './registry.js';
import { getDecryptedKey } from '../keys/store.js';
import type { ToolCall } from '../agent/types.js';

export interface ChatOptions {
  tools?: any[];
  stream?: boolean;
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  maxTokens?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: Message;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason: string;
}

export interface ApiCaller {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  complete(prompt: string, options: { maxTokens: number }): Promise<string>;
}

export class ProviderClient implements ApiCaller {
  private client: OpenAI;
  private providerId: string;
  private keyId: string;
  private modelId: string;

  constructor(providerId: string, keyId: string, modelId: string) {
    this.providerId = providerId;
    this.keyId = keyId;
    this.modelId = modelId;

    const provider = getProvider(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    const apiKey = provider.isLocal
      ? 'ollama'
      : getDecryptedKey(providerId, keyId);

    if (!apiKey && provider.requiresKey) {
      throw new Error(`No API key found for ${provider.displayName} (keyId: ${keyId})`);
    }

    const config: any = {
      apiKey: apiKey ?? '',
      baseURL: provider.baseURL,
    };

    if (provider.extraHeaders) {
      config.defaultHeaders = provider.extraHeaders;
    }

    this.client = new OpenAI(config);
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    const provider = getProvider(this.providerId);
    if (!provider) throw new Error(`Unknown provider: ${this.providerId}`);

    const openaiMessages = messages.map(m => {
      const msg: any = {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      };
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.name) msg.name = m.name;
      return msg;
    });

    if (options.stream) {
      return this.streamChat(openaiMessages, options);
    }

    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: openaiMessages as any,
      tools: options.tools as any,
      max_tokens: options.maxTokens,
    } as any);

    const choice = response.choices[0];
    const finishReason = choice.finish_reason ?? 'stop';

    const message: Message = {
      role: 'assistant',
      content: choice.message.content ?? '',
    };

    if (choice.message.tool_calls?.length) {
      message.tool_calls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return {
      id: response.id,
      model: response.model,
      message,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
      finishReason,
    };
  }

  private async streamChat(
    messages: any[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.modelId,
      messages: messages as any,
      tools: options.tools as any,
      max_tokens: options.maxTokens,
      stream: true,
    } as any) as any;

    let content = '';
    const toolCalls: Map<number, ToolCall> = new Map();
    let finishReason = 'stop';

    for await (const chunk of stream as any) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        options.onToken?.(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index ?? 0;
          let existing = toolCalls.get(index);
          if (!existing) {
            existing = {
              id: tc.id ?? '',
              type: 'function',
              function: { name: tc.function?.name ?? '', arguments: '' },
            };
            toolCalls.set(index, existing);
          }
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name = tc.function.name;
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    const tcList = Array.from(toolCalls.values()).sort((a: any, b: any) => a.index - b.index);

    const message: Message = {
      role: 'assistant',
      content: content || '',
    };
    if (tcList.length > 0) {
      message.tool_calls = tcList;
    }

    return {
      id: `stream-${Date.now()}`,
      model: this.modelId,
      message,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finishReason,
    };
  }

  async complete(prompt: string, options: { maxTokens: number }): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens,
    } as any);

    return response.choices[0]?.message?.content ?? '';
  }
}

export function isRateLimitError(err: any): boolean {
  if (err?.status === 429) return true;
  if (err?.status === 503) return true;
  const msg = (err?.message ?? err?.toString() ?? '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('rate_limit')) return true;
  if (msg.includes('resource_exhausted') || msg.includes('quota')) return true;
  return false;
}

export function parseRetryAfter(err: any): number | null {
  const header = err?.response?.headers?.get?.('retry-after');
  if (header) {
    const num = parseInt(header, 10);
    return Number.isNaN(num) ? 5000 : num * 1000;
  }
  const resetHeader = err?.response?.headers?.get?.('x-ratelimit-reset-requests');
  if (resetHeader) {
    const num = parseInt(resetHeader, 10);
    return Number.isNaN(num) ? 5000 : num * 1000;
  }
  return null;
}

export function isProviderError(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  return status === 500 || status === 502 || status === 503;
}
