import { ProviderClient, ChatResponse, ChatOptions } from '../client.js';
import type { Message } from '../../context/types.js';
import { getProvider } from '../registry.js';

export class OllamaClient extends ProviderClient {
  constructor(modelId?: string) {
    super('ollama', 'local', modelId ?? 'llama3.2');
  }

  async getLocalModels(): Promise<string[]> {
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: { name: string }[] };
      return (data.models ?? []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
