import {
  hashPasswordAsync,
  verifyPasswordAsync,
} from '../passwordHash';
import { checkPasswordStrength } from '../passwordPolicy';
import { getPool } from '../db/connection';

/**
 * Server-side session registry: JWT revocation, rotation, and token_version bookkeeping.
 * Seluruh penyimpanan sesi dan rate limit dikelola langsung di PostgreSQL (tabel auth_sessions).
 */
export const authSessionsRepository = {
  createAuthSession: async (session: {
    jti: string;
    userId: string;
    tokenType: 'access' | 'refresh';
    tokenVersion: number;
    issuedAt: number;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> => {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO auth_sessions
           (jti, user_id, token_type, token_version, issued_at, expires_at, revoked_at, revoked_reason, ip_address, user_agent, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, $8, $9)
         ON CONFLICT (jti) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           token_type = EXCLUDED.token_type,
           token_version = EXCLUDED.token_version,
           issued_at = EXCLUDED.issued_at,
           expires_at = EXCLUDED.expires_at,
           ip_address = EXCLUDED.ip_address,
           user_agent = EXCLUDED.user_agent,
           last_seen_at = EXCLUDED.last_seen_at`,
        [
          session.jti,
          session.userId,
          session.tokenType,
          session.tokenVersion,
          session.issuedAt,
          session.expiresAt,
          session.ipAddress || null,
          session.userAgent || null,
          session.issuedAt,
        ]
      );
    } catch (e) {
      console.warn('[PG] Gagal menyimpan auth session:', e);
    }
  },

  getAuthSession: async (
    jti: string
  ): Promise<{
    jti: string;
    user_id: string;
    token_type: string;
    token_version: number;
    expires_at: number;
    revoked_at: number | null;
    revoked_reason: string | null;
    last_seen_at: number | null;
  } | null> => {
    try {
      const pool = getPool();
      const res = await pool.query(
        'SELECT jti, user_id, token_type, token_version, expires_at, revoked_at, revoked_reason, last_seen_at FROM auth_sessions WHERE jti = $1',
        [jti]
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0];
      return {
        jti: r.jti,
        user_id: r.user_id,
        token_type: r.token_type,
        token_version: Number(r.token_version || 0),
        expires_at: Number(r.expires_at),
        revoked_at: r.revoked_at !== null ? Number(r.revoked_at) : null,
        revoked_reason: r.revoked_reason || null,
        last_seen_at: r.last_seen_at !== null ? Number(r.last_seen_at) : null,
      };
    } catch {
      return null;
    }
  },

  revokeAuthSession: async (jti: string, reason: string = 'logout'): Promise<void> => {
    try {
      const pool = getPool();
      const now = Math.floor(Date.now() / 1000);
      await pool.query(
        'UPDATE auth_sessions SET revoked_at = $1, revoked_reason = $2 WHERE jti = $3 AND revoked_at IS NULL',
        [now, reason, jti]
      );
    } catch (e) {
      console.warn('[PG] Gagal mencabut auth session:', e);
    }
  },

  revokeAllUserSessions: async (userId: string, reason: string = 'admin_action'): Promise<void> => {
    try {
      const pool = getPool();
      const now = Math.floor(Date.now() / 1000);
      await pool.query(
        'UPDATE auth_sessions SET revoked_at = $1, revoked_reason = $2 WHERE user_id = $3 AND revoked_at IS NULL',
        [now, reason, userId]
      );
    } catch (e) {
      console.warn('[PG] Gagal mencabut seluruh auth session user:', e);
    }
  },

  touchAuthSession: async (jti: string): Promise<void> => {
    try {
      const pool = getPool();
      const now = Math.floor(Date.now() / 1000);
      await pool.query('UPDATE auth_sessions SET last_seen_at = $1 WHERE jti = $2', [now, jti]);
    } catch {}
  },

  purgeExpiredAuthSessions: async (): Promise<void> => {
    try {
      const pool = getPool();
      const now = Math.floor(Date.now() / 1000);
      await pool.query('DELETE FROM auth_sessions WHERE expires_at <= $1', [now]);
    } catch {}
  },

  purgeStaleAuthData: async (
    revokedRetentionDays = 7
  ): Promise<{ sessions: number; rateLimits: number }> => {
    try {
      const pool = getPool();
      const nowSec = Math.floor(Date.now() / 1000);
      const revokedCutoff = nowSec - revokedRetentionDays * 24 * 60 * 60;

      const sessionsRes = await pool.query(
        'DELETE FROM auth_sessions WHERE expires_at <= $1 OR (revoked_at IS NOT NULL AND revoked_at <= $2)',
        [nowSec, revokedCutoff]
      );

      const staleLockMs = Date.now() - 60 * 60 * 1000;
      const rateLimitsRes = await pool.query(
        'DELETE FROM auth_rate_limits WHERE locked_until < $1 AND first_failed_at < $2',
        [staleLockMs, staleLockMs]
      );

      return {
        sessions: sessionsRes.rowCount || 0,
        rateLimits: rateLimitsRes.rowCount || 0,
      };
    } catch {
      return { sessions: 0, rateLimits: 0 };
    }
  },

  bumpUserTokenVersion: async (userId: string): Promise<number> => {
    try {
      const pool = getPool();
      const res = await pool.query(
        'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1 RETURNING token_version',
        [userId]
      );
      return Number(res.rows[0]?.token_version || 0);
    } catch {
      return 0;
    }
  },

  verifyUserPasswordAsync: async (userId: string, plainPassword: string): Promise<boolean> => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      const stored = res.rows[0]?.password_hash;
      if (!stored) return false;
      return verifyPasswordAsync(plainPassword, stored);
    } catch {
      return false;
    }
  },

  setUserPasswordAsync: async (
    userId: string,
    newPlainPassword: string,
    options: { mustChangePassword?: boolean } = {}
  ): Promise<boolean> => {
    const trimmed = String(newPlainPassword || '');
    const policy = checkPasswordStrength(trimmed);
    if (!policy.valid) {
      throw new Error(policy.error || 'Kata sandi baru tidak memenuhi kebijakan keamanan.');
    }

    const pool = getPool();
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!existing.rows[0]) return false;

    const hashed = await hashPasswordAsync(trimmed);

    await pool.query(
      `UPDATE users
          SET password_hash = $1,
              must_change_password = $2,
              created_at = $3::timestamptz,
              token_version = COALESCE(token_version, 0) + 1
        WHERE id = $4`,
      [hashed, Boolean(options.mustChangePassword), new Date().toISOString(), userId]
    );

    await authSessionsRepository.revokeAllUserSessions(userId, 'password_change');
    return true;
  },
};
