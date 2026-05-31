import { ProviderClient } from '../client.js';

export class GitHubModelsClient extends ProviderClient {
  constructor(keyId: string, modelId: string) {
    super('github_models', keyId, modelId);
  }
}
