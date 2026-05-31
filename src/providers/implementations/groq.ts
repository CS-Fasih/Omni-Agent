import { ProviderClient } from '../client.js';

export class GroqClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('groq', keyId, modelId);
  }
}
