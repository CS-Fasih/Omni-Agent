import { ProviderClient } from '../client.js';

export class CerebrasClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('cerebras', keyId, modelId);
  }
}
