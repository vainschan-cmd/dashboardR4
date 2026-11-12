import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `CODE-02` — the dashboard shell must stay a composition root.
 *
 * The split is easy to undo by accident: the next feature adds "just one more"
 * effect to `page.tsx` and the file creeps back to a thousand lines. These
 * assertions pin the properties that made the split worth doing, rather than a
 * line count nobody can defend:
 *
 *   • the shell performs no I/O of its own (no `fetch`, no `localStorage`);
 *   • it does not branch on tab ids — that is `DashboardModuleView`'s job;
 *   • every lazily loaded module is registered in one file.
 */

const ROOT = resolve(__dirname, '../..');
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8');

const SHELL = 'src/app/page.tsx';

describe('shell dashboard (CODE-02)', () => {
  it('page.tsx tidak melakukan I/O sendiri', () => {
    const source = read(SHELL);
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('abortController');
  });

  it('page.tsx tidak lagi memilih modul berdasarkan id tab', () => {
    // The module switch belongs to DashboardModuleView. A `===` on a tab name
    // here means the 380-line switch is growing back.
    const source = read(SHELL);
    expect(source).not.toMatch(/activeTab\s*===\s*'/);
  });

  it('page.tsx tetap ringkas', () => {
    const lines = read(SHELL).split('\n').length;
    expect(lines, `page.tsx sudah ${lines} baris; batas 300`).toBeLessThan(300);
  });

  it('setiap hook dan komponen hasil pemecahan tetap terfokus', () => {
    const pieces = [
      'src/hooks/useDashboardSession.ts',
      'src/hooks/useDashboardFilters.ts',
      'src/hooks/useDashboardData.ts',
      'src/components/dashboard/DashboardModuleView.tsx',
      'src/components/dashboard/DashboardOverlays.tsx',
      'src/components/dashboard/GovernanceSubnav.tsx',
      'src/components/dashboard/DrilldownModal.tsx',
      'src/components/dashboard/IdleWarningBanner.tsx',
    ];
    for (const file of pieces) {
      const lines = read(file).split('\n').length;
      expect(lines, `${file} sudah ${lines} baris; batas 320`).toBeLessThan(320);
    }
  });

  it('semua pemecahan kode modul terdaftar di satu berkas registry', () => {
    const registry = read('src/components/dashboard/moduleRegistry.tsx');
    expect(registry).toContain("import('@/components/portsight/PortSightBeranda')");
    expect(registry).toContain("import('@/components/admin/VerificationQueue')");
    // `dynamic()` must not leak back into the shell.
    expect(read(SHELL)).not.toContain('next/dynamic');
  });

  it('daftar tab diambil dari satu sumber', () => {
    // Two hand-maintained tab lists is how `?tab=` and the RBAC guard drift.
    const tabs = read('src/lib/tabs.ts');
    expect(tabs).toContain('VALID_TABS');
    expect(tabs).toContain('GOVERNANCE_TABS');
    expect(read(SHELL)).not.toContain("'audit_trail'");
  });
});
