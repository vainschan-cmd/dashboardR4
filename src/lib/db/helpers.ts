import path from 'path';
import type { User } from '../types';

/** Placeholder returned instead of any stored credential. */
export const SECRET_MASK = '••••••••';

/**
 * Strictly confine file paths inside the workspace `./data` directory to prevent Path Traversal / Arbitrary File Creation.
 */
export function sanitizeSafeDataFilePath(
  rawPath: string | undefined | null,
  defaultFileName: string = 'ed_dashboard.db',
  allowedExtensions: string[] = ['.db', '.sqlite', '.sqlite3']
): { safeRelativePath: string; resolvedAbsolutePath: string } {
  const cleaned = String(rawPath || '').trim();
  let baseName = cleaned ? path.basename(cleaned) : defaultFileName;
  // Strip any null bytes or unsafe characters
  baseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!baseName || baseName === '.' || baseName === '..') {
    baseName = defaultFileName;
  }
  const ext = path.extname(baseName).toLowerCase();
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
    baseName = `${baseName}${allowedExtensions[0]}`;
  }
  const safeRelativePath = path.posix.join('data', baseName);
  const resolvedAbsolutePath = path.join(process.cwd(), 'data', baseName);
  return { safeRelativePath, resolvedAbsolutePath };
}

/**
 * Strip password hash/plaintext from a User record before returning to callers or API responses.
 */
export function toSafeUser(raw: Record<string, unknown> | User): User {
  if (!raw) return raw as User;
  const rawRecord = raw as Record<string, unknown>;
  const { password: _removedPassword, ...rest } = rawRecord;
  void _removedPassword;
  return {
    ...(rest as unknown as User),
    nipp: String(rawRecord.nipp || rawRecord.username || ''),
    username: String(rawRecord.username || rawRecord.nipp || ''),
    active: Boolean(rawRecord.active),
    token_version: Number(rawRecord.token_version ?? 0),
    must_change_password: Boolean(rawRecord.must_change_password),
  };
}
