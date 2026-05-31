import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname, userInfo } from 'node:os';
import type { KeyStore, KeyEntry, ProviderKeyInfo } from './types.js';
import { getProvider } from '../providers/registry.js';

const CONFIG_DIR = join(homedir(), '.config', 'omnillm');
const KEYS_FILE = join(CONFIG_DIR, 'keys.json');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function deriveKey(): Buffer {
  const seed = `${hostname()}:${userInfo().username}:omnillm-v1`;
  return createHash('sha256').update(seed).digest();
}

function loadStore(): KeyStore {
  ensureConfigDir();
  try {
    const raw = readFileSync(KEYS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStore(store: KeyStore): void {
  ensureConfigDir();
  writeFileSync(KEYS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function encrypt(key: string): string {
  const keyBuffer = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(key, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString('base64');
}

function decrypt(encrypted: string): string {
  const keyBuffer = deriveKey();
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

export function addKey(providerId: string, key: string, label?: string): ProviderKeyInfo {
  const store = loadStore();
  if (!store[providerId]) {
    store[providerId] = { keys: [] };
  }

  const existing = store[providerId].keys.find(k => k.id === hashKey(key));
  if (existing) {
    const p = getProvider(providerId);
    const displayName = p?.displayName ?? providerId;
    return {
      provider: providerId,
      keyId: existing.id,
      label: existing.label,
      maskedKey: maskKey(providerId, key),
    };
  }

  const entry: KeyEntry = {
    id: hashKey(key),
    encrypted: encrypt(key),
    addedAt: Date.now(),
    label,
  };
  store[providerId].keys.push(entry);
  saveStore(store);

  return {
    provider: providerId,
    keyId: entry.id,
    label,
    maskedKey: maskKey(providerId, key),
  };
}

export function removeKey(providerId: string, keyId?: string, keyLabel?: string): boolean {
  const store = loadStore();
  const provider = store[providerId];
  if (!provider) return false;

  if (keyId) {
    const idx = provider.keys.findIndex(k => k.id === keyId);
    if (idx === -1) return false;
    provider.keys.splice(idx, 1);
  } else if (keyLabel) {
    const idx = provider.keys.findIndex(k => k.label === keyLabel);
    if (idx === -1) return false;
    provider.keys.splice(idx, 1);
  }

  if (provider.keys.length === 0) {
    delete store[providerId];
  }
  saveStore(store);
  return true;
}

export function listKeys(): Record<string, ProviderKeyInfo[]> {
  const store = loadStore();
  const result: Record<string, ProviderKeyInfo[]> = {};
  for (const [providerId, providerKeys] of Object.entries(store)) {
    result[providerId] = providerKeys.keys.map(k => ({
      provider: providerId,
      keyId: k.id,
      label: k.label,
      maskedKey: k.id,
    }));
  }
  return result;
}

export function getDecryptedKey(providerId: string, keyId: string): string | undefined {
  const store = loadStore();
  const provider = store[providerId];
  if (!provider) return undefined;
  const entry = provider.keys.find(k => k.id === keyId);
  if (!entry) return undefined;
  try {
    return decrypt(entry.encrypted);
  } catch {
    return undefined;
  }
}

export function getKeys(providerId: string): KeyEntry[] {
  const store = loadStore();
  return store[providerId]?.keys ?? [];
}

export function hasKeys(providerId: string): boolean {
  return getKeys(providerId).length > 0;
}

export function getConfiguredProviders(): string[] {
  const store = loadStore();
  return Object.keys(store).filter(k => store[k].keys.length > 0);
}

export function maskKey(providerId: string, key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
