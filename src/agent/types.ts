export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  id: string;
  name: string;
  result: string;
  success: boolean;
  error?: string;
}

export interface AgentState {
  status: 'idle' | 'thinking' | 'tool_use' | 'done' | 'error';
  currentProvider: string;
  currentModel: string;
  messageCount: number;
  toolCallCount: number;
  errorMessage?: string;
}
