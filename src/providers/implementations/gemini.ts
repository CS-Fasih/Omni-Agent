import { ProviderClient } from '../client.js';

export class GeminiClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('gemini', keyId, modelId);
  }
}
