import { OpenAI } from 'openai';
import { ProviderClient, ChatResponse, ChatOptions } from '../client.js';
import type { Message } from '../../context/types.js';
import { getProvider } from '../registry.js';
import { getDecryptedKey } from '../../keys/store.js';

export class OpenRouterClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('openrouter', keyId, modelId);
  }
}
