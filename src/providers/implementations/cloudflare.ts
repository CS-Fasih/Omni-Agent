import { ProviderClient } from '../client.js';
import { getProvider } from '../registry.js';

export class CloudflareClient extends ProviderClient {
  constructor(keyId: string, modelId: string, accountId?: string) {
    super('cloudflare', keyId, modelId);
  }
}
