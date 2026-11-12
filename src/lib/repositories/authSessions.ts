import {
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
} from '../passwordHash';
import { checkPasswordStrength } from '../passwordPolicy';
import { getDb } from '../db/connection';

/**
 * Server-side session registry (`CODE-03`): JWT revocation, rotation, and
 * `token_version` bookkeeping.
 *
 * These functions are deliberately synchronous and coarse. A revoked session
 * must be gone before the next statement runs, so there is no queue to observe
 * and no window where a stolen token still works.
 */
export const authSessionsRepository = {
  // --- Server-side session registry (revocation, rotation, token_version) ---
  createAuthSession: (session: {
    jti: string;
    userId: string;
    tokenType: 'access' | 'refresh';
    tokenVersion: number;
    issuedAt: number;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
  }): void => {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO auth_sessions
        (jti, user_id, token_type, token_version, issued_at, expires_at, revoked_at, revoked_reason, ip_address, user_agent, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    `).run(
      session.jti,
      session.userId,
      session.tokenType,
      session.tokenVersion,
      session.issuedAt,
      session.expiresAt,
      session.ipAddress || null,
      session.userAgent || null,
      session.issuedAt
    );
  },

  getAuthSession: (
    jti: string
  ): {
    jti: string;
    user_id: string;
    token_type: string;
    token_version: number;
    expires_at: number;
    revoked_at: number | null;
    revoked_reason: string | null;
    last_seen_at: number | null;
  } | null => {
    const db = getDb();
    const row = db
      .prepare(
        'SELECT jti, user_id, token_type, token_version, expires_at, revoked_at, revoked_reason, last_seen_at FROM auth_sessions WHERE jti = ?'
      )
      .get(jti) as
      | {
          jti: string;
          user_id: string;
          token_type: string;
          token_version: number;
          expires_at: number;
          revoked_at: number | null;
          revoked_reason: string | null;
          last_seen_at: number | null;
        }
      | undefined;
    return row || null;
  },

  revokeAuthSession: (jti: string, reason: string = 'logout'): void => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      'UPDATE auth_sessions SET revoked_at = ?, revoked_reason = ? WHERE jti = ? AND revoked_at IS NULL'
    ).run(now, reason, jti);
  },

  revokeAllUserSessions: (userId: string, reason: string = 'admin_action'): void => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      'UPDATE auth_sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL'
    ).run(now, reason, userId);
  },

  touchAuthSession: (jti: string): void => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE jti = ?').run(now, jti);
  },

  purgeExpiredAuthSessions: (): void => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
  },

  /**
   * Delete rows that no longer serve any purpose.
   *
   * `auth_sessions` grows by two rows per login and per refresh; revoked rows are
   * only flagged, never removed, so without this the table grows without bound and
   * every `getAuthSession` lookup slows down. Revoked rows are kept for a grace
   * period because refresh-token reuse detection needs to see recently revoked
   * JTIs.
   */
  purgeStaleAuthData: (
    revokedRetentionDays = 7
  ): { sessions: number; rateLimits: number } => {
    const db = getDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const revokedCutoff = nowSec - revokedRetentionDays * 24 * 60 * 60;

    const sessions = db
      .prepare('DELETE FROM auth_sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)')
      .run(nowSec, revokedCutoff);

    // Rate-limit rows whose window and lockout have both expired are dead weight.
    const staleLockMs = Date.now() - 60 * 60 * 1000;
    const rateLimits = db
      .prepare('DELETE FROM auth_rate_limits WHERE locked_until < ? AND first_failed_at < ?')
      .run(staleLockMs, staleLockMs);

    return {
      sessions: Number(sessions.changes || 0),
      rateLimits: Number(rateLimits.changes || 0),
    };
  },

  bumpUserTokenVersion: (userId: string): number => {
    const db = getDb();
    db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?').run(userId);
    const row = db.prepare('SELECT COALESCE(token_version, 0) AS v FROM users WHERE id = ?').get(userId) as
      | { v: number }
      | undefined;
    return row ? Number(row.v) : 0;
  },

  /**
   * Verify a plaintext password against the stored hash of a specific account.
   * Used for self-service password change (must prove the current password).
   */
  verifyUserPassword: (userId: string, plainPassword: string): boolean => {
    const db = getDb();
    const row = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as
      | { password: string | null }
      | undefined;
    if (!row?.password) return false;
    return verifyPassword(plainPassword, row.password);
  },

  /**
   * Set a new password, clear the "must change" flag, bump the token version, and
   * revoke every session of that user. Returns false when the account is missing.
   */
  setUserPassword: (
    userId: string,
    newPlainPassword: string,
    options: { mustChangePassword?: boolean } = {}
  ): boolean => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) return false;

    const trimmed = String(newPlainPassword || '');
    // Guardrail mirroring the API policy; the API validates first so this is a last resort.
    const policy = checkPasswordStrength(trimmed);
    if (!policy.valid) {
      throw new Error(policy.error || 'Kata sandi baru tidak memenuhi kebijakan keamanan.');
    }

    db.prepare(
      `UPDATE users
          SET password = ?,
              must_change_password = ?,
              password_updated_at = ?,
              token_version = COALESCE(token_version, 0) + 1
        WHERE id = ?`
    ).run(
      hashPassword(trimmed),
      options.mustChangePassword ? 1 : 0,
      new Date().toISOString(),
      userId
    );

    // Any token issued before this moment is no longer valid.
    authSessionsRepository.revokeAllUserSessions(userId, 'password_change');
    return true;
  },

  /**
   * Non-blocking variant of `verifyUserPassword` for request handlers.
   * Same semantics, scrypt runs off the event loop.
   */
  verifyUserPasswordAsync: async (userId: string, plainPassword: string): Promise<boolean> => {
    const db = getDb();
    const row = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as
      | { password: string | null }
      | undefined;
    if (!row?.password) return false;
    return verifyPasswordAsync(plainPassword, row.password);
  },

  /**
   * Non-blocking variant of `setUserPassword` for request handlers.
   * Behaviour is identical: policy check, scrypt hash, token version bump,
   * session revocation.
   */
  setUserPasswordAsync: async (
    userId: string,
    newPlainPassword: string,
    options: { mustChangePassword?: boolean } = {}
  ): Promise<boolean> => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) return false;

    const trimmed = String(newPlainPassword || '');
    const policy = checkPasswordStrength(trimmed);
    if (!policy.valid) {
      throw new Error(policy.error || 'Kata sandi baru tidak memenuhi kebijakan keamanan.');
    }

    const hashed = await hashPasswordAsync(trimmed);

    db.prepare(
      `UPDATE users
          SET password = ?,
              must_change_password = ?,
              password_updated_at = ?,
              token_version = COALESCE(token_version, 0) + 1
        WHERE id = ?`
    ).run(hashed, options.mustChangePassword ? 1 : 0, new Date().toISOString(), userId);

    authSessionsRepository.revokeAllUserSessions(userId, 'password_change');
    return true;
  },
};
