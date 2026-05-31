import { ProviderClient } from '../client.js';

export class FireworksClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('fireworks', keyId, modelId);
  }
}
