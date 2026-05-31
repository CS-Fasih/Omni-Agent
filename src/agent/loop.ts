import type { AgentContext } from '../context/types.js';
import type { AgentState } from './types.js';
import { addMessage, addCompletedStep, addProviderSwitch, setCurrentStep, needsCompaction } from '../context/manager.js';
import { compact } from '../context/compactor.js';
import { countMessagesTokens, estimateNextCallTokens } from '../context/token-counter.js';
import { classifyTask } from '../router/classifier.js';
import { selectProvider } from '../router/selector.js';
import { getConfiguredProviders } from '../keys/store.js';
import { quotaTracker } from '../quota/tracker.js';
import { ProviderClient, isRateLimitError, parseRetryAfter, isProviderError } from '../providers/client.js';
import { PROVIDERS, getBestModel } from '../providers/registry.js';
import { TOOL_DEFINITIONS, executeToolCall } from './tools/index.js';

export interface AgentLoopConfig {
  maxToolCalls?: number;
  maxProviderSwitches?: number;
  compactionThreshold?: number;
  renderer?: AgentRenderer;
}

export interface AgentRenderer {
  showThinking(provider: string, model: string): void;
  streamToken(token: string): void;
  showToolUse(toolCalls: any[]): void;
  showProviderSwitch(from: string, to: string): void;
  showStatus(message: string): void;
  showWarning(message: string): void;
  showError(error: any): void;
  showResponse(content: string): void;
}

const DEFAULT_CONFIG: Required<AgentLoopConfig> = {
  maxToolCalls: 25,
  maxProviderSwitches: 5,
  compactionThreshold: 0.8,
  renderer: defaultRenderer(),
};

function defaultRenderer(): AgentRenderer {
  return {
    showThinking: () => {},
    streamToken: () => {},
    showToolUse: () => {},
    showProviderSwitch: () => {},
    showStatus: () => {},
    showWarning: () => {},
    showError: () => {},
    showResponse: () => {},
  };
}

export async function runAgent(
  userMessage: string,
  context: AgentContext,
  config: AgentLoopConfig = {}
): Promise<AgentContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const renderer = cfg.renderer!;

  context = addMessage(context, { role: 'user', content: userMessage });

  let providerSwitchCount = 0;
  let toolCallCount = 0;
  const exhaustedProviders: string[] = [];

  while (true) {
    const availableProviders = getConfiguredProviders();
    if (availableProviders.length === 0) {
      renderer.showError(new Error('No API keys configured. Use /keys add <provider> <key> to add one.'));
      break;
    }

    const estimatedTokens = estimateNextCallTokens(context);
    const taskType = classifyTask(userMessage, context.messages);

    let selection = selectProvider(
      taskType,
      availableProviders,
      quotaTracker,
      estimatedTokens,
      exhaustedProviders[exhaustedProviders.length - 1]
    );

    if (!selection) {
      const notExhausted = availableProviders.filter(p => !exhaustedProviders.includes(p));
      if (notExhausted.length > 0) {
        exhaustedProviders.length = 0;
        continue;
      }
      renderer.showError(new Error('ALL_PROVIDERS_EXHAUSTED: All configured providers have hit their rate limits. Daily limits reset at midnight UTC.'));
      break;
    }

    const targetModel = selection.model;
    const contextTokens = countMessagesTokens(context.messages);
    const windowThreshold = targetModel.contextWindow * cfg.compactionThreshold;

    if (contextTokens > windowThreshold && context.pendingToolCalls.length === 0) {
      renderer.showStatus(`Compacting context for ${targetModel.displayName}...`);
      try {
        const client = new ProviderClient(context.currentProvider || selection.providerId, selection.keyId, selection.model.id);
        context = await compact(context, targetModel.contextWindow * 0.75, client);
        const newTokens = countMessagesTokens(context.messages);
        renderer.showStatus(`Context compacted: ${contextTokens} → ${newTokens} tokens`);
      } catch (e) {
        context = { ...context, messages: context.messages.slice(-4) };
        renderer.showWarning('Compaction failed, keeping last 4 messages only');
      }
    }

    if (context.currentProvider && context.currentProvider !== selection.providerId) {
      const wasCompacted = contextTokens > windowThreshold;
      context = addProviderSwitch(context, {
        from: context.currentProvider,
        to: selection.providerId,
        reason: 'rate_limit',
        timestamp: Date.now(),
        tokensBefore: contextTokens,
        tokensAfter: countMessagesTokens(context.messages),
        wasCompacted,
      });
      renderer.showProviderSwitch(context.currentProvider, selection.providerId);
      providerSwitchCount++;
      if (providerSwitchCount > cfg.maxProviderSwitches) {
        renderer.showError(new Error('Too many provider switches. Check your API keys or wait for rate limits to reset.'));
        break;
      }
    }
    context = { ...context, currentProvider: selection.providerId };

    const client = new ProviderClient(selection.providerId, selection.keyId, selection.model.id);

    let response;
    try {
      renderer.showThinking(selection.providerId, targetModel.displayName);
      response = await client.chat(context.messages, {
        tools: TOOL_DEFINITIONS,
        stream: true,
        onToken: (t) => renderer.streamToken(t),
      });

      if (response.usage.total_tokens > 0) {
        quotaTracker.record(selection.providerId, selection.keyId, response.usage.total_tokens);
        context = { ...context, totalTokensUsed: context.totalTokensUsed + response.usage.total_tokens };
      }
    } catch (err: any) {
      if (isRateLimitError(err)) {
        const retryAfter = parseRetryAfter(err) ?? 5000;
        quotaTracker.markRateLimited(selection.providerId, selection.keyId, retryAfter);
        exhaustedProviders.push(selection.providerId);
        renderer.showWarning(`Rate limited on ${selection.providerId}, switching...`);
        continue;
      }

      if (isProviderError(err)) {
        exhaustedProviders.push(selection.providerId);
        renderer.showWarning(`Provider error on ${selection.providerId}: ${err.message}. Switching...`);
        continue;
      }

      renderer.showError(err);
      throw err;
    }

    context = addMessage(context, response.message);

    if (response.message.tool_calls?.length) {
      renderer.showToolUse(response.message.tool_calls);

      for (const tc of response.message.tool_calls) {
        if (toolCallCount >= cfg.maxToolCalls) {
          renderer.showWarning(`Max tool calls (${cfg.maxToolCalls}) reached.`);
          break;
        }

        context = { ...context, pendingToolCalls: [...context.pendingToolCalls, tc] };

        try {
          const result = await executeToolCall(tc);
          context = { ...context, pendingToolCalls: context.pendingToolCalls.filter(p => p.id !== tc.id) };

          context = addMessage(context, {
            role: 'tool',
            tool_call_id: tc.id,
            content: result.result,
          });

          context = addCompletedStep(
            context,
            `Used ${tc.function.name}: ${result.success ? '✓' : '✗'} ${tc.function.arguments.slice(0, 80)}`
          );

          toolCallCount++;
        } catch (toolErr: any) {
          context = { ...context, pendingToolCalls: context.pendingToolCalls.filter(p => p.id !== tc.id) };

          context = addMessage(context, {
            role: 'tool',
            tool_call_id: tc.id,
            content: `Error: ${toolErr.message}`,
          });

          context = addCompletedStep(context, `Tool ${tc.function.name} failed: ${toolErr.message}`);
        }
      }

      continue;
    }

    renderer.showResponse(response.message.content as string);
    break;
  }

  return context;
}
