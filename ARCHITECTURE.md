# OMNILLM CLI — Complete Architecture Plan
> A multi-provider LLM CLI agent (Claude Code style). BYOK. No backend. No accounts.
> Version: 1.0 | Status: Ready for implementation

---

## 0. CRITICAL DECISIONS (Read before anything else)

| Decision | Choice | Reason |
|---|---|---|
| Language | **TypeScript + Node.js** | `npx omnillm` distribution — zero install friction |
| Distribution | `npm` (`npx` or `npm i -g`) | One command, works on all OS |
| Key Storage | `~/.config/omnillm/keys.json` (AES-256 encrypted) | CLI has no localStorage |
| Quota Storage | `~/.config/omnillm/quota.json` | Persists across sessions |
| Provider Interface | OpenAI-compatible for all | All 12 providers support `/v1/chat/completions` |
| Context Format | OpenAI `messages[]` array | Universal, works on every provider |
| Token Counting | `js-tiktoken` (cl100k_base) | Approximate but consistent across providers |
| Terminal UI | `ink` (React for CLI) + `chalk` | Claude Code-style interactive REPL |
| Agent Tools | File R/W, Shell exec, Web fetch | Core agentic capabilities |

---

## 1. TECHNOLOGY STACK

```
Runtime:       Node.js >= 20 (LTS)
Language:      TypeScript 5.x (strict mode)
Package Mgr:   npm

Core Libraries:
  openai              ^4.x      — API client (works for all OpenAI-compat providers)
  ink                 ^5.x      — React-based terminal UI
  ink-text-input      ^5.x      — Input component for ink
  chalk               ^5.x      — Terminal colors
  commander           ^12.x     — CLI command parsing
  js-tiktoken         ^1.x      — Token counting
  conf                ^12.x     — Config file management (~/.config)
  keytar              ^7.x      — OS keychain (fallback: AES file encryption)
  ora                 ^8.x      — Spinners
  figures             ^6.x      — Terminal symbols
  zod                 ^3.x      — Runtime type validation
  p-retry             ^6.x      — Retry with backoff
  dotenv              ^16.x     — .env file support

Dev:
  typescript, tsx, @types/node, esbuild (for bundling)
```

**Entry point:** `npx omnillm` → launches interactive REPL

---

## 2. COMPLETE DIRECTORY STRUCTURE

```
omnillm/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
├── src/
│   ├── index.ts                        # Entry: parse args, launch REPL or run command
│   │
│   ├── cli/
│   │   ├── repl.ts                     # Main interactive loop (ink app)
│   │   ├── commands/
│   │   │   ├── index.ts                # Command dispatcher (parses / prefixed commands)
│   │   │   ├── keys.ts                 # /keys add|list|remove|test
│   │   │   ├── status.ts               # /status — quota dashboard
│   │   │   ├── model.ts                # /model — force switch provider
│   │   │   ├── compact.ts              # /compact — manual context compaction
│   │   │   └── help.ts                 # /help
│   │   ├── renderer.ts                 # Format output: streaming text, tool use, errors
│   │   └── status-bar.ts               # Bottom bar: current provider, tokens used, quota %
│   │
│   ├── providers/
│   │   ├── types.ts                    # All interfaces: ProviderDef, ModelDef, RateLimits
│   │   ├── registry.ts                 # SINGLE SOURCE OF TRUTH: all 12 providers defined here
│   │   ├── client.ts                   # Unified API caller using openai SDK
│   │   └── implementations/            # Per-provider quirks (non-standard auth, errors, etc.)
│   │       ├── groq.ts
│   │       ├── gemini.ts               # Google AI Studio — uses different base URL
│   │       ├── cerebras.ts
│   │       ├── sambanova.ts
│   │       ├── openrouter.ts           # Needs extra headers: HTTP-Referer, X-Title
│   │       ├── github-models.ts        # Uses GitHub token format
│   │       ├── nvidia-nim.ts
│   │       ├── mistral.ts
│   │       ├── cohere.ts
│   │       ├── fireworks.ts
│   │       ├── cloudflare.ts           # Different URL pattern: accountId in URL
│   │       └── ollama.ts               # Local fallback: no key needed
│   │
│   ├── router/
│   │   ├── types.ts                    # TaskProfile, RoutingDecision interfaces
│   │   ├── classifier.ts               # Detect task type from message content
│   │   ├── selector.ts                 # Given task + available providers → best choice
│   │   └── fallback-chain.ts           # Ordered fallback list per task type
│   │
│   ├── context/
│   │   ├── types.ts                    # AgentContext, Message, CompactionResult
│   │   ├── manager.ts                  # Create, update, query context
│   │   ├── compactor.ts                # THE CRITICAL MODULE: compress context for window switch
│   │   └── token-counter.ts            # Count tokens for messages[], estimate response size
│   │
│   ├── quota/
│   │   ├── types.ts                    # QuotaState, UsageRecord, WindowState
│   │   ├── tracker.ts                  # Sliding window RPM/TPM + daily RPD/TPD
│   │   └── storage.ts                  # Read/write quota.json with daily reset logic
│   │
│   ├── keys/
│   │   ├── types.ts                    # KeyStore, ProviderKey
│   │   ├── store.ts                    # CRUD for API keys, encrypted storage
│   │   └── validator.ts                # Key format validation per provider
│   │
│   ├── agent/
│   │   ├── types.ts                    # AgentState, ToolCall, ToolResult
│   │   ├── loop.ts                     # MAIN AGENT LOOP — orchestrates everything
│   │   ├── state-machine.ts            # idle → thinking → tool_use → done states
│   │   ├── tools/
│   │   │   ├── index.ts                # Tool registry + dispatcher
│   │   │   ├── read-file.ts
│   │   │   ├── write-file.ts
│   │   │   ├── run-shell.ts
│   │   │   ├── web-fetch.ts
│   │   │   └── list-dir.ts
│   │
│   └── config/
│       ├── defaults.ts                 # Default routing rules, fallback chains
│       └── manager.ts                  # R/W ~/.config/omnillm/ directory
│
└── dist/                               # Compiled output (esbuild bundle)
    └── index.js                        # Single file, `#!/usr/bin/env node`
```

---

## 3. PROVIDER REGISTRY — Complete Definitions

**File: `src/providers/registry.ts`**

Every field is used by other modules — do not omit any.

```typescript
// src/providers/types.ts
export type TaskType =
  | 'fast_reasoning'    // Quick decisions, routing, classification
  | 'long_context'      // Documents > 32K tokens, PDFs
  | 'coding'            // Code generation, debugging
  | 'multimodal'        // Image + text
  | 'large_model'       // Tasks needing 70B+ model
  | 'batch'             // High volume, speed not critical
  | 'general'           // Default fallback

export interface ModelDefinition {
  id: string            // Exact model string to pass to API
  displayName: string
  contextWindow: number  // Max tokens (input + output)
  maxOutput: number      // Max output tokens
  strengths: TaskType[]
  isFree: boolean
}

export interface RateLimitDefinition {
  rpm?: number           // Requests per minute (undefined = unknown/no limit)
  tpm?: number           // Tokens per minute
  rpd?: number           // Requests per day
  tpd?: number           // Tokens per day
}

export interface ProviderDefinition {
  id: string
  displayName: string
  baseURL: string
  apiKeyHeader: string   // Usually 'Authorization', sometimes different
  apiKeyFormat: string   // e.g. 'Bearer {key}', '{key}'
  models: ModelDefinition[]
  freeTierLimits: RateLimitDefinition
  
  // Error detection
  rateLimitStatusCodes: number[]     // [429] usually
  rateLimitErrorPatterns: string[]   // Substrings in error message
  retryAfterHeader: string           // 'retry-after' or 'x-ratelimit-reset-requests'
  
  // Extra headers needed (e.g. OpenRouter)
  extraHeaders?: Record<string, string>
  
  // Provider availability
  requiresKey: boolean   // false for Ollama
  isLocal: boolean       // true for Ollama
  
  // Routing priority (lower = preferred, checked first)
  routingPriority: number
  strengthsFor: TaskType[]
}

// ─────────────────────────────────────────
// THE REGISTRY
// ─────────────────────────────────────────
export const PROVIDERS: Record<string, ProviderDefinition> = {

  groq: {
    id: 'groq',
    displayName: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        displayName: 'Llama 3.3 70B',
        contextWindow: 32768,
        maxOutput: 8192,
        strengths: ['fast_reasoning', 'coding', 'general'],
        isFree: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        displayName: 'Llama 3.1 8B (instant)',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['fast_reasoning'],
        isFree: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        displayName: 'Mixtral 8x7B',
        contextWindow: 32768,
        maxOutput: 8192,
        strengths: ['coding', 'general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 30, tpm: 6000, rpd: 14400 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate_limit_exceeded', 'Rate limit reached'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 1,
    strengthsFor: ['fast_reasoning', 'coding'],
  },

  gemini: {
    id: 'gemini',
    displayName: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        contextWindow: 1000000,
        maxOutput: 8192,
        strengths: ['long_context', 'multimodal', 'general'],
        isFree: true,
      },
      {
        id: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutput: 8192,
        strengths: ['long_context', 'multimodal'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 15, rpd: 1500, tpm: 1000000 },
    rateLimitStatusCodes: [429, 503],
    rateLimitErrorPatterns: ['RESOURCE_EXHAUSTED', 'quota exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 2,
    strengthsFor: ['long_context', 'multimodal'],
  },

  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'llama3.1-70b',
        displayName: 'Llama 3.1 70B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['batch', 'general'],
        isFree: true,
      },
      {
        id: 'llama3.1-8b',
        displayName: 'Llama 3.1 8B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['fast_reasoning', 'batch'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 30, tpm: 60000, tpd: 1000000 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate_limit', 'quota_exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 3,
    strengthsFor: ['batch'],
  },

  sambanova: {
    id: 'sambanova',
    displayName: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'Meta-Llama-3.3-70B-Instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['large_model', 'general'],
        isFree: true,
      },
      {
        id: 'Meta-Llama-3.1-405B-Instruct',
        displayName: 'Llama 3.1 405B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['large_model', 'coding'],
        isFree: true,
      },
      {
        id: 'Qwen2.5-72B-Instruct',
        displayName: 'Qwen 2.5 72B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['coding', 'general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 10, tpd: 200000 },  // rpm=10 for 405B, 30 for smaller
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'quota'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 4,
    strengthsFor: ['large_model'],
  },

  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/omnillm',
      'X-Title': 'OmniLLM CLI',
    },
    models: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        displayName: 'Llama 3.3 70B (free)',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
      {
        id: 'deepseek/deepseek-r1:free',
        displayName: 'DeepSeek R1 (free)',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['coding', 'fast_reasoning'],
        isFree: true,
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        displayName: 'Gemini 2.0 Flash (free)',
        contextWindow: 1000000,
        maxOutput: 4096,
        strengths: ['long_context'],
        isFree: true,
      },
      // NOTE: OpenRouter free model list changes frequently.
      // At runtime, fetch https://openrouter.ai/api/v1/models and filter price == "0"
    ],
    freeTierLimits: { rpm: 20 }, // Varies per model on free tier
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'credits'],
    retryAfterHeader: 'x-ratelimit-reset-requests',
    requiresKey: true,
    isLocal: false,
    routingPriority: 5,
    strengthsFor: ['general'],
  },

  github_models: {
    id: 'github_models',
    displayName: 'GitHub Models',
    baseURL: 'https://models.inference.ai.azure.com',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',  // GitHub PAT
    models: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutput: 4096,
        strengths: ['coding', 'general'],
        isFree: true,
      },
      {
        id: 'meta-llama-3.3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 8192,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpd: 150, rpm: 10 }, // For GPT-4o
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 6,
    strengthsFor: ['coding'],
  },

  nvidia_nim: {
    id: 'nvidia_nim',
    displayName: 'NVIDIA NIM',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'deepseek-ai/deepseek-r1',
        displayName: 'DeepSeek R1',
        contextWindow: 65536,
        maxOutput: 4096,
        strengths: ['coding', 'fast_reasoning'],
        isFree: true,
      },
      {
        id: 'meta/llama-3.3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 40, rpd: 1000 },
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit', 'quota exceeded'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 7,
    strengthsFor: ['coding'],
  },

  mistral: {
    id: 'mistral',
    displayName: 'Mistral (La Plateforme)',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'mistral-small-latest',
        displayName: 'Mistral Small',
        contextWindow: 32768,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 1, rpd: 500 }, // Very limited
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['too many requests'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 9,
    strengthsFor: ['general'],
  },

  fireworks: {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer {key}',
    models: [
      {
        id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        displayName: 'Llama 3.3 70B',
        contextWindow: 131072,
        maxOutput: 4096,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: { rpm: 10 }, // Without payment method
    rateLimitStatusCodes: [429],
    rateLimitErrorPatterns: ['rate limit'],
    retryAfterHeader: 'retry-after',
    requiresKey: true,
    isLocal: false,
    routingPriority: 10,
    strengthsFor: ['general'],
  },

  ollama: {
    id: 'ollama',
    displayName: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    apiKeyHeader: 'Authorization',
    apiKeyFormat: 'Bearer ollama',  // Dummy key, not validated
    models: [
      // Dynamically fetched at runtime from GET /api/tags
      // Default fallback assumption:
      {
        id: 'llama3.2',
        displayName: 'Llama 3.2 (local)',
        contextWindow: 4096,
        maxOutput: 2048,
        strengths: ['general'],
        isFree: true,
      },
    ],
    freeTierLimits: {}, // No limits (local)
    rateLimitStatusCodes: [],
    rateLimitErrorPatterns: [],
    retryAfterHeader: '',
    requiresKey: false,
    isLocal: true,
    routingPriority: 99, // Last resort
    strengthsFor: ['general'],
  },
}
```

---

## 4. QUOTA TRACKER — Detailed Algorithm

**File: `src/quota/tracker.ts`**

This is the heart of the switching logic. Must be accurate.

```typescript
// src/quota/types.ts

export interface WindowEntry {
  timestamp: number   // Unix ms
  tokens: number      // Tokens used in this request (0 for RPM-only tracking)
}

export interface ProviderKeyQuota {
  provider: string
  keyId: string       // sha256(key).slice(0,8) — for logging, never store raw key

  // Sliding window state (in-memory, NOT persisted — resets on app restart)
  requestWindow: number[]      // Array of timestamps (last 60s)
  tokenWindow: WindowEntry[]   // Array of {timestamp, tokens} (last 60s)

  // Daily counters (persisted to quota.json)
  requestsToday: number
  tokensToday: number
  dailyResetDate: string       // 'YYYY-MM-DD' UTC — compare to reset

  // Computed at query time
  isHardBlocked: boolean       // daily limit hit
}

// src/quota/tracker.ts

const WINDOW_MS = 60 * 1000  // 1 minute sliding window

export class QuotaTracker {
  private state: Map<string, ProviderKeyQuota> = new Map()

  // Called before making an API call
  // Returns: { canProceed, reason, waitMs }
  check(providerId: string, keyId: string, estimatedTokens: number): CheckResult {
    const limits = PROVIDERS[providerId].freeTierLimits
    const quota = this.getOrCreate(providerId, keyId)
    const now = Date.now()

    // Reset daily if needed
    this.maybeResetDaily(quota)

    // Purge old sliding window entries (older than 60s)
    quota.requestWindow = quota.requestWindow.filter(t => now - t < WINDOW_MS)
    quota.tokenWindow = quota.tokenWindow.filter(e => now - e.timestamp < WINDOW_MS)

    // Check RPM
    if (limits.rpm && quota.requestWindow.length >= limits.rpm) {
      const oldestRequest = quota.requestWindow[0]
      const waitMs = WINDOW_MS - (now - oldestRequest) + 100 // +100ms buffer
      return { canProceed: false, reason: 'rpm', waitMs }
    }

    // Check TPM
    if (limits.tpm) {
      const tokensInWindow = quota.tokenWindow.reduce((sum, e) => sum + e.tokens, 0)
      if (tokensInWindow + estimatedTokens > limits.tpm) {
        const oldestToken = quota.tokenWindow[0]
        const waitMs = oldestToken
          ? WINDOW_MS - (now - oldestToken.timestamp) + 100
          : WINDOW_MS
        return { canProceed: false, reason: 'tpm', waitMs }
      }
    }

    // Check RPD
    if (limits.rpd && quota.requestsToday >= limits.rpd) {
      return { canProceed: false, reason: 'rpd', waitMs: Infinity }
    }

    // Check TPD
    if (limits.tpd && quota.tokensToday + estimatedTokens > limits.tpd) {
      return { canProceed: false, reason: 'tpd', waitMs: Infinity }
    }

    return { canProceed: true, reason: null, waitMs: 0 }
  }

  // Called AFTER a successful API call
  record(providerId: string, keyId: string, tokensUsed: number): void {
    const quota = this.getOrCreate(providerId, keyId)
    const now = Date.now()

    quota.requestWindow.push(now)
    quota.tokenWindow.push({ timestamp: now, tokens: tokensUsed })
    quota.requestsToday += 1
    quota.tokensToday += tokensUsed

    // Persist daily counters
    this.persistDaily()
  }

  // Called on a 429 error — mark as temporarily unavailable
  markRateLimited(providerId: string, keyId: string, retryAfterMs: number): void {
    const quota = this.getOrCreate(providerId, keyId)
    // Force RPM window to appear full
    const now = Date.now()
    const limits = PROVIDERS[providerId].freeTierLimits
    if (limits.rpm) {
      quota.requestWindow = Array(limits.rpm).fill(now - 100)
    }
  }

  // Get remaining capacity percentage (0-100) for status bar display
  getCapacity(providerId: string, keyId: string): CapacityInfo { ... }

  private maybeResetDaily(quota: ProviderKeyQuota): void {
    const todayUTC = new Date().toISOString().slice(0, 10)
    if (quota.dailyResetDate !== todayUTC) {
      quota.requestsToday = 0
      quota.tokensToday = 0
      quota.dailyResetDate = todayUTC
      quota.isHardBlocked = false
    }
  }
}
```

---

## 5. CONTEXT MANAGER & COMPACTOR — Most Critical Module

**File: `src/context/manager.ts` + `src/context/compactor.ts`**

### 5a. Context Data Structure

```typescript
// src/context/types.ts

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentPart[]
  tool_call_id?: string
  tool_calls?: ToolCall[]
  name?: string
}

export interface AgentContext {
  // ── FIXED (never modified, always preserved) ──────────────
  taskGoal: string              // Original user task
  systemPrompt: string          // Base system prompt

  // ── MESSAGES (grows, can be compacted) ────────────────────
  messages: Message[]           // Full OpenAI-format history

  // ── AGENT STATE (always preserved through compaction) ─────
  completedSteps: string[]      // e.g. "Read file main.py", "Identified bug on line 42"
  currentStep: string           // What the agent is doing right now
  keyDecisions: KeyDecision[]   // Important facts discovered (never throw away)
  pendingToolCalls: ToolCall[]  // Tool calls awaiting results (never compact these)
  
  // ── METADATA ──────────────────────────────────────────────
  totalTokensUsed: number       // Running total across all providers
  compactionCount: number       // How many times context was compacted
  sessionId: string             // Random ID for this session
  startedAt: number             // Unix ms

  // ── PROVIDER TRACKING ─────────────────────────────────────
  currentProvider: string
  providerHistory: ProviderSwitch[]  // [{provider, reason, timestamp, tokensBefore, tokensAfter}]
}

export interface KeyDecision {
  step: number
  fact: string  // e.g. "The API is at /src/api/routes.ts", "Bug is in validateUser()"
}

export interface ProviderSwitch {
  from: string
  to: string
  reason: 'rate_limit' | 'error' | 'manual' | 'context_size'
  timestamp: number
  tokensBefore: number
  tokensAfter: number
  wasCompacted: boolean
}
```

### 5b. Context Compaction Algorithm

```typescript
// src/context/compactor.ts

// WHEN IS COMPACTION TRIGGERED?
// 1. Before switching to a provider with smaller context window
// 2. When current context exceeds 80% of ANY provider's context window
// 3. User manually runs /compact

// RULES (never break these):
// - systemPrompt is ALWAYS in messages[0]
// - taskGoal is always in systemPrompt or a special user message
// - completedSteps, keyDecisions are always injected into compacted context
// - Last 8 messages are ALWAYS kept verbatim (recent conversation)
// - pendingToolCalls are NEVER compacted away
// - compactionCount is incremented

export async function compact(
  context: AgentContext,
  targetTokenBudget: number,  // How many tokens the new provider allows us
  compactionModel: { caller: ApiCaller }  // Use CURRENT provider to summarize before switching
): Promise<AgentContext> {

  // ── STEP 1: Calculate what MUST be preserved ──────────────
  const VERBATIM_TAIL = 8  // Always keep last N messages verbatim
  const RESPONSE_BUFFER = 2048  // Reserve for model's next response
  const availableBudget = targetTokenBudget - RESPONSE_BUFFER

  const systemTokens = countTokens([{ role: 'system', content: buildSystemPrompt(context) }])
  const tailMessages = context.messages.slice(-VERBATIM_TAIL)
  const tailTokens = countTokens(tailMessages)
  const stateTokens = countTokens([buildStateMessage(context)])  // completedSteps + keyDecisions

  const budgetForHistory = availableBudget - systemTokens - tailTokens - stateTokens - 200 // buffer

  // ── STEP 2: Check if compaction is even needed ────────────
  const oldMessages = context.messages.slice(0, -VERBATIM_TAIL)
  const oldTokens = countTokens(oldMessages)

  if (oldTokens <= budgetForHistory) {
    // No compaction needed — just fits
    return context
  }

  // ── STEP 3: Summarize old messages using current model ────
  const summaryPrompt = buildSummaryPrompt(oldMessages, context.taskGoal)
  
  let summary: string
  try {
    summary = await compactionModel.caller.complete(summaryPrompt, { maxTokens: 512 })
  } catch {
    // If summary fails, fall back to hard truncation
    summary = buildFallbackSummary(context.completedSteps, context.keyDecisions)
  }

  // ── STEP 4: Build compacted message list ──────────────────
  const compactedSystemPrompt = buildSystemPromptWithSummary(
    context.systemPrompt,
    summary,
    context.completedSteps,
    context.keyDecisions
  )

  const compactedMessages: Message[] = [
    {
      role: 'system',
      content: compactedSystemPrompt
    },
    {
      role: 'user',
      content: `[Context Note: Earlier conversation has been summarized above to fit within model limits. Continuing from current state.]`
    },
    {
      role: 'assistant',
      content: `Understood. I'll continue based on the summary. Current step: ${context.currentStep}`
    },
    ...tailMessages
  ]

  // ── STEP 5: Verify it fits ────────────────────────────────
  const finalTokens = countTokens(compactedMessages)
  if (finalTokens > availableBudget) {
    // Emergency: drop even more messages
    return compact(
      { ...context, messages: context.messages.slice(-4) },  // Keep only last 4
      targetTokenBudget,
      compactionModel
    )
  }

  // ── STEP 6: Return updated context ───────────────────────
  return {
    ...context,
    messages: compactedMessages,
    compactionCount: context.compactionCount + 1,
    totalTokensUsed: context.totalTokensUsed,  // Preserved
  }
}

// Helper: Build system prompt that includes summary
function buildSystemPromptWithSummary(
  base: string,
  summary: string,
  completedSteps: string[],
  keyDecisions: KeyDecision[]
): string {
  return `${base}

## CONVERSATION SUMMARY (earlier context, compacted)
${summary}

## COMPLETED STEPS
${completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## KEY FACTS DISCOVERED
${keyDecisions.map(d => `- [Step ${d.step}] ${d.fact}`).join('\n')}

## INSTRUCTION
Continue the task from where it was left off. Do NOT re-do completed steps.`
}

// Helper: Build the summary prompt
function buildSummaryPrompt(messages: Message[], taskGoal: string): string {
  const convo = messages.map(m => `${m.role.toUpperCase()}: ${extractText(m.content)}`).join('\n\n')
  return `Summarize the following conversation segment into a compact paragraph.
Focus on: what was done, what was found, what decisions were made.
Preserve specific file names, function names, error messages, and URLs mentioned.
Task goal: ${taskGoal}

CONVERSATION:
${convo}

SUMMARY (max 300 words):`
}
```

---

## 6. ROUTER — Provider Selection Logic

**File: `src/router/selector.ts`**

```typescript
// Task type detection (simple keyword/heuristic approach)
export function classifyTask(message: string, contextMessages: Message[]): TaskType {
  const text = message.toLowerCase()
  const allText = contextMessages.map(m => extractText(m.content)).join(' ').toLowerCase()

  // Long context signals
  if (text.includes('this file') || text.includes('entire') || text.length > 3000) {
    return 'long_context'
  }

  // Coding signals
  if (/\.(ts|js|py|go|rs|java|cpp|c|sh)\b/.test(text) ||
      /function|class|import|export|def |bug|error|fix|refactor/.test(text)) {
    return 'coding'
  }

  // Fast reasoning (quick decisions, yes/no, routing)
  if (text.length < 100 && !/\n/.test(text)) {
    return 'fast_reasoning'
  }

  // Multimodal
  if (text.includes('image') || text.includes('screenshot') || text.includes('photo')) {
    return 'multimodal'
  }

  return 'general'
}

// Select best available provider
// Returns: { provider, model, reason }
export function selectProvider(
  taskType: TaskType,
  availableProviders: string[],  // Only providers with keys configured
  quotaTracker: QuotaTracker,
  estimatedTokens: number,
  excludeProvider?: string  // Current provider to exclude (for fallback)
): ProviderSelection {

  // Build scored list
  const scored = availableProviders
    .filter(pid => pid !== excludeProvider)
    .map(pid => {
      const def = PROVIDERS[pid]
      const keys = keyStore.getKeys(pid)
      if (!keys.length && def.requiresKey) return null

      // Check quota for each key, pick best key
      const bestKey = findBestKey(pid, keys, quotaTracker, estimatedTokens)
      if (!bestKey) return null  // All keys exhausted for this provider

      // Score: lower is better
      let score = def.routingPriority * 10

      // Bonus if this provider is strong for the task type
      if (def.strengthsFor.includes(taskType)) score -= 5

      // Penalty if needs context compaction
      const model = getBestModel(def, taskType)
      if (model.contextWindow < estimatedTokens * 1.5) score += 3

      return { providerId: pid, score, keyId: bestKey, model }
    })
    .filter(Boolean)
    .sort((a, b) => a!.score - b!.score)

  if (!scored.length) {
    // All providers exhausted — check Ollama
    if (availableProviders.includes('ollama')) {
      return { providerId: 'ollama', keyId: 'local', model: PROVIDERS.ollama.models[0] }
    }
    throw new Error('ALL_PROVIDERS_EXHAUSTED')
  }

  return scored[0]!
}

// Select best model within a provider for a task type
function getBestModel(provider: ProviderDefinition, taskType: TaskType): ModelDefinition {
  const taskModels = provider.models.filter(m => m.strengths.includes(taskType) && m.isFree)
  if (taskModels.length) return taskModels[0]
  return provider.models.find(m => m.isFree) ?? provider.models[0]
}
```

---

## 7. MAIN AGENT LOOP

**File: `src/agent/loop.ts`**

This is the orchestrator. Every other module feeds into this.

```typescript
// Pseudocode (implement in TypeScript)

export async function runAgent(
  userMessage: string,
  context: AgentContext,
  renderer: Renderer
): Promise<AgentContext> {

  // Add user message to context
  context = addMessage(context, { role: 'user', content: userMessage })

  while (true) {

    // ── 1. SELECT PROVIDER ────────────────────────────────────
    const estimatedTokens = estimateNextCallTokens(context)
    let selection = router.selectProvider(
      classifyTask(userMessage, context.messages),
      keyStore.getConfiguredProviders(),
      quotaTracker,
      estimatedTokens,
      null
    )

    // ── 2. MAYBE COMPACT CONTEXT ──────────────────────────────
    const targetModel = selection.model
    const contextTokens = countTokens(context.messages)
    const windowThreshold = targetModel.contextWindow * 0.8  // 80% threshold

    if (contextTokens > windowThreshold) {
      renderer.showStatus('Compacting context for ' + targetModel.displayName + '...')
      const currentClient = buildClient(context.currentProvider)
      context = await compact(context, targetModel.contextWindow * 0.75, currentClient)
      renderer.showStatus('Context compacted: ' + contextTokens + '→' + countTokens(context.messages) + ' tokens')
    }

    // Update current provider in context
    if (context.currentProvider !== selection.providerId) {
      const wasCompacted = contextTokens > windowThreshold
      context = recordProviderSwitch(context, {
        from: context.currentProvider,
        to: selection.providerId,
        reason: 'rate_limit',  // Will be refined based on actual reason
        wasCompacted
      })
      renderer.showProviderSwitch(context.currentProvider, selection.providerId)
    }
    context.currentProvider = selection.providerId

    // ── 3. MAKE API CALL ──────────────────────────────────────
    const client = buildClient(selection.providerId, selection.keyId, selection.model.id)

    let response: APIResponse
    try {
      renderer.showThinking(selection.providerId, selection.model.displayName)
      response = await client.chat(context.messages, {
        tools: TOOL_DEFINITIONS,
        stream: true,
        onToken: (t) => renderer.streamToken(t)
      })
      quotaTracker.record(selection.providerId, selection.keyId, response.usage.total_tokens)

    } catch (err) {

      // ── HANDLE RATE LIMIT ERROR ───────────────────────────
      if (isRateLimitError(err)) {
        const retryAfter = parseRetryAfter(err) ?? 5000
        quotaTracker.markRateLimited(selection.providerId, selection.keyId, retryAfter)

        renderer.showWarning('Rate limit on ' + selection.providerId + ', switching...')

        // Retry with different provider (excludes current)
        selection = router.selectProvider(
          classifyTask(userMessage, context.messages),
          keyStore.getConfiguredProviders(),
          quotaTracker,
          estimatedTokens,
          selection.providerId  // EXCLUDE current
        )
        continue  // Retry the loop with new provider
      }

      // ── HANDLE OTHER ERRORS ───────────────────────────────
      renderer.showError(err)

      // If provider-specific error, try fallback
      if (isProviderError(err)) {
        selection = router.selectProvider(..., selection.providerId)
        continue
      }

      throw err  // Unrecoverable — bubble up
    }

    // ── 4. PROCESS RESPONSE ───────────────────────────────────
    const message = response.choices[0].message
    context = addMessage(context, message)

    // ── 5. HANDLE TOOL CALLS ──────────────────────────────────
    if (message.tool_calls?.length) {
      renderer.showToolUse(message.tool_calls)

      for (const tc of message.tool_calls) {
        context.pendingToolCalls.push(tc)
        const result = await executeToolCall(tc)
        context.pendingToolCalls = context.pendingToolCalls.filter(p => p.id !== tc.id)

        context = addMessage(context, {
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        })

        // Log as completed step
        context.completedSteps.push(`Used tool: ${tc.function.name}`)
      }

      continue  // Loop back for model's next response
    }

    // ── 6. FINAL RESPONSE — DONE ──────────────────────────────
    renderer.showResponse(message.content)
    break
  }

  return context
}
```

---

## 8. KEY STORAGE

**File: `src/keys/store.ts`**

```typescript
// Storage location: ~/.config/omnillm/keys.json
// Encryption: AES-256-GCM using a machine-specific key (derived from hostname + username)
// This is NOT bank-grade security — it's just obfuscation against casual file reads.
// Users should understand their keys are stored locally.

interface KeyStore {
  [providerId: string]: {
    keys: {
      id: string         // sha256(key).slice(0,8) — display only
      encrypted: string  // AES-encrypted key value
      addedAt: number
      label?: string     // Optional user label e.g. "personal", "work"
    }[]
  }
}

// CLI usage:
// /keys add groq gsk_xxx                    → Add key for groq
// /keys add groq gsk_xxx --label work       → With label
// /keys list                                → Show all (masked: gsk_xxx...xxx)
// /keys remove groq gsk_xxx                 → Remove specific key
// /keys test groq                           → Make test API call to validate
```

---

## 9. CLI REPL UX

**File: `src/cli/repl.ts`**

The terminal experience. Must feel like Claude Code.

```
$ npx omnillm

╭─────────────────────────────────────────╮
│  OmniLLM CLI  v1.0.0                    │
│  Type /keys add <provider> <key>        │
│  to get started. Type /help for info.   │
╰─────────────────────────────────────────╯

No API keys configured.
Add keys: /keys add groq gsk_xxxxxxxx

> /keys add groq gsk_xxxxxxxx
✓ Groq key added (id: gsk_xxx...xxx)

> /keys add gemini AIzaxxxxxxxx
✓ Google AI Studio key added

> analyze the Python files in /src and find performance bottlenecks

[groq/llama-3.3-70b] ████░░░░░░ thinking...

● Reading files in /src...
● Found 8 Python files (12,450 tokens total)

⚡ Rate limit approaching on groq (5,800/6,000 TPM)
⟳ Switching to gemini/gemini-2.5-flash — context 8.2K tokens (no compaction needed)

[gemini/gemini-2.5-flash] ██████████ analyzing...

Based on my analysis, I found 3 performance bottlenecks:

1. **N+1 query in `user_service.py:84`** — fetchUserOrders() called inside a loop...
[...]

─────────────────────────────────────
Provider: gemini (flash) | Tokens: 14,203 | Switches: 1
groq: 97% daily remaining | gemini: 99% daily remaining
─────────────────────────────────────
>
```

### Status bar (bottom, always visible):
```
[Provider: groq/llama-3.3-70b] [Tokens: 8,234] [groq: 85% ■■■■■□] [gemini: 99% ■■■■■■]
```

---

## 10. CONFIG FILE SCHEMA

**Location: `~/.config/omnillm/`**

```
~/.config/omnillm/
├── keys.json       # Encrypted API keys
├── quota.json      # Daily usage counters (persisted)
├── config.json     # User preferences
└── sessions/       # Optional: saved session contexts
    └── <sessionId>.json
```

**`config.json` schema:**
```json
{
  "version": "1.0",
  "preferences": {
    "defaultProvider": "auto",
    "compactionThreshold": 0.8,
    "verboseMode": false,
    "streamOutput": true,
    "saveSessionHistory": false,
    "ollamaBaseURL": "http://localhost:11434"
  },
  "routing": {
    "overrides": {
      "coding": "groq",
      "long_context": "gemini"
    }
  }
}
```

**`quota.json` schema:**
```json
{
  "version": "1.0",
  "lastUpdated": "2026-05-31T12:00:00Z",
  "dailyCounters": {
    "groq:gsk_xxx...": {
      "resetDate": "2026-05-31",
      "requestsToday": 42,
      "tokensToday": 18500
    }
  }
}
```

---

## 11. ERROR HANDLING STRATEGY

```
Error Type                    | Action
─────────────────────────────────────────────────────
HTTP 429 (rate limit)         | Switch provider, retry same call
HTTP 503 (service down)       | Switch provider, retry same call
HTTP 401 (auth error)         | Show "Invalid key for {provider}", ask user to re-add
HTTP 500 (server error)       | Retry once, then switch provider
Network timeout                | Retry 2x with backoff, then switch provider
ALL_PROVIDERS_EXHAUSTED        | Show dashboard: which limits reset when. Exit gracefully.
Context too large (no compact) | Emergency: keep last 4 messages only, warn user
Tool execution error           | Report to model, let model decide next step
JSON parse error               | Treat as plain text response
```

---

## 12. BUILD & DISTRIBUTION

```json
// package.json (key parts)
{
  "name": "omnillm",
  "version": "1.0.0",
  "bin": {
    "omnillm": "./dist/index.js"
  },
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js",
    "prepublishOnly": "npm run build"
  }
}
```

**Shebang in `src/index.ts`:**
```typescript
#!/usr/bin/env node
// (esbuild will preserve this at top of dist/index.js)
```

**Usage after publish:**
```bash
npx omnillm            # No install needed
npm i -g omnillm       # Global install
```

---

## 13. IMPLEMENTATION ORDER FOR CURSOR

Implement in this exact order — each module depends on the previous:

```
Phase 1 — Foundation (no UI)
  1. src/providers/types.ts          — All type definitions
  2. src/providers/registry.ts       — 12 provider definitions
  3. src/keys/store.ts               — Key storage (test: add/get/remove)
  4. src/quota/tracker.ts            — Quota tracking (test: check/record)
  5. src/context/types.ts            — AgentContext type
  6. src/context/token-counter.ts    — Token counting

Phase 2 — Core Logic
  7. src/context/compactor.ts        — Context compaction
  8. src/context/manager.ts          — Context CRUD
  9. src/router/classifier.ts        — Task classification
  10. src/router/selector.ts         — Provider selection
  11. src/providers/client.ts        — Unified API caller

Phase 3 — Agent
  12. src/agent/tools/*.ts           — Tool implementations
  13. src/agent/loop.ts              — Main agent loop
  14. src/agent/state-machine.ts     — State tracking

Phase 4 — CLI
  15. src/cli/renderer.ts            — Output formatting
  16. src/cli/commands/*.ts          — /keys, /status, /help, etc.
  17. src/cli/repl.ts                — Interactive REPL
  18. src/index.ts                   — Entry point + wiring

Phase 5 — Polish
  19. src/config/manager.ts          — Config file R/W
  20. Error handling edge cases
  21. package.json build pipeline
  22. README.md + .env.example
```

---

## 14. KNOWN EDGE CASES (Cursor must handle these)

```
1. SAME PROVIDER, MULTIPLE KEYS:
   User adds 3 Groq keys. When key1 hits RPM, rotate to key2.
   Implement key rotation BEFORE provider switching.
   keyStore.getKeys('groq') returns all keys — try each.

2. OPENROUTER FREE MODEL AVAILABILITY:
   OpenRouter free models change. At startup, optionally fetch
   GET https://openrouter.ai/api/v1/models and filter where pricing.prompt == "0".
   Cache result for session.

3. OLLAMA MODEL DETECTION:
   At startup, try GET http://localhost:11434/api/tags.
   If Ollama is running, populate PROVIDERS.ollama.models dynamically.
   If not running, mark Ollama as unavailable (don't show in /status).

4. COMPACTION DURING TOOL CALL:
   Never compact when pendingToolCalls.length > 0.
   Wait until all tool results are added, THEN compact if needed.

5. CONTEXT COMPACTION SELF-REFERENCE:
   When compacting, the summary API call itself uses quota.
   Use the most token-efficient model for compaction (Groq 8B).
   Do NOT let the compaction call trigger another compaction.

6. PROVIDER SWITCH MID-STREAM:
   If a streaming response is interrupted by a 429, the partial
   response is lost. Discard it, do NOT add partial content to context.
   Re-run the entire message on the new provider.

7. GITHUB MODELS KEY FORMAT:
   GitHub Personal Access Token (PAT) looks like: ghp_xxxxxxxxxx
   Validator should accept both classic and fine-grained PATs.
   Auth header: Authorization: Bearer ghp_xxx (same as others)

8. DAILY RESET TIMEZONE:
   Use UTC midnight for daily resets, not local timezone.
   Otherwise users in different timezones get confused.

9. GEMINI API BASE URL:
   The OpenAI-compatible endpoint for Gemini is:
   https://generativelanguage.googleapis.com/v1beta/openai/
   NOT the standard Gemini endpoint. Must use this exact URL.

10. CLOUDFLARE WORKERS AI URL:
    Requires accountId in URL: https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1
    User must provide accountId separately from API token.
    Store as: { accountId: "xxx", token: "xxx" } in keys.json
```

---

*End of Architecture Document*
*Total modules: 28 | Total interfaces: ~40 | Estimated implementation: 3,000-4,500 lines TypeScript*
