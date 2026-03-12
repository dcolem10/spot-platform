/**
 * Structured frontend logger — production-safe logging utility.
 *
 * In development: logs to console with structured metadata.
 * In production: suppresses debug/info, only emits warn/error.
 * Errors include a unique errorId for cross-referencing with backend logs.
 *
 * Usage:
 *   import { logger } from '@/services/logger';
 *   logger.error('Mutation failed', { mutation: 'createOffer', err });
 *   logger.warn('Stale data detected', { age: 300 });
 *   logger.info('Campaign loaded', { id: '123' });
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  errorId?: string;
  timestamp: string;
  [key: string]: unknown;
}

function generateErrorId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createLogEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (level === 'error') {
    entry.errorId = generateErrorId();
  }

  // Serialize Error objects
  if (meta?.err instanceof Error) {
    entry.errorMessage = meta.err.message;
    entry.errorStack = isDev ? meta.err.stack : undefined;
    delete entry.err;
  }

  return entry;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (!isDev) return;
    const entry = createLogEntry('debug', message, meta);
    console.debug(`[${entry.level}]`, message, meta || '');
  },

  info(message: string, meta?: Record<string, unknown>) {
    if (!isDev) return;
    const entry = createLogEntry('info', message, meta);
    console.info(`[${entry.level}]`, message, meta || '');
  },

  warn(message: string, meta?: Record<string, unknown>) {
    const entry = createLogEntry('warn', message, meta);
    console.warn(`[${entry.level}]`, message, meta || '');
  },

  error(message: string, meta?: Record<string, unknown>): string {
    const entry = createLogEntry('error', message, meta);
    console.error(`[${entry.level}] [${entry.errorId}]`, message, meta || '');
    return entry.errorId!;
  },
};

export default logger;
