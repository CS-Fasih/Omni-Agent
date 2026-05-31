import { ProviderClient } from '../client.js';

export class MistralClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('mistral', keyId, modelId);
  }
}
