import { randomUUID } from 'node:crypto';
import type { AgentContext, Message, KeyDecision, ProviderSwitch } from './types.js';
import { countMessagesTokens, countMessageTokens } from './token-counter.js';

export function createContext(
  taskGoal: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): AgentContext {
  return {
    taskGoal,
    systemPrompt,
    messages: [{ role: 'system', content: systemPrompt }],
    completedSteps: [],
    currentStep: 'Starting',
    keyDecisions: [],
    pendingToolCalls: [],
    totalTokensUsed: 0,
    compactionCount: 0,
    sessionId: randomUUID(),
    startedAt: Date.now(),
    currentProvider: '',
    providerHistory: [],
  };
}

export function addMessage(context: AgentContext, message: Message): AgentContext {
  return {
    ...context,
    messages: [...context.messages, message],
  };
}

export function addMessages(context: AgentContext, messages: Message[]): AgentContext {
  return {
    ...context,
    messages: [...context.messages, ...messages],
  };
}

export function addCompletedStep(context: AgentContext, step: string): AgentContext {
  return {
    ...context,
    completedSteps: [...context.completedSteps, step],
  };
}

export function addKeyDecision(context: AgentContext, fact: string): AgentContext {
  const step = context.completedSteps.length + 1;
  return {
    ...context,
    keyDecisions: [...context.keyDecisions, { step, fact }],
  };
}

export function setCurrentStep(context: AgentContext, step: string): AgentContext {
  return { ...context, currentStep: step };
}

export function addProviderSwitch(context: AgentContext, sw: ProviderSwitch): AgentContext {
  return {
    ...context,
    providerHistory: [...context.providerHistory, sw],
  };
}

export function updateTokenCount(context: AgentContext, tokensDelta: number): AgentContext {
  return {
    ...context,
    totalTokensUsed: context.totalTokensUsed + tokensDelta,
  };
}

export function getContextTokenCount(context: AgentContext): number {
  return countMessagesTokens(context.messages);
}

export function getRemainingCapacity(context: AgentContext, contextWindow: number): number {
  return contextWindow - countMessagesTokens(context.messages);
}

export function needsCompaction(context: AgentContext, contextWindow: number, threshold: number = 0.8): boolean {
  if (context.pendingToolCalls.length > 0) return false;
  return countMessagesTokens(context.messages) > contextWindow * threshold;
}

export function canCompact(context: AgentContext): boolean {
  return context.pendingToolCalls.length === 0;
}

export const DEFAULT_SYSTEM_PROMPT = `You are OmniLLM, an AI coding assistant and general-purpose agent.
You have access to tools for reading/writing files, running shell commands, fetching web content, and listing directories.

When coding:
- Use best practices for the language/framework
- Write clean, readable code
- Handle errors properly
- Consider edge cases

When using tools:
- Explain what you're doing before executing
- Report results clearly
- If a tool fails, explain why and suggest alternatives

Be direct and efficient. Don't be overly verbose — get to the point.`;
