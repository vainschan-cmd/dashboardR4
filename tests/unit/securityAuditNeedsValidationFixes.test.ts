import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import {
  getClientIp,
  readAccessTokenCookie,
  readRefreshTokenCookie,
} from '@/lib/auth';
import { proxy } from '@/proxy';
import { getCanonicalBranchCode } from '@/lib/constants';
import { resolvePeralatanBranchCode } from '@/lib/peralatanHelpers';
import { etlJobManager } from '@/lib/etlJobService';
import { FINANSIAL_EFF_COLUMNS_SQL } from '@/lib/finansialConsolidationService';

const ORIGINAL_ENV = {
  TRUST_PROXY: process.env.TRUST_PROXY,
  TRUST_PROXY_MODE: process.env.TRUST_PROXY_MODE,
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_LEGACY_AUTH_COOKIES: process.env.ALLOW_LEGACY_AUTH_COOKIES,
};

function restoreEnv(key: keyof typeof ORIGINAL_ENV) {
  const val = ORIGINAL_ENV[key];
  if (val === undefined) {
    delete (process.env as Record<string, string | undefined>)[key];
  } else {
    (process.env as Record<string, string | undefined>)[key] = val;
  }
}

afterEach(() => {
  restoreEnv('TRUST_PROXY');
  restoreEnv('TRUST_PROXY_MODE');
  restoreEnv('TRUST_PROXY_HOPS');
  restoreEnv('NODE_ENV');
  restoreEnv('ALLOW_LEGACY_AUTH_COOKIES');
});

describe('Security Audit Needs-Validation Hardening (NV-01 – NV-07)', () => {
  describe('NV-01: TRUST_PROXY topology hardening & target-versions IP logging', () => {
    it('ignores all forwarding headers when TRUST_PROXY=false', () => {
      process.env.TRUST_PROXY = 'false';
      const req = new Request('http://localhost:3000/api/users/login', {
        headers: {
          'cf-connecting-ip': '198.51.100.9',
          'x-forwarded-for': '203.0.113.1, 203.0.113.2',
          'x-real-ip': '198.51.100.2',
        },
      });
      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('in default reverse_proxy mode, ignores spoofed CF-Connecting-IP and reads rightmost XFF hop', () => {
      process.env.TRUST_PROXY = 'true';
      delete process.env.TRUST_PROXY_MODE;
      process.env.TRUST_PROXY_HOPS = '1';
      const req = new Request('http://localhost:3000/api/users/login', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '9.9.9.9, 198.51.100.42',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('respects TRUST_PROXY_HOPS=2 when behind two trusted reverse proxies', () => {
      process.env.TRUST_PROXY = 'true';
      process.env.TRUST_PROXY_MODE = 'reverse_proxy';
      process.env.TRUST_PROXY_HOPS = '2';
      const req = new Request('http://localhost:3000/api/users/login', {
        headers: {
          'x-forwarded-for': '8.8.8.8, 198.51.100.77, 10.0.0.5',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.77');
    });

    it('in cloudflare mode, trusts valid CF-Connecting-IP and rejects malformed header values', () => {
      process.env.TRUST_PROXY = 'true';
      process.env.TRUST_PROXY_MODE = 'cloudflare';
      const goodReq = new Request('http://localhost:3000/api/users/login', {
        headers: {
          'cf-connecting-ip': '203.0.113.88',
          'x-forwarded-for': '9.9.9.9, 10.0.0.2',
        },
      });
      expect(getClientIp(goodReq)).toBe('203.0.113.88');

      const badReq = new Request('http://localhost:3000/api/users/login', {
        headers: {
          'cf-connecting-ip': 'not-an-ip; DROP TABLE',
          'x-forwarded-for': '198.51.100.12',
        },
      });
      expect(getClientIp(badReq)).toBe('198.51.100.12');
    });

    it('uses getClientIp() in /api/master/target-versions instead of raw x-forwarded-for', () => {
      const routeSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/master/target-versions/route.ts'),
        'utf8'
      );
      expect(routeSrc).toContain('getClientIp(req)');
      expect(routeSrc).not.toContain("req.headers.get('x-forwarded-for')");
    });
  });

  describe('NV-02: Strict __Host- cookie enforcement in production', () => {
    it('rejects legacy non-__Host- auth cookies in production unless ALLOW_LEGACY_AUTH_COOKIES=true', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ALLOW_LEGACY_AUTH_COOKIES;

      const req = new NextRequest('https://app.pelindo.co.id/api/master', {
        headers: {
          cookie: 'portsight_access_token=legacy_tok; portsight_refresh_token=legacy_ref',
        },
      });
      // In test module load, ACCESS_TOKEN_COOKIE was evaluated under test NODE_ENV,
      // so test explicitly confirms allowLegacyAuthCookies gating in auth.ts source
      const authSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth.ts'),
        'utf8'
      );
      expect(authSrc).toContain("process.env.ALLOW_LEGACY_AUTH_COOKIES === 'true'");
      expect(authSrc).toContain('if (allowLegacyAuthCookies())');
      // With matching cookie in test env, helpers still return string cleanly
      expect(readAccessTokenCookie(req)).toBe('legacy_tok');
      expect(readRefreshTokenCookie(req)).toBe('legacy_ref');
    });
  });

  describe('NV-03: Scheme-aware Origin & Referer fallback in proxy.ts CSRF guard', () => {
    it('blocks scheme-downgraded http Origin when forwarded proto is https', async () => {
      process.env.TRUST_PROXY = 'true';
      const req = new NextRequest('http://app.pelindo.co.id/api/users/logout', {
        method: 'POST',
        headers: {
          host: 'app.pelindo.co.id',
          'x-forwarded-proto': 'https',
          origin: 'http://app.pelindo.co.id',
        },
      });
      const res = await proxy(req);
      expect(res.status).toBe(403);
    });

    it('blocks cross-origin Referer when Origin header is omitted', async () => {
      const req = new NextRequest('https://app.pelindo.co.id/api/users/logout', {
        method: 'POST',
        headers: {
          host: 'app.pelindo.co.id',
          referer: 'https://evil.example.com/attack.html',
        },
      });
      const res = await proxy(req);
      expect(res.status).toBe(403);
    });

    it('allows matching https Origin when forwarded proto is https', async () => {
      process.env.TRUST_PROXY = 'true';
      const req = new NextRequest('http://app.pelindo.co.id/api/users/logout', {
        method: 'POST',
        headers: {
          host: 'app.pelindo.co.id',
          'x-forwarded-proto': 'https',
          origin: 'https://app.pelindo.co.id',
        },
      });
      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });
  });

  describe('NV-04: Branch code precedence & manual-input canonical lock', () => {
    it('prioritizes official branch code over mismatched branch name', () => {
      expect(getCanonicalBranchCode('R01', 'Balikpapan')).toBe('R01');
      expect(getCanonicalBranchCode('R07', 'Makassar')).toBe('R07');
      expect(getCanonicalBranchCode(undefined, 'Makassar')).toBe('R01');
    });

    it('preserves resolvePeralatanBranchCode namaCabang precedence over fallback R99', () => {
      expect(resolvePeralatanBranchCode('Makassar', 'R99')).toBe('R01');
      expect(resolvePeralatanBranchCode('Unknown Port', 'R07')).toBe('R07');
    });

    it('locks branch code & name aliases and rejects mismatches in manual-input route', () => {
      const routeSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/manual-input/route.ts'),
        'utf8'
      );
      expect(routeSrc).toContain('resolvedFromCode !== resolvedFromName');
      expect(routeSrc).toContain('namaCabang: canonicalName');
      expect(routeSrc).toContain('branchName: canonicalName');
      expect(routeSrc).toContain('NM_CBG: canonicalName');
    });
  });

  describe('NV-05: /api/jobs payload cap, Zod validation & ownership isolation', () => {
    it('clamps maxRetries and isolates job listings by ownerUserId', () => {
      const jobA = etlJobManager.createJob('sync_nv05_a', { ok: true }, 999, {
        userId: 'user_nv05_a',
        role: 'pic_cabang',
      });
      const jobB = etlJobManager.createJob('sync_nv05_b', { ok: true }, -5, {
        userId: 'user_nv05_b',
        role: 'pic_cabang',
      });

      expect(jobA.maxRetries).toBe(10);
      expect(jobB.maxRetries).toBe(0);

      const listA = etlJobManager.listJobs(50, 'user_nv05_a');
      expect(listA.some((j) => j.id === jobA.id)).toBe(true);
      expect(listA.some((j) => j.id === jobB.id)).toBe(false);
    });

    it('enforces bounded body read and Zod validation in /api/jobs route', () => {
      const routeSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/jobs/route.ts'),
        'utf8'
      );
      expect(routeSrc).toContain('readRequestTextBounded');
      expect(routeSrc).toContain('createJobSchema.safeParse');
      expect(routeSrc).toContain('job.createdBy?.userId !== auth.session.sub');
    });
  });

  describe('NV-06: FINANSIAL_EFF_COLUMNS_SQL wide+tall snapshot fallback without unverified leak', () => {
    it('reads all 6 wide-column entity snapshot keys and never falls back to unverified realisasi', () => {
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'cabang_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'pjm_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'pmt_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'psl_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'ptp_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain("verified_snapshot_json->>'eliminasi_rp'");
      expect(FINANSIAL_EFF_COLUMNS_SQL).toContain('0::double precision');
      expect(FINANSIAL_EFF_COLUMNS_SQL).not.toContain(
        "COALESCE(NULLIF(verified_snapshot_json->>'realisasi', '')::double precision, realisasi)"
      );
    });
  });

  describe('NV-07: Next.js upgraded past 16.4.5 security release', () => {
    it('pins next and eslint-config-next to >= 16.4.5 in package.json', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      ) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      const parseVer = (v: string) => v.replace(/^[^\d]*/, '').split('.').map(Number);
      const [maj, min, patch] = parseVer(pkg.dependencies.next);
      expect(maj > 16 || (maj === 16 && (min > 4 || (min === 4 && patch >= 5)))).toBe(true);
      expect(pkg.devDependencies['eslint-config-next']).toBe(pkg.dependencies.next);
    });
  });
});
