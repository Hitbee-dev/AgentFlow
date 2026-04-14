import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = '.agent-cli/logs';
const DEFAULT_LOG_FILE = path.join(LOG_DIR, 'agentflow.log');
const IS_DEV = process.env.AGENTFLOW_DEV === '1';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
}

function ensureLogDir(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeToFile(filePath: string, entry: LogEntry): void {
  ensureLogDir();
  fs.appendFileSync(filePath, formatEntry(entry) + '\n', 'utf-8');
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>, logFile = DEFAULT_LOG_FILE): void {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(data !== undefined ? { data } : {}),
  };

  writeToFile(logFile, entry);

  if (IS_DEV && (level === 'warn' || level === 'error')) {
    process.stderr.write(formatEntry(entry) + '\n');
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
};

export function createAgentLogger(agentName: string) {
  const agentLogFile = path.join(LOG_DIR, `${agentName}.log`);
  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data, agentLogFile),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data, agentLogFile),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data, agentLogFile),
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data, agentLogFile),
  };
}
