import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  clearAllLoginRateLimitsForTest,
} from '@/lib/auth';

const ROOT = process.cwd();

describe('Security Audit High Fixes (SA-01, SA-02, SA-05, SA-07, SA-19)', () => {
  describe('SA-01 · users.token_version schema & repository consistency', () => {
    it('defines token_version on users table in data/schema.sql', () => {
      const schemaSql = fs.readFileSync(path.join(ROOT, 'data', 'schema.sql'), 'utf8');
      expect(schemaSql).toMatch(/token_version\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
      expect(schemaSql).toMatch(
        /ALTER\s+TABLE\s+users\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+token_version/i
      );
    });

    it('includes token_version in all user SELECT queries in usersRepository', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'repositories', 'users.ts'), 'utf8');
      const selectMatches = src.match(/SELECT[\s\S]*?FROM\s+users/gi) || [];
      // 5 explicit column SELECTs + 1 SELECT * in updateUser
      const explicitSelects = selectMatches.filter((q) => !q.includes('SELECT *'));
      expect(explicitSelects.length).toBe(5);
      for (const query of explicitSelects) {
        expect(query).toContain('token_version');
      }
    });

    it('does not overwrite created_at in setUserPasswordAsync and fails closed on revocation', () => {
      const src = fs.readFileSync(
        path.join(ROOT, 'src', 'lib', 'repositories', 'authSessions.ts'),
        'utf8'
      );
      const setPwdStart = src.indexOf('setUserPasswordAsync');
      const setPwdBlock = src.slice(setPwdStart);
      expect(setPwdBlock).not.toContain('created_at =');
      expect(setPwdBlock).toContain('token_version = COALESCE(token_version, 0) + 1');
    });
  });

  describe('SA-02 · /api/isu-strategis strict auth & branch ABAC', () => {
    it('enforces requireAuth, enforceBranchFilterForRead, and validateBranchWriteAccess on both routes', () => {
      const collectionRoute = fs.readFileSync(
        path.join(ROOT, 'src', 'app', 'api', 'isu-strategis', 'route.ts'),
        'utf8'
      );
      const itemRoute = fs.readFileSync(
        path.join(ROOT, 'src', 'app', 'api', 'isu-strategis', '[id]', 'route.ts'),
        'utf8'
      );

      for (const routeSrc of [collectionRoute, itemRoute]) {
        expect(routeSrc).toContain('requireAuth(');
        expect(routeSrc).toContain('enforceBranchFilterForRead(');
        expect(routeSrc).toContain('validateBranchWriteAccess(');
        expect(routeSrc).not.toContain('PIC_REGIONAL_4');
        expect(routeSrc).not.toContain("if (session && session.role === 'viewer')");
      }
    });
  });

  describe('SA-05 · /api/import/commit server-derived recordId & ownership check', () => {
    it('ignores client-supplied record.id and rejects cross-branch/department collisions', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'importService.ts'), 'utf8');
      expect(src).not.toContain('r.id.trim()');
      expect(src).toContain('const recordId = buildRecordKey(');
      expect(src).toContain(
        'existing.branch_id !== record.branch_id || existing.department_id !== record.department_id'
      );
    });
  });

  describe('SA-07 · Login rate limiter isolation & 429 audit throttling', () => {
    const prevTrustProxy = process.env.TRUST_PROXY;

    beforeEach(() => {
      clearAllLoginRateLimitsForTest();
    });

    afterEach(() => {
      clearAllLoginRateLimitsForTest();
      if (prevTrustProxy === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = prevTrustProxy;
      }
    });

    it('does NOT globally lock out unrelated users under default TRUST_PROXY=false after 25 invalid attempts', () => {
      process.env.TRUST_PROXY = 'false';

      for (let i = 1; i <= 25; i++) {
        recordLoginFailure('127.0.0.1', `attacker_probe_${i}`);
      }

      const legitimate = checkLoginRateLimit('127.0.0.1', '10002');
      expect(legitimate.allowed).toBe(true);
      expect(legitimate.remainingAttempts).toBeGreaterThan(0);
    });

    it('still locks out a single targeted NIPP after 5 failures and emits shouldAuditLockout only once', () => {
      process.env.TRUST_PROXY = 'false';

      for (let i = 0; i < 5; i++) {
        recordLoginFailure('127.0.0.1', '10099');
      }

      const firstBlocked = checkLoginRateLimit('127.0.0.1', '10099');
      expect(firstBlocked.allowed).toBe(false);
      expect(firstBlocked.shouldAuditLockout).toBe(true);

      const secondBlocked = checkLoginRateLimit('127.0.0.1', '10099');
      expect(secondBlocked.allowed).toBe(false);
      expect(secondBlocked.shouldAuditLockout).toBe(false);

      resetLoginRateLimit('127.0.0.1', '10099');
      expect(checkLoginRateLimit('127.0.0.1', '10099').allowed).toBe(true);
    });

    it('blocks per-IP spraying when TRUST_PROXY=true without impacting other client IPs', () => {
      process.env.TRUST_PROXY = 'true';

      for (let i = 1; i <= 20; i++) {
        recordLoginFailure('203.0.113.42', `spray_user_${i}`);
      }

      const blockedSprayIp = checkLoginRateLimit('203.0.113.42', '10002');
      expect(blockedSprayIp.allowed).toBe(false);
      expect(blockedSprayIp.shouldAuditLockout).toBe(true);

      const secondCheckSameIp = checkLoginRateLimit('203.0.113.42', '10000');
      expect(secondCheckSameIp.allowed).toBe(false);
      expect(secondCheckSameIp.shouldAuditLockout).toBe(false);

      const otherClient = checkLoginRateLimit('198.51.100.7', '10002');
      expect(otherClient.allowed).toBe(true);
    });
  });

  describe('SA-19 · No hardcoded PostgreSQL fallback password & db_config ignored', () => {
    it('contains no hardcoded ictpi4 fallback in connection.ts or sync_database_postgres.mjs', () => {
      const connSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'db', 'connection.ts'), 'utf8');
      const syncSrc = fs.readFileSync(
        path.join(ROOT, 'scripts', 'sync_database_postgres.mjs'),
        'utf8'
      );
      expect(connSrc).not.toContain('ictpi4');
      expect(syncSrc).not.toContain('ictpi4');
    });

    it('ignores /data/db_config.json in .gitignore', () => {
      const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
      expect(gitignore).toContain('/data/db_config.json');
    });
  });
});
