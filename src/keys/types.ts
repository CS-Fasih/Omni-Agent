export interface KeyEntry {
  id: string;
  encrypted: string;
  addedAt: number;
  label?: string;
}

export interface ProviderKeys {
  keys: KeyEntry[];
}

export interface KeyStore {
  [providerId: string]: ProviderKeys;
}

export interface ProviderKeyInfo {
  provider: string;
  keyId: string;
  label?: string;
  maskedKey: string;
}

export interface KeyValidationResult {
  valid: boolean;
  provider: string;
  message: string;
}
