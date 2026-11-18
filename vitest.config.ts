import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

// Load only database connection variables from local .env when not already set
// in the shell/CI environment, so DB-backed tests never depend on hardcoded credentials.
const DB_ENV_KEYS = new Set(['DATABASE_URL', 'POSTGRES_URL', 'PGPASSWORD', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER']);
const localEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(localEnvPath)) {
  for (const line of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!DB_ENV_KEYS.has(key) || process.env[key] !== undefined) continue;
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

/**
 * Vitest configuration for unit tests.
 *
 * Scope: pure logic only — password policy, period parsing, secret encryption,
 * log redaction, request validation schemas, RBAC permission matrix, and the
 * spreadsheet row-limit helpers. These run in milliseconds and require no
 * server, database file, or credentials.
 *
 * The integration/security suite (login, sessions, CSRF, RBAC on real
 * endpoints) stays in `scripts/regression-test.mjs` because it needs a running
 * server with a seeded database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default'],
    clearMocks: true,
    // A unit suite that takes longer than this is doing I/O it should not do.
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
