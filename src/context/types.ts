import type { ToolCall } from '../agent/types.js';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface KeyDecision {
  step: number;
  fact: string;
}

export interface ProviderSwitch {
  from: string;
  to: string;
  reason: 'rate_limit' | 'error' | 'manual' | 'context_size';
  timestamp: number;
  tokensBefore: number;
  tokensAfter: number;
  wasCompacted: boolean;
}

export interface AgentContext {
  taskGoal: string;
  systemPrompt: string;
  messages: Message[];
  completedSteps: string[];
  currentStep: string;
  keyDecisions: KeyDecision[];
  pendingToolCalls: ToolCall[];
  totalTokensUsed: number;
  compactionCount: number;
  sessionId: string;
  startedAt: number;
  currentProvider: string;
  providerHistory: ProviderSwitch[];
}

export interface CompactionResult {
  compactedContext: AgentContext;
  oldTokenCount: number;
  newTokenCount: number;
  summaryText: string;
}
