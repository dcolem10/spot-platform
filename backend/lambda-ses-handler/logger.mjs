/**
 * Structured JSON logger for CloudWatch Insights compatibility.
 * Outputs log lines that can be parsed with:
 *   fields @timestamp, level, operation, requestId, message
 */

const LOG_LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
const CONFIGURED_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_LEVEL = LOG_LEVEL_ORDER[CONFIGURED_LEVEL] ?? 1;

let _requestId = 'unknown';
let _operation = 'unknown';

/**
 * Call at the start of each Lambda handler invocation to attach context.
 */
export function initLogger(requestId, operation) {
  _requestId = requestId || 'unknown';
  _operation = operation || 'unknown';
}

function write(level, message, extra = {}) {
  if ((LOG_LEVEL_ORDER[level] ?? 0) < MIN_LEVEL) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: _requestId,
    operation: _operation,
    message,
    ...extra,
  };
  // CloudWatch captures stdout — use console.log for all levels to avoid double-counting
  console.log(JSON.stringify(entry));
}

export const log = {
  debug: (msg, extra) => write('debug', msg, extra),
  info: (msg, extra) => write('info', msg, extra),
  warn: (msg, extra) => write('warn', msg, extra),
  error: (msg, extra) => write('error', msg, extra),
};
