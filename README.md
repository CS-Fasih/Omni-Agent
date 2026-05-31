# OmniLLM CLI

A multi-provider LLM CLI agent (Claude Code style). BYOK. No backend. No accounts.

Automatically routes to the best available **free** LLM provider. Switches providers when rate limits hit. Compacts context when switching to smaller-window models.

## Quick Start

```bash
# No install needed
npx omnillm

# Or install globally
npm i -g omnillm
omnillm
```

## Add API Keys

```
/keys add groq gsk_xxxxxxxxxxxxx
/keys add gemini AIzaxxxxxxxxxxxx
/keys list
/keys test groq
```

## Supported Providers (all free tier)

| Provider | Best For | Models |
|---|---|---|
| **Groq** | Fast inference, coding | Llama 3.3 70B, 8B, Mixtral |
| **Google AI Studio** | Long context (1M), multimodal | Gemini 2.5 Flash |
| **Cerebras** | Batch processing | Llama 3.1 70B, 8B |
| **SambaNova** | Large models (405B) | Llama 405B, 70B, Qwen 72B |
| **OpenRouter** | Multi-model routing | DeepSeek R1, Llama 70B |
| **GitHub Models** | GPT-4o free | GPT-4o, Llama 3.3 |
| **NVIDIA NIM** | Coding | DeepSeek R1, Llama 70B |
| **Mistral** | General purpose | Mistral Small |
| **Fireworks AI** | General purpose | Llama 3.3 70B |
| **Ollama** | Local (no key) | Any local model |

## Commands

| Command | Description |
|---|---|
| `/keys add <provider> <key>` | Add an API key |
| `/keys list` | List all configured keys |
| `/keys remove <provider> <id>` | Remove a key |
| `/keys test <provider>` | Test key validity |
| `/status` | Quota and session dashboard |
| `/model [provider] [model]` | Force provider/model |
| `/model auto` | Auto provider selection |
| `/compact` | Manual context compaction |
| `/help` | Show help |
| `/exit` | Quit |

## How It Works

1. **Classifies your task** (coding, long context, fast reasoning, etc.)
2. **Selects best provider** among configured keys
3. **Checks rate limits** (RPM, TPM, RPD, TPD sliding windows)
4. **Compacts context** when switching to smaller models
5. **Retries on failure** with next-best provider

## Storage

All data stored locally in `~/.config/omnillm/`:
- `keys.json` — AES-256-GCM encrypted API keys
- `quota.json` — Daily usage counters
- `config.json` — User preferences

## Environment Variables

See `.env.example` for all supported environment variables.

## Development

```bash
npm install
npm run dev      # Run with tsx (no build needed)
npm run build    # Build single-file bundle
```
