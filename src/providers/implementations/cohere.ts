import { ProviderClient } from '../client.js';

export class CohereClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('cohere', keyId, modelId);
  }
}
