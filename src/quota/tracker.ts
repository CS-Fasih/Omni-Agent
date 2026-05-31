import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ProviderKeyQuota, CheckResult, CapacityInfo, QuotaStateData } from './types.js';
import { PROVIDERS, getProvider } from '../providers/registry.js';

const CONFIG_DIR = join(homedir(), '.config', 'omnillm');
const QUOTA_FILE = join(CONFIG_DIR, 'quota.json');
const WINDOW_MS = 60 * 1000;

export class QuotaTracker {
  private state: Map<string, ProviderKeyQuota> = new Map();

  constructor() {
    this.loadDaily();
  }

  check(providerId: string, keyId: string, estimatedTokens: number): CheckResult {
    const provider = getProvider(providerId);
    if (!provider) {
      return { canProceed: false, reason: null, waitMs: Infinity };
    }
    const limits = provider.freeTierLimits;
    const quota = this.getOrCreate(providerId, keyId);
    const now = Date.now();

    this.maybeResetDaily(quota);

    quota.requestWindow = quota.requestWindow.filter(t => now - t < WINDOW_MS);
    quota.tokenWindow = quota.tokenWindow.filter(e => now - e.timestamp < WINDOW_MS);

    if (limits.rpm && quota.requestWindow.length >= limits.rpm) {
      const oldest = quota.requestWindow[0];
      const waitMs = WINDOW_MS - (now - oldest) + 100;
      return { canProceed: false, reason: 'rpm', waitMs };
    }

    if (limits.tpm) {
      const tokensInWindow = quota.tokenWindow.reduce((sum, e) => sum + e.tokens, 0);
      if (tokensInWindow + estimatedTokens > limits.tpm) {
        const oldest = quota.tokenWindow[0];
        const waitMs = oldest ? WINDOW_MS - (now - oldest.timestamp) + 100 : WINDOW_MS;
        return { canProceed: false, reason: 'tpm', waitMs };
      }
    }

    if (limits.rpd && quota.requestsToday >= limits.rpd) {
      return { canProceed: false, reason: 'rpd', waitMs: Infinity };
    }

    if (limits.tpd && quota.tokensToday + estimatedTokens > limits.tpd) {
      return { canProceed: false, reason: 'tpd', waitMs: Infinity };
    }

    return { canProceed: true, reason: null, waitMs: 0 };
  }

  record(providerId: string, keyId: string, tokensUsed: number): void {
    const quota = this.getOrCreate(providerId, keyId);
    const now = Date.now();

    quota.requestWindow.push(now);
    quota.tokenWindow.push({ timestamp: now, tokens: tokensUsed });
    quota.requestsToday += 1;
    quota.tokensToday += tokensUsed;

    this.persistDaily();
  }

  markRateLimited(providerId: string, keyId: string, retryAfterMs: number): void {
    const quota = this.getOrCreate(providerId, keyId);
    const provider = getProvider(providerId);
    const limits = provider?.freeTierLimits;
    if (limits?.rpm) {
      quota.requestWindow = Array(limits.rpm).fill(Date.now() - 100);
    }
  }

  getCapacity(providerId: string, keyId: string): CapacityInfo {
    const provider = getProvider(providerId);
    const limits = provider?.freeTierLimits ?? {};
    const quota = this.getOrCreate(providerId, keyId);
    const now = Date.now();

    quota.requestWindow = quota.requestWindow.filter(t => now - t < WINDOW_MS);
    quota.tokenWindow = quota.tokenWindow.filter(e => now - e.timestamp < WINDOW_MS);

    const rpmPercent = limits.rpm ? Math.round((quota.requestWindow.length / limits.rpm) * 100) : 0;
    const tokensInWindow = quota.tokenWindow.reduce((sum, e) => sum + e.tokens, 0);
    const tpmPercent = limits.tpm ? Math.round((tokensInWindow / limits.tpm) * 100) : 0;
    const rpdPercent = limits.rpd ? Math.round((quota.requestsToday / limits.rpd) * 100) : 0;
    const tpdPercent = limits.tpd ? Math.round((quota.tokensToday / limits.tpd) * 100) : 0;

    const overall = Math.max(rpmPercent, tpmPercent, rpdPercent, tpdPercent);

    return {
      rpmPercent,
      tpmPercent,
      rpdPercent,
      tpdPercent,
      overallPercent: overall,
      isExhausted: overall >= 100,
    };
  }

  getAllCapacities(): Record<string, CapacityInfo> {
    const result: Record<string, CapacityInfo> = {};
    for (const [compositeKey, quota] of this.state) {
      const [providerId, keyId] = compositeKey.split(':');
      const key = `${providerId}:${quota.keyId}`;
      result[key] = this.getCapacity(providerId, keyId);
    }
    return result;
  }

  isProviderAvailable(providerId: string): boolean {
    const keys = this.getKeysForProvider(providerId);
    if (keys.length === 0) return true;
    return keys.some(k => {
      const cap = this.getCapacity(providerId, k.keyId);
      return !cap.isExhausted;
    });
  }

  getKeysForProvider(providerId: string): ProviderKeyQuota[] {
    const result: ProviderKeyQuota[] = [];
    for (const [compositeKey, quota] of this.state) {
      if (compositeKey.startsWith(`${providerId}:`)) {
        result.push(quota);
      }
    }
    return result;
  }

  private getOrCreate(providerId: string, keyId: string): ProviderKeyQuota {
    const compositeKey = `${providerId}:${keyId}`;
    let quota = this.state.get(compositeKey);
    if (!quota) {
      quota = {
        provider: providerId,
        keyId,
        requestWindow: [],
        tokenWindow: [],
        requestsToday: 0,
        tokensToday: 0,
        dailyResetDate: new Date().toISOString().slice(0, 10),
        isHardBlocked: false,
      };
      this.state.set(compositeKey, quota);
    }
    return quota;
  }

  private maybeResetDaily(quota: ProviderKeyQuota): void {
    const todayUTC = new Date().toISOString().slice(0, 10);
    if (quota.dailyResetDate !== todayUTC) {
      quota.requestsToday = 0;
      quota.tokensToday = 0;
      quota.dailyResetDate = todayUTC;
      quota.isHardBlocked = false;
    }
  }

  private loadDaily(): void {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
      }
      const raw = readFileSync(QUOTA_FILE, 'utf-8');
      const data: QuotaStateData = JSON.parse(raw);
      const todayUTC = new Date().toISOString().slice(0, 10);
      for (const [compositeKey, counter] of Object.entries(data.dailyCounters ?? {})) {
        const [providerId, keyId] = compositeKey.split(':');
        const quota = this.getOrCreate(providerId, keyId);
        if (counter.resetDate === todayUTC) {
          quota.requestsToday = counter.requestsToday;
          quota.tokensToday = counter.tokensToday;
          quota.dailyResetDate = counter.resetDate;
        }
      }
    } catch {
      // No persisted quota file, start fresh
    }
  }

  private persistDaily(): void {
    const data: QuotaStateData = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      dailyCounters: {},
    };
    for (const [compositeKey, quota] of this.state) {
      data.dailyCounters[compositeKey] = {
        resetDate: quota.dailyResetDate,
        requestsToday: quota.requestsToday,
        tokensToday: quota.tokensToday,
      };
    }
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
      }
      writeFileSync(QUOTA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore persist failures
    }
  }
}

export const quotaTracker = new QuotaTracker();
