import { ProviderClient } from '../client.js';

export class NvidiaNimClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('nvidia_nim', keyId, modelId);
  }
}
