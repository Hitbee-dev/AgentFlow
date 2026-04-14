import fs from 'fs';
import type { AppConfig } from '../types/index.js';
import { AppConfigSchema } from './schema.js';

const CONFIG_PATH = '.agent-cli/config.json';

const DEFAULT_CONFIG: AppConfig = {
  providers: {},
  agents: {},
  defaults: {
    provider: '',
    model: '',
    namespace: 'default',
  },
};

export function ensureConfigDir(): void {
  const dirs = [
    '.agent-cli',
    '.agent-cli/logs',
    '.agent-cli/queue',
    '.agent-cli/queue/pointers',
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Config validation failed:', result.error.issues);
    return DEFAULT_CONFIG;
  }
  return result.data;
}

export function saveConfig(config: AppConfig): void {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${JSON.stringify(result.error.issues)}`);
  }
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(result.data, null, 2), 'utf-8');
}
