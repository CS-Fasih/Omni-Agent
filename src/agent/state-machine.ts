import type { AgentState } from './types.js';

export type AgentStatus = AgentState['status'];

export interface StateTransition {
  from: AgentStatus;
  to: AgentStatus;
  allowed: boolean;
}

const ALLOWED_TRANSITIONS: StateTransition[] = [
  { from: 'idle', to: 'thinking', allowed: true },
  { from: 'thinking', to: 'tool_use', allowed: true },
  { from: 'thinking', to: 'done', allowed: true },
  { from: 'thinking', to: 'error', allowed: true },
  { from: 'tool_use', to: 'thinking', allowed: true },
  { from: 'tool_use', to: 'done', allowed: true },
  { from: 'tool_use', to: 'error', allowed: true },
  { from: 'done', to: 'idle', allowed: true },
  { from: 'error', to: 'idle', allowed: true },
  { from: 'error', to: 'thinking', allowed: true },
];

export class AgentStateMachine {
  private _state: AgentState;

  constructor() {
    this._state = {
      status: 'idle',
      currentProvider: '',
      currentModel: '',
      messageCount: 0,
      toolCallCount: 0,
    };
  }

  get state(): AgentState {
    return { ...this._state };
  }

  get status(): AgentStatus {
    return this._state.status;
  }

  transition(to: AgentStatus): boolean {
    const transition = ALLOWED_TRANSITIONS.find(
      t => t.from === this._state.status && t.to === to
    );
    if (!transition?.allowed) {
      return false;
    }
    this._state.status = to;
    return true;
  }

  setProvider(provider: string, model: string): void {
    this._state.currentProvider = provider;
    this._state.currentModel = model;
  }

  incrementMessages(): void {
    this._state.messageCount += 1;
  }

  incrementToolCalls(): void {
    this._state.toolCallCount += 1;
  }

  setError(message: string): void {
    this._state.status = 'error';
    this._state.errorMessage = message;
  }

  reset(): void {
    this._state = {
      status: 'idle',
      currentProvider: this._state.currentProvider,
      currentModel: this._state.currentModel,
      messageCount: 0,
      toolCallCount: 0,
      errorMessage: undefined,
    };
  }
}
