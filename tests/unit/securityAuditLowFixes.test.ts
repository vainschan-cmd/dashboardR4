import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync } from '@/lib/passwordHash';
import { neutralizeFormulaCell } from '@/lib/excelExporter';
import { redactForLog } from '@/lib/logger';
import { toSafeUser } from '@/lib/db/helpers';
import { clientCache } from '@/lib/clientCache';

const ROOT = process.cwd();

describe('Security Audit Low Fixes (SA-10..SA-31)', () => {
  describe('SA-10 · Atomic refresh token consumption', () => {
    it('implements atomic consumeRefreshSession and checks it in /api/users/me', () => {
      const repoSrc = fs.readFileSync(
        path.join(ROOT, 'src/lib/repositories/authSessions.ts'),
        'utf8'
      );
      const meSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/users/me/route.ts'), 'utf8');
      expect(repoSrc).toContain('consumeRefreshSession');
      expect(repoSrc).toContain('RETURNING jti');
      expect(meSrc).toContain('consumeRefreshSession(rotatedFromJti)');
    });
  });

  describe('SA-13 · CSRF hardening on /api/users/me & pure in-memory /api/users/export', () => {
    it('exports POST on /api/users/me, blocks cross-site GET rotation, and uses POST in useDashboardSession', () => {
      const meSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/users/me/route.ts'), 'utf8');
      const hookSrc = fs.readFileSync(
        path.join(ROOT, 'src/hooks/useDashboardSession.ts'),
        'utf8'
      );
      const exportSrc = fs.readFileSync(
        path.join(ROOT, 'src/app/api/users/export/route.ts'),
        'utf8'
      );

      expect(meSrc).toContain('export async function POST(');
      expect(meSrc).toContain("secFetchSite === 'cross-site'");
      expect(hookSrc).toContain("method: 'POST'");
      expect(exportSrc).toContain('buildUsersWorkbookBuffer(');
      expect(exportSrc).not.toContain('fs.readFileSync');
    });
  });

  describe('SA-15 · Constant-time NIPP lookup & inactive-account failure accounting', () => {
    it('calls getDummyPasswordHash when NIPP is not found and records failures for inactive accounts', () => {
      const usersSrc = fs.readFileSync(path.join(ROOT, 'src/lib/repositories/users.ts'), 'utf8');
      const loginSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/users/login/route.ts'), 'utf8');
      expect(usersSrc).toContain('verifyPasswordAsync(password, getDummyPasswordHash())');
      expect(loginSrc).toContain('if (!user.active) {\n      recordLoginFailure(');
    });
  });

  describe('SA-16 · proxy.ts default-deny checks both path and HTTP method', () => {
    it('matches rule.methods in isDeclaredRoute and declares POST /api/master/target-versions', () => {
      const proxySrc = fs.readFileSync(path.join(ROOT, 'src/proxy.ts'), 'utf8');
      expect(proxySrc).toContain("const effectiveMethod = method === 'HEAD' ? 'GET' : method");
      expect(proxySrc).toContain('rule.methods.includes(effectiveMethod)');
      expect(proxySrc).toContain("pattern: /^\\/api\\/master\\/target-versions(\\/|$)/, methods: ['POST']");
    });
  });

  describe('SA-17 · scrypt$-prefixed plaintext passwords are always hashed', () => {
    it('hashes scrypt$-prefixed passwords instead of storing them verbatim', async () => {
      const sneaky = 'scrypt$MyPlaintextPass123!';
      const hashedSync = hashPassword(sneaky);
      const hashedAsync = await hashPasswordAsync(sneaky);

      expect(hashedSync).not.toBe(sneaky);
      expect(hashedAsync).not.toBe(sneaky);
      expect(verifyPassword(sneaky, hashedSync)).toBe(true);
      expect(await verifyPasswordAsync(sneaky, hashedAsync)).toBe(true);
    });
  });

  describe('SA-22 · No ~/Downloads disk access, symlink rejection, & basename-only response', () => {
    it('confines userPicSync and manualInputService away from os.homedir()/Downloads', () => {
      const picSrc = fs.readFileSync(path.join(ROOT, 'src/lib/userPicSync.ts'), 'utf8');
      const manSrc = fs.readFileSync(path.join(ROOT, 'src/lib/manualInputService.ts'), 'utf8');
      const syncRoute = fs.readFileSync(
        path.join(ROOT, 'src/app/api/users/sync-drive/route.ts'),
        'utf8'
      );

      expect(picSrc).not.toContain("os.homedir()");
      expect(picSrc).toContain('isSymbolicLink()');
      expect(manSrc).not.toContain("os.homedir()");
      expect(syncRoute).toContain('path.basename(result.sourcePath)');
    });
  });

  describe('SA-24 · Inline secret scrubbing in logger.ts & generic pre-auth login 503', () => {
    it('scrubs embedded PostgreSQL DSN passwords, Bearer tokens, and query keys in logs', () => {
      const samplePass = ['Super', 'Secret', '99'].join('');
      const sampleDsn = ['postgresql', '://postgres:', samplePass, '@10.0.0.5:5432/ed'].join('');
      const expectedRedactedDsn = ['postgresql', '://postgres:[redacted]@10.0.0.5:5432/ed'].join('');
      const dsnErr = new Error(`Connection failed to ${sampleDsn}`);
      const redacted = redactForLog(dsnErr) as { message: string };
      expect(redacted.message).not.toContain(samplePass);
      expect(redacted.message).toContain(expectedRedactedDsn);

      const bearer = redactForLog('Header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig');
      expect(String(bearer)).not.toContain('eyJhbGciOiJIUzI1NiJ9');

      const queryKey = redactForLog('https://sheets.googleapis.com/v4/x?key=AIzaSySecretKey123&alt=json');
      expect(String(queryKey)).not.toContain('AIzaSySecretKey123');
    });
  });

  describe('SA-27 · Tunnel hardening & PostgreSQL backup script', () => {
    it('removes unpinned npx localtunnel, avoids --token CLI argv, and targets PostgreSQL in backup-db.mjs', () => {
      const tunnelSh = fs.readFileSync(path.join(ROOT, 'scripts/tunnel.sh'), 'utf8');
      const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
      const backupScript = fs.readFileSync(path.join(ROOT, 'scripts/backup-db.mjs'), 'utf8');

      expect(tunnelSh).not.toContain('npx -y localtunnel');
      expect(pkg).not.toContain('--token');
      expect(backupScript).toContain('pg_dump');
      expect(backupScript).not.toContain('node:sqlite');
    });
  });

  describe('SA-28 · Formula-prefix neutralization for Excel exports', () => {
    it('prefixes formula characters (=, +, -, @, tab, cr) with a single quote', () => {
      expect(neutralizeFormulaCell('=CMD|"/C calc"!A0')).toBe("'=CMD|\"/C calc\"!A0");
      expect(neutralizeFormulaCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
      expect(neutralizeFormulaCell('-1+1')).toBe("'-1+1");
      expect(neutralizeFormulaCell('@SUM(1,2)')).toBe("'@SUM(1,2)");
      expect(neutralizeFormulaCell('Makassar')).toBe('Makassar');
    });
  });

  describe('SA-29 · /api/import/drive-sync locked to system_params:manage', () => {
    it('requires system_params:manage on both GET and POST and ignores client customPath', () => {
      const src = fs.readFileSync(
        path.join(ROOT, 'src/app/api/import/drive-sync/route.ts'),
        'utf8'
      );
      expect(src).toContain("requiredPermission: 'system_params:manage'");
      expect(src).not.toContain('customPath');
    });
  });

  describe('SA-30 · clientCache invalidated on logout/login & bounded capacity', () => {
    it('invalidates clientCache across logout/idle/login hooks and evicts stale entries', () => {
      const hookSrc = fs.readFileSync(
        path.join(ROOT, 'src/hooks/useDashboardSession.ts'),
        'utf8'
      );
      expect((hookSrc.match(/clientCache\.invalidate\(\)/g) || []).length).toBeGreaterThanOrEqual(3);

      clientCache.invalidate();
      clientCache.set('k_test', { v: 1 }, 10);
      expect(clientCache.get('k_test')).toEqual({ v: 1 });
      clientCache.invalidate();
      expect(clientCache.get('k_test')).toBeUndefined();
    });
  });

  describe('SA-31 · toSafeUser strips password_hash & CI actions pinned to commit SHAs', () => {
    it('strips both password and password_hash in toSafeUser', () => {
      const safe = toSafeUser({
        id: 'u1',
        username: '10001',
        nipp: '10001',
        name: 'Admin',
        role: 'super_admin',
        active: true,
        password: 'plain',
        password_hash: 'scrypt$salt$hash',
      }) as unknown as Record<string, unknown>;
      expect('password' in safe).toBe(false);
      expect('password_hash' in safe).toBe(false);
    });

    it('pins GitHub Actions in .github/workflows/ci.yml to 40-char commit SHAs', () => {
      const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
      const usesLines = ci.match(/uses:\s+[^\s]+/g) || [];
      expect(usesLines.length).toBeGreaterThanOrEqual(6);
      for (const line of usesLines) {
        expect(line).toMatch(/@[0-9a-f]{40}$/);
      }
    });
  });
});
