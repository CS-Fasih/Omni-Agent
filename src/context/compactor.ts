import type { AgentContext, Message, KeyDecision } from './types.js';
import { countMessagesTokens, countMessageTokens, extractText } from './token-counter.js';

const VERBATIM_TAIL = 8;
const RESPONSE_BUFFER = 2048;

export interface CompactionCaller {
  complete(prompt: string, options: { maxTokens: number }): Promise<string>;
}

export async function compact(
  context: AgentContext,
  targetTokenBudget: number,
  caller: CompactionCaller
): Promise<AgentContext> {
  const availableBudget = targetTokenBudget - RESPONSE_BUFFER;

  const fixedMessages: Message[] = [];
  if (context.messages[0]?.role === 'system') {
    fixedMessages.push(context.messages[0]);
  } else {
    fixedMessages.push({ role: 'system', content: context.systemPrompt });
  }

  const tailMessages = context.messages.slice(-VERBATIM_TAIL);

  const systemTokens = countMessageTokens(fixedMessages[0]);
  const tailTokens = countMessagesTokens(tailMessages);
  const stateMessage = buildStateMessage(context);
  const stateTokens = countMessageTokens(stateMessage);

  const budgetForHistory = availableBudget - systemTokens - tailTokens - stateTokens - 200;

  const oldMessages = context.messages.slice(
    context.messages[0]?.role === 'system' ? 1 : 0,
    -VERBATIM_TAIL
  );

  if (oldMessages.length === 0) return context;

  const oldTokens = countMessagesTokens(oldMessages);
  if (oldTokens <= budgetForHistory) {
    return context;
  }

  let summary: string;
  try {
    const summaryPrompt = buildSummaryPrompt(oldMessages, context.taskGoal);
    summary = await caller.complete(summaryPrompt, { maxTokens: 512 });
  } catch {
    summary = buildFallbackSummary(context.completedSteps, context.keyDecisions);
  }

  const compactedSystemPrompt = buildSystemPromptWithSummary(
    context.systemPrompt,
    summary,
    context.completedSteps,
    context.keyDecisions
  );

  const compactedMessages: Message[] = [
    { role: 'system', content: compactedSystemPrompt },
    {
      role: 'user',
      content: `[Context Note: Earlier conversation has been summarized above to fit within model limits. Continuing from current state.]`,
    },
    {
      role: 'assistant',
      content: `Understood. I'll continue based on the summary. Current step: ${context.currentStep}`,
    },
    ...tailMessages,
  ];

  const finalTokens = countMessagesTokens(compactedMessages);
  if (finalTokens > availableBudget) {
    return compact(
      { ...context, messages: context.messages.slice(-4) },
      targetTokenBudget,
      caller
    );
  }

  return {
    ...context,
    messages: compactedMessages,
    compactionCount: context.compactionCount + 1,
  };
}

function buildSystemPromptWithSummary(
  base: string,
  summary: string,
  completedSteps: string[],
  keyDecisions: KeyDecision[]
): string {
  const parts = [base];
  if (summary) {
    parts.push(`\n## CONVERSATION SUMMARY (earlier context, compacted)\n${summary}`);
  }
  if (completedSteps.length > 0) {
    parts.push(
      `\n## COMPLETED STEPS\n${completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    );
  }
  if (keyDecisions.length > 0) {
    parts.push(
      `\n## KEY FACTS DISCOVERED\n${keyDecisions.map(d => `- [Step ${d.step}] ${d.fact}`).join('\n')}`
    );
  }
  parts.push(`\n## INSTRUCTION\nContinue the task from where it was left off. Do NOT re-do completed steps.`);
  return parts.join('\n');
}

function buildSummaryPrompt(messages: Message[], taskGoal: string): string {
  const convo = messages
    .map(m => {
      const role = m.role.toUpperCase();
      const text = extractText(m.content);
      const toolInfo = m.tool_calls
        ? m.tool_calls.map(tc => `[Tool: ${tc.function.name}(${tc.function.arguments})]`).join(' ')
        : '';
      return `${role}: ${text} ${toolInfo}`;
    })
    .join('\n\n');

  return `Summarize the following conversation segment into a compact paragraph.
Focus on: what was done, what was found, what decisions were made.
Preserve specific file names, function names, error messages, and URLs mentioned.
Task goal: ${taskGoal}

CONVERSATION:
${convo.slice(-8000)}

SUMMARY (max 300 words):`;
}

function buildFallbackSummary(completedSteps: string[], keyDecisions: KeyDecision[]): string {
  const parts: string[] = [];
  if (completedSteps.length > 0) {
    parts.push(`Previously completed: ${completedSteps.slice(-10).join('; ')}`);
  }
  if (keyDecisions.length > 0) {
    parts.push(
      `Key findings: ${keyDecisions
        .slice(-5)
        .map(d => d.fact)
        .join('; ')}`
    );
  }
  return parts.join('. ') || 'Conversation context has been trimmed to fit within model limits.';
}

function buildStateMessage(context: AgentContext): Message {
  const parts: string[] = [];
  if (context.completedSteps.length > 0) {
    parts.push(
      `COMPLETED: ${context.completedSteps.slice(-5).join('; ')}`
    );
  }
  if (context.keyDecisions.length > 0) {
    parts.push(
      `KEY FACTS: ${context.keyDecisions
        .slice(-5)
        .map(d => d.fact)
        .join('; ')}`
    );
  }
  return {
    role: 'user',
    content: parts.length > 0
      ? `[Task progress]\n${parts.join('\n')}\n\nCurrent step: ${context.currentStep}`
      : `Current step: ${context.currentStep}`,
  };
}
