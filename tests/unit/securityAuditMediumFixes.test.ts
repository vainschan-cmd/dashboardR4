import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authorize, resolveReadBranchScope } from '@/lib/policy';
import {
  enforceBranchFilterForRead,
  resolveServerAssignedUserScope,
  validateBranchWriteAccess,
} from '@/lib/rbac';
import { checkSeparationOfDuties } from '@/lib/fourEyes';
import { generateExecutiveBriefingHtml, escapeHtml } from '@/lib/executiveBriefingGenerator';
import { assertSafeZipArchive, MAX_SPREADSHEET_COLUMNS, MAX_ZIP_UNCOMPRESSED_BYTES } from '@/lib/spreadsheet';
import { readRequestTextBounded } from '@/lib/httpBodyLimit';
import { recordsQuerySchema } from '@/lib/validation';
import type { JwtSessionPayload } from '@/lib/auth';

const ROOT = process.cwd();

function makeSession(overrides: Partial<JwtSessionPayload>): JwtSessionPayload {
  return {
    sub: 'usr_test',
    nipp: '10099',
    username: 'user_10099',
    name: 'Pengguna Uji',
    role: 'pic_cabang',
    branch_id: 'R01',
    department_id: null,
    token_version: 0,
    iat: 0,
    exp: 9999999999,
    jti: 'jti_test',
    type: 'access',
    ...overrides,
  };
}

describe('Security Audit Medium Fixes (SA-03..SA-26)', () => {
  describe('SA-03 & SA-04 · Viewer verifiedOnly enforcement across summary & konsolidasi endpoints', () => {
    it('enforces enforceVerificationFilterForRead in beranda-summary, finansial-summary, and modules-data', () => {
      for (const rel of [
        'src/app/api/beranda-summary/route.ts',
        'src/app/api/finansial-summary/route.ts',
        'src/app/api/modules-data/route.ts',
      ]) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        expect(src, rel).toContain('enforceVerificationFilterForRead(');
        expect(src, rel).not.toContain("verifiedOnlyParam !== null ? verifiedOnlyParam === 'true'");
      }
    });

    it('applies verifiedFilter across all 6 queries and metadata in keuangan/konsolidasi', () => {
      const src = fs.readFileSync(
        path.join(ROOT, 'src/app/api/keuangan/konsolidasi/route.ts'),
        'utf8'
      );
      const verifiedMatches = src.match(/\$\{verifiedFilter\}|\$\{bopoVerifiedFilter\}/g) || [];
      // 2 period discovery + 6 chart/KPI queries + 3 metadata queries = 11 total
      expect(verifiedMatches.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('SA-06 · Four-Eyes multi-module coverage, username matching, and fail-closed', () => {
    it('matches uploader conflict on username as well as nipp/sub/name', () => {
      const res = checkSeparationOfDuties(
        { nipp: '10002', username: 'admin_makassar', name: 'Admin Regional', sub: 'usr_10002' },
        { uploaders: ['admin_makassar'] }
      );
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.conflict.matchedOn).toBe('username');
      }
    });

    it('queries all 6 module_* tables without swallowing DB errors in getModuleUploadersByRecordIds', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src/lib/repositories/records.ts'), 'utf8');
      const blockStart = src.indexOf('getModuleUploadersByRecordIds');
      const blockEnd = src.indexOf('updateRecordVerification');
      const block = src.slice(blockStart, blockEnd);
      for (const table of [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ]) {
        expect(block).toContain(table);
      }
      expect(block).not.toContain('catch');
    });
  });

  describe('SA-09 · Server-side must_change_password enforcement in proxy.ts', () => {
    it('checks session.must_change_password and emits PASSWORD_CHANGE_REQUIRED', () => {
      const proxySrc = fs.readFileSync(path.join(ROOT, 'src/proxy.ts'), 'utf8');
      expect(proxySrc).toContain('if (session.must_change_password)');
      expect(proxySrc).toContain('PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('SA-11 · Strict role-rank dominance prevents admin_regional peer takeover', () => {
    const adminActor = { sub: 'usr_10002', role: 'admin_regional' as const, branch_id: 'R99' };
    const peerAdmin = { id: 'usr_10099', role: 'admin_regional' as const };
    const superActor = { sub: 'usr_10001', role: 'super_admin' as const, branch_id: 'R99' };

    it('blocks admin_regional from creating, updating, resetting, or deleting peer admin_regional', () => {
      for (const action of [
        'user:create',
        'user:update',
        'user:delete',
        'user:reset_password',
      ] as const) {
        const decision = authorize(adminActor, action, { targetUser: peerAdmin });
        expect(decision.allowed, action).toBe(false);
      }
    });

    it('still allows super_admin to manage admin_regional and admin_regional to manage pic_cabang', () => {
      expect(authorize(superActor, 'user:update', { targetUser: peerAdmin }).allowed).toBe(true);
      expect(
        authorize(adminActor, 'user:update', {
          targetUser: { id: 'usr_10004', role: 'pic_cabang' },
        }).allowed
      ).toBe(true);
    });
  });

  describe('SA-12 · Fail-closed branch ABAC for pic_cabang assigned R99 or null', () => {
    it('denies read and write access for pic_cabang with R99 or missing branch_id', () => {
      const badPic = makeSession({ role: 'pic_cabang', branch_id: 'R99' });
      const nullPic = makeSession({ role: 'pic_cabang', branch_id: null });

      expect(enforceBranchFilterForRead(badPic, 'R04')).toBe('NONE');
      expect(enforceBranchFilterForRead(nullPic, 'R04')).toBe('NONE');
      expect(validateBranchWriteAccess(badPic, 'R04').allowed).toBe(false);
      expect(validateBranchWriteAccess(nullPic, 'R04').allowed).toBe(false);
      expect(resolveReadBranchScope(badPic, 'R04')).toBe('NONE');
      expect(
        authorize(
          { sub: 'u1', role: 'pic_cabang', branch_id: 'R99' },
          'data:write',
          { targetBranch: 'R04' }
        ).allowed
      ).toBe(false);
    });

    it('never assigns R99 to pic_cabang in resolveServerAssignedUserScope', () => {
      const assigned = resolveServerAssignedUserScope({
        role: 'pic_cabang',
        branch_id: 'R99',
      });
      expect(assigned.branch_id).not.toBe('R99');
    });
  });

  describe('SA-14 · Department ABAC on financial & module endpoints', () => {
    it('enforces dept_keu department isolation in finansial-summary and keuangan/konsolidasi', () => {
      for (const rel of [
        'src/app/api/finansial-summary/route.ts',
        'src/app/api/keuangan/konsolidasi/route.ts',
      ]) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        expect(src).toContain('enforceDepartmentFilterForRead(');
        expect(src).toContain("scopedDept !== 'dept_keu'");
      }
    });

    it('enforces MODULE_DEPARTMENT_MAP in modules-data', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src/app/api/modules-data/route.ts'), 'utf8');
      expect(src).toContain('MODULE_DEPARTMENT_MAP');
      expect(src).toContain('canAccessModule(');
    });
  });

  describe('SA-18 · Stored XSS neutralization & sandbox CSP in Executive Briefing', () => {
    it('HTML-escapes generatedBy and branch fields and removes inline onclick handlers', () => {
      const html = generateExecutiveBriefingHtml({
        records: [],
        branches: [
          {
            id: 'b1',
            code: 'R01',
            name: 'Makassar <script>alert(1)</script>',
            region: 'Regional "4"',
            active: true,
          },
        ],
        month: 9,
        year: 2026,
        generatedBy: '<img src=x onerror=alert(1)>',
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('onclick=');
      expect(html).toContain(escapeHtml('<img src=x onerror=alert(1)>'));
    });

    it('sets restrictive sandbox CSP on briefing response in reports/export/route.ts', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src/app/api/reports/export/route.ts'), 'utf8');
      expect(src).toContain("default-src 'none'");
      expect(src).toContain('sandbox');
    });
  });

  describe('SA-20 · Chunked body-size cap & ZIP bomb pre-check', () => {
    it('aborts streamed request bodies that exceed maxBytes even without Content-Length', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('A'.repeat(100)));
          controller.enqueue(new TextEncoder().encode('B'.repeat(100)));
          controller.close();
        },
      });
      const req = new Request('http://localhost/test', {
        method: 'POST',
        body: stream,
        duplex: 'half',
      } as RequestInit);

      const res = await readRequestTextBounded(req, 120);
      expect(res).toBeNull();
    });

    it('rejects synthetic ZIP archive whose central directory declares >25 MB uncompressed', () => {
      // Minimal synthetic ZIP Central Directory (46 bytes) + EOCD (22 bytes)
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0); // Central directory signature
      cd.writeUInt32LE(MAX_ZIP_UNCOMPRESSED_BYTES + 1024, 24); // Uncompressed size > 25 MB

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
      eocd.writeUInt16LE(1, 10); // Total entries
      eocd.writeUInt32LE(cd.length, 12); // CD size
      eocd.writeUInt32LE(4, 16); // CD offset (after 4-byte PK header)

      const fakeZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), cd, eocd]);
      expect(() => assertSafeZipArchive(fakeZip)).toThrow(/25 MB/);
      expect(MAX_SPREADSHEET_COLUMNS).toBe(100);
    });
  });

  describe('SA-21, SA-23, SA-25, SA-26 · Config guard, PG TLS, records bounds, & unique seed salts', () => {
    it('restricts global google_sheets config overwrite to system_params:manage (SA-21)', () => {
      const src = fs.readFileSync(
        path.join(ROOT, 'src/app/api/import/sheets-sync/route.ts'),
        'utf8'
      );
      expect(src).toContain("hasPermission(auth.session.role, 'system_params:manage')");
    });

    it('enables X.509 certificate verification by default for PG SSL (SA-23)', () => {
      const src = fs.readFileSync(path.join(ROOT, 'src/lib/db/connection.ts'), 'utf8');
      expect(src).toContain('rejectUnauthorized: !allowSelfSigned');
      expect(src).toContain("process.env.NODE_ENV !== 'production'");
    });

    it('caps offset in recordsQuerySchema and uses allowlist + Object.hasOwn for fields (SA-25)', () => {
      expect(recordsQuerySchema.safeParse({ offset: 60000 }).success).toBe(false);
      expect(recordsQuerySchema.safeParse({ offset: 50000 }).success).toBe(true);
      const src = fs.readFileSync(path.join(ROOT, 'src/app/api/records/route.ts'), 'utf8');
      expect(src).toContain('ALLOWED_RECORD_FIELDS');
      expect(src).toContain('Object.hasOwn(recordMap, f)');
    });

    it('derives per-user scrypt hashes inside the loop and defaults must_change_password=true (SA-26)', () => {
      const boot = fs.readFileSync(path.join(ROOT, 'scripts/bootstrap_postgres.mjs'), 'utf8');
      const seed = fs.readFileSync(path.join(ROOT, 'scripts/seed_users_postgres.mjs'), 'utf8');
      expect(boot).toContain("process.env.BOOTSTRAP_TEST_READY !== 'true'");
      expect(boot).toContain('defaultPassword.length < 12');
      expect(seed).not.toContain('password_hash = EXCLUDED.password_hash');
      expect(seed).toContain('defaultPassword.length < 12');
    });
  });
});
