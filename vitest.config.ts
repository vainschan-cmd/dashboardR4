import { defineConfig } from 'vitest/config';
import path from 'node:path';

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
