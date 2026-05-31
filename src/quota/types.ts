export interface WindowEntry {
  timestamp: number;
  tokens: number;
}

export interface ProviderKeyQuota {
  provider: string;
  keyId: string;
  requestWindow: number[];
  tokenWindow: WindowEntry[];
  requestsToday: number;
  tokensToday: number;
  dailyResetDate: string;
  isHardBlocked: boolean;
}

export interface CheckResult {
  canProceed: boolean;
  reason: 'rpm' | 'tpm' | 'rpd' | 'tpd' | null;
  waitMs: number;
}

export interface CapacityInfo {
  rpmPercent: number;
  tpmPercent: number;
  rpdPercent: number;
  tpdPercent: number;
  overallPercent: number;
  isExhausted: boolean;
}

export interface QuotaStateData {
  version: string;
  lastUpdated: string;
  dailyCounters: Record<string, {
    resetDate: string;
    requestsToday: number;
    tokensToday: number;
  }>;
}
