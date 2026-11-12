import { describe, it, expect } from 'vitest';

/**
 * Period predicate equivalence.
 *
 * `buildPeriodSql` in `/api/modules-data` originally used the compact form
 * `year * 100 + month BETWEEN ? AND ?`. That works but wraps the columns in an
 * expression, so SQLite cannot use the `(branch_code, year, month)` index for the
 * year/month part. The rewrite is only safe if it selects *exactly* the same
 * rows, so the predicate is reproduced here and compared against the original
 * formula over a synthetic month grid — no database required.
 */

type Range = { startYear: number; startMonth: number; endYear: number; endMonth: number };

/** The predicate the API used before the rewrite. */
function matchesLegacy(year: number, month: number, range: Range): boolean {
  const value = year * 100 + month;
  return value >= range.startYear * 100 + range.startMonth && value <= range.endYear * 100 + range.endMonth;
}

/**
 * Mirror of `buildPeriodSql`. Returns a predicate so it can be evaluated against
 * the same grid; the SQL string is asserted separately for shape.
 */
function buildPredicate(range: Range): { clause: string; test: (y: number, m: number) => boolean } {
  const sY = range.startYear;
  const sM = range.startMonth;
  const eY = range.endYear;
  const eM = range.endMonth;

  if (sY === eY) {
    const lo = Math.min(sM, eM);
    const hi = Math.max(sM, eM);
    return {
      clause: ' AND year = ? AND month BETWEEN ? AND ?',
      test: (y, m) => y === sY && m >= lo && m <= hi,
    };
  }

  return {
    clause: ' AND ((year = ? AND month >= ?) OR (year > ? AND year < ?) OR (year = ? AND month <= ?))',
    test: (y, m) =>
      (y === sY && m >= Math.min(sM, 12)) ||
      (y > sY && y < eY) ||
      (y === eY && m <= Math.max(eM, 1)),
  };
}

/** Every month from Jan `from` to Dec `to`, inclusive. */
function monthGrid(from: number, to: number): Array<{ year: number; month: number }> {
  const cells: Array<{ year: number; month: number }> = [];
  for (let year = from; year <= to; year += 1) {
    for (let month = 1; month <= 12; month += 1) cells.push({ year, month });
  }
  return cells;
}

const GRID = monthGrid(2023, 2028);

const CASES: Array<{ name: string; range: Range }> = [
  { name: 'YTD Sep 2026', range: { startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 } },
  { name: 'Q3 2026', range: { startYear: 2026, startMonth: 7, endYear: 2026, endMonth: 9 } },
  { name: 'Sep 2026 (satu bulan)', range: { startYear: 2026, startMonth: 9, endYear: 2026, endMonth: 9 } },
  { name: 'FY 2025', range: { startYear: 2025, startMonth: 1, endYear: 2025, endMonth: 12 } },
  { name: 'lintas tahun Nov 2025 – Feb 2026', range: { startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 2 } },
  { name: 'lintas tahun Des 2024 – Des 2025', range: { startYear: 2024, startMonth: 12, endYear: 2025, endMonth: 12 } },
];

describe('buildPeriodSql setara dengan rumus lama', () => {
  for (const { name, range } of CASES) {
    it(`${name}: memilih bulan yang sama persis`, () => {
      const { test } = buildPredicate(range);
      for (const { year, month } of GRID) {
        expect(test(year, month), `${year}-${month}`).toBe(matchesLegacy(year, month, range));
      }
    });
  }

  it('setiap kasus memilih lebih dari nol bulan (sanity check)', () => {
    for (const { name, range } of CASES) {
      const count = GRID.filter(({ year, month }) => buildPredicate(range).test(year, month)).length;
      expect(count, name).toBeGreaterThan(0);
    }
  });

  it('rentang satu tahun memakai bentuk yang bisa memakai index', () => {
    const { clause } = buildPredicate({ startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 });
    expect(clause).toContain('year = ?');
    expect(clause).toContain('month BETWEEN ? AND ?');
    // Tidak boleh ada aritmetika pada kolom — itu yang mematikan index.
    expect(clause).not.toMatch(/year\s*\*/);
    expect(clause).not.toMatch(/month\s*\*/);
  });

  it('rentang lintas tahun tidak memakai aritmetika kolom', () => {
    const { clause } = buildPredicate({ startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 2 });
    expect(clause).not.toMatch(/year\s*\*/);
    expect(clause).not.toMatch(/month\s*\*/);
    expect(clause).toContain('year = ?');
  });
});
