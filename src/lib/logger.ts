import { randomUUID } from 'node:crypto';

/**
 * Safe logging helpers (AUTH-12).
 *
 * Rules enforced here:
 * - Never emit a bearer token, cookie, password, API key, or session id.
 * - Attach a per-request correlation id so a user-reported error can be traced
 *   without asking for a token.
 * - Keep log payloads shallow; a redacted deep copy is produced instead of
 *   trusting call sites to remember what is sensitive.
 */

export const REQUEST_ID_HEADER = 'x-request-id';

const SENSITIVE_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|session[_-]?id|jti)/i;

const MAX_DEPTH = 4;
const MAX_KEYS = 40;

const REDACTED = '[redacted]';

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Deep-copy a value with sensitive fields replaced by a placeholder.
 * Values that are not plain data (functions, class instances) are dropped.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Truncate long strings so a log line cannot become a data dump.
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) {
    return { name: value.name, message: redactForLog(value.message, depth) };
  }
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS).map((entry) => redactForLog(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).slice(0, MAX_KEYS)) {
      result[key] = isSensitiveKey(key) ? REDACTED : redactForLog(source[key], depth + 1);
    }
    return result;
  }
  return '[unserializable]';
}

/** Accept an upstream correlation id only if it looks like one (no log injection). */
export function getRequestId(source?: { headers: Headers } | Headers | null): string {
  const headers = source instanceof Headers ? source : source?.headers;
  const provided = headers?.get(REQUEST_ID_HEADER)?.trim();
  if (provided && /^[A-Za-z0-9._:-]{8,128}$/.test(provided)) {
    return provided;
  }
  return randomUUID();
}

type LogLevel = 'info' | 'warn' | 'error';

export function logEvent(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  const payload = meta ? ` ${JSON.stringify(redactForLog(meta))}` : '';
  const line = `[${event}]${payload}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Structured error log that never leaks a credential. */
export function logError(event: string, error: unknown, meta?: Record<string, unknown>): void {
  logEvent('error', event, { ...meta, error });
}
