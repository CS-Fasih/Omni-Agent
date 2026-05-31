import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'omnillm');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface UserPreferences {
  defaultProvider: string;
  compactionThreshold: number;
  verboseMode: boolean;
  streamOutput: boolean;
  saveSessionHistory: boolean;
  ollamaBaseURL: string;
}

export interface RoutingOverrides {
  [taskType: string]: string;
}

export interface AppConfig {
  version: string;
  preferences: UserPreferences;
  routing: {
    overrides: RoutingOverrides;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0',
  preferences: {
    defaultProvider: 'auto',
    compactionThreshold: 0.8,
    verboseMode: false,
    streamOutput: true,
    saveSessionHistory: false,
    ollamaBaseURL: 'http://localhost:11434',
  },
  routing: {
    overrides: {},
  },
};

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  ensureConfigDir();
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...config,
      preferences: { ...DEFAULT_CONFIG.preferences, ...config.preferences },
      routing: {
        ...DEFAULT_CONFIG.routing,
        ...config.routing,
        overrides: { ...DEFAULT_CONFIG.routing.overrides, ...config.routing?.overrides },
      },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function updatePreferences(partial: Partial<UserPreferences>): AppConfig {
  const config = loadConfig();
  config.preferences = { ...config.preferences, ...partial };
  saveConfig(config);
  return config;
}

export function setRoutingOverride(taskType: string, providerId: string): AppConfig {
  const config = loadConfig();
  config.routing.overrides[taskType] = providerId;
  saveConfig(config);
  return config;
}

export function getDefaultConfig(): AppConfig {
  return { ...DEFAULT_CONFIG };
}
