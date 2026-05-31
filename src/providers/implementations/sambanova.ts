import { ProviderClient } from '../client.js';

export class SambaNovaClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('sambanova', keyId, modelId);
  }
}
