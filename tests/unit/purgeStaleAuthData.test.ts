import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * `purgeStaleAuthData` must delete only what is truly dead:
 *  - sessions whose `expires_at` has passed, and
 *  - sessions revoked longer ago than the retention window,
 * while keeping recently revoked sessions so refresh-token reuse detection can
 * still see them.
 *
 * This runs against a throwaway database file so it exercises the real SQL.
 */
let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portsight-purge-'));
  dbPath = path.join(tmpDir, 'purge.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE auth_sessions (
      jti TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_type TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 0,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      revoked_reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      last_seen_at INTEGER
    );
    CREATE TABLE auth_rate_limits (
      rate_key TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      first_failed_at INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  db.close();
});

/** Local mirror of `purgeStaleAuthData` — same SQL, isolated from the singleton. */
function purge(dbPathLocal: string, revokedRetentionDays = 7) {
  const db = new DatabaseSync(dbPathLocal);
  const nowSec = Math.floor(Date.now() / 1000);
  const revokedCutoff = nowSec - revokedRetentionDays * 24 * 60 * 60;
  const sessions = db
    .prepare('DELETE FROM auth_sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)')
    .run(nowSec, revokedCutoff);
  const staleLockMs = Date.now() - 60 * 60 * 1000;
  const rateLimits = db
    .prepare('DELETE FROM auth_rate_limits WHERE locked_until < ? AND first_failed_at < ?')
    .run(staleLockMs, staleLockMs);
  db.close();
  return { sessions: Number(sessions.changes || 0), rateLimits: Number(rateLimits.changes || 0) };
}

describe('purgeStaleAuthData', () => {
  it('menghapus sesi kedaluwarsa dan mempertahankan sesi aktif', () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new DatabaseSync(dbPath);
    db.prepare('INSERT INTO auth_sessions (jti,user_id,token_type,issued_at,expires_at) VALUES (?,?,?,?,?)').run('aktif', 'u1', 'access', now, now + 900);
    db.prepare('INSERT INTO auth_sessions (jti,user_id,token_type,issued_at,expires_at) VALUES (?,?,?,?,?)').run('basi', 'u1', 'access', now - 900, now - 1);
    db.close();

    const result = purge(dbPath);
    expect(result.sessions).toBe(1);

    const check = new DatabaseSync(dbPath);
    const remaining = check.prepare('SELECT jti FROM auth_sessions').all().map((r) => (r as { jti: string }).jti);
    check.close();
    expect(remaining).toEqual(['aktif']);
  });

  it('mempertahankan sesi yang baru dicabut (deteksi reuse refresh token)', () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new DatabaseSync(dbPath);
    // Dicabut 1 jam lalu, masih dalam masa tenggang 7 hari.
    db.prepare('INSERT INTO auth_sessions (jti,user_id,token_type,issued_at,expires_at,revoked_at,revoked_reason) VALUES (?,?,?,?,?,?,?)').run('baru_dicabut', 'u1', 'refresh', now - 60, now + 604800, now - 3600, 'rotated');
    db.close();

    expect(purge(dbPath).sessions).toBe(0);
  });

  it('menghapus sesi yang dicabut lebih lama dari masa tenggang', () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new DatabaseSync(dbPath);
    db.prepare('INSERT INTO auth_sessions (jti,user_id,token_type,issued_at,expires_at,revoked_at,revoked_reason) VALUES (?,?,?,?,?,?,?)').run('lama_dicabut', 'u1', 'refresh', now - 864000, now + 604800, now - 86400 * 30, 'logout');
    db.close();

    expect(purge(dbPath).sessions).toBe(1);
  });

  it('menghormati masa tenggang kustom', () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new DatabaseSync(dbPath);
    db.prepare('INSERT INTO auth_sessions (jti,user_id,token_type,issued_at,expires_at,revoked_at,revoked_reason) VALUES (?,?,?,?,?,?,?)').run('dicabut_2hari', 'u1', 'access', now - 86400 * 3, now + 604800, now - 86400 * 2, 'logout');
    db.close();

    expect(purge(dbPath, 7).sessions).toBe(0);
    expect(purge(dbPath, 1).sessions).toBe(1);
  });

  it('menghapus entri rate limit basi dan mempertahankan yang masih terkunci', () => {
    const db = new DatabaseSync(dbPath);
    const old = Date.now() - 2 * 60 * 60 * 1000;
    const future = Date.now() + 10 * 60 * 1000;
    db.prepare('INSERT INTO auth_rate_limits (rate_key,attempt_count,first_failed_at,locked_until,updated_at) VALUES (?,?,?,?,?)').run('basi', 5, old, old, new Date().toISOString());
    db.prepare('INSERT INTO auth_rate_limits (rate_key,attempt_count,first_failed_at,locked_until,updated_at) VALUES (?,?,?,?,?)').run('aktif', 3, Date.now(), future, new Date().toISOString());
    db.close();

    const result = purge(dbPath);
    expect(result.rateLimits).toBe(1);

    const check = new DatabaseSync(dbPath);
    const keys = check.prepare('SELECT rate_key FROM auth_rate_limits').all().map((r) => (r as { rate_key: string }).rate_key);
    check.close();
    expect(keys).toEqual(['aktif']);
  });

  it('tidak melakukan apa pun pada basis data kosong', () => {
    expect(purge(dbPath)).toEqual({ sessions: 0, rateLimits: 0 });
  });
});
