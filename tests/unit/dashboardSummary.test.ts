import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { consolidateSummaries, periodPredicate, type BranchSummary } from '@/lib/dashboardSummary';

/**
 * Period windowing for the Beranda aggregation (`PERF-03`).
 *
 * Regression under test: the cross-year three-range form was applied to every
 * multi-month window. For "YTD Sep 2026" that produced
 * `(year = 2026 AND month >= 1) OR …`, which also matches October and November.
 * Rows from those months then won the "newest row per account category" race and
 * corrupted four figures on eight branches — revenue included.
 *
 * The predicate is asserted by running it against a real in-memory SQLite month
 * grid, so a shape change that silently selects the wrong rows fails here rather
 * than in a dashboard a week later.
 */

interface Range {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

function monthsSelected(range: Range): number[] {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE module_finansial (year INTEGER, month INTEGER)');
  const insert = db.prepare('INSERT INTO module_finansial (year, month) VALUES (?, ?)');
  const years = new Set([
    range.startYear - 1,
    range.startYear,
    range.endYear,
    range.endYear + 1,
  ]);
  for (const year of years) {
    for (let month = 1; month <= 12; month++) insert.run(year, month);
  }

  const singleMonth = range.startYear === range.endYear && range.startMonth === range.endMonth;
  const { clause, params } = periodPredicate('', { ...range }, singleMonth);
  const rows = db
    .prepare(`SELECT year, month FROM module_finansial WHERE 1 = 1${clause} ORDER BY year, month`)
    .all(...params) as Array<{ year: number; month: number }>;
  db.close();

  // Encode each selected row as year*100+month so the assertions stay readable.
  return rows.map((r) => Number(r.year) * 100 + Number(r.month));
}

describe('periodPredicate', () => {
  it('excludes months after the end of a same-year window', () => {
    // The exact case that shipped broken: "YTD Sep 2026" must not read Oct/Nov.
    const selected = monthsSelected({ startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 });
    expect(selected).toEqual([
      202601, 202602, 202603, 202604, 202605, 202606, 202607, 202608, 202609,
    ]);
    expect(selected).not.toContain(202610);
    expect(selected).not.toContain(202611);
  });

  it('excludes months before the start of a same-year window', () => {
    const selected = monthsSelected({ startYear: 2026, startMonth: 4, endYear: 2026, endMonth: 9 });
    expect(selected).toEqual([202604, 202605, 202606, 202607, 202608, 202609]);
  });

  it('selects exactly one month when the window is a single month', () => {
    expect(monthsSelected({ startYear: 2026, startMonth: 9, endYear: 2026, endMonth: 9 })).toEqual([
      202609,
    ]);
  });

  it('spans a year boundary in both directions of the range', () => {
    const selected = monthsSelected({ startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 2 });
    expect(selected).toEqual([202511, 202512, 202601, 202602]);
  });

  it('uses plain comparisons so the composite index stays usable', () => {
    const sameYear = periodPredicate(
      '',
      { startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 },
      false
    );
    expect(sameYear.clause).toBe(' AND year = ? AND month BETWEEN ? AND ?');
    expect(sameYear.clause).not.toContain('* 100');

    const single = periodPredicate('', { startYear: 2026, startMonth: 9, endYear: 2026, endMonth: 9 }, true);
    expect(single.clause).toBe(' AND year = ? AND month = ?');
  });

  it('qualifies columns with the alias so joined queries do not become ambiguous', () => {
    const predicate = periodPredicate(
      'r',
      { startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 },
      false
    );
    expect(predicate.clause).toContain('r.year');
    expect(predicate.clause).toContain('r.month');
  });

  it('returns one parameter per placeholder', () => {
    const ranges: Range[] = [
      { startYear: 2026, startMonth: 1, endYear: 2026, endMonth: 9 },
      { startYear: 2026, startMonth: 9, endYear: 2026, endMonth: 9 },
      { startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 2 },
    ];
    for (const range of ranges) {
      const singleMonth = range.startYear === range.endYear && range.startMonth === range.endMonth;
      const predicate = periodPredicate('', range, singleMonth);
      expect(predicate.params).toHaveLength(predicate.clause.split('?').length - 1);
    }
  });
});

function summary(partial: Partial<BranchSummary>): BranchSummary {
  return {
    code: 'R01',
    name: 'Makassar',
    revenueTotal: null,
    operatingProfitTotal: null,
    teusTotal: null,
    tonTotal: null,
    avgRka: null,
    avgYoy: null,
    rfu: null,
    bor: null,
    hasData: false,
    dataStatus: 'no_data',
    ...partial,
  };
}

describe('consolidateSummaries', () => {
  it('sums the per-branch figures', () => {
    const totals = consolidateSummaries([
      summary({ code: 'R01', revenueTotal: 100, operatingProfitTotal: 10, teusTotal: 5, tonTotal: 2 }),
      summary({ code: 'R04', revenueTotal: 250, operatingProfitTotal: -40, teusTotal: 7, tonTotal: 3 }),
    ]);
    expect(totals).toEqual({
      revenueTotal: 350,
      operatingProfitTotal: -30,
      teusTotal: 12,
      tonTotal: 5,
    });
  });

  it('reports null instead of zero when no branch has a figure', () => {
    // "Rp 0" and "belum ada data" are different statements to an executive.
    const totals = consolidateSummaries([summary({}), summary({ code: 'R04' })]);
    expect(totals).toEqual({
      revenueTotal: null,
      operatingProfitTotal: null,
      teusTotal: null,
      tonTotal: null,
    });
  });

  it('ignores branches without data instead of treating them as zero', () => {
    const totals = consolidateSummaries([
      summary({ code: 'R01', revenueTotal: 100 }),
      summary({ code: 'R04', revenueTotal: null }),
    ]);
    expect(totals.revenueTotal).toBe(100);
  });

  it('keeps a genuine zero from a reporting branch', () => {
    const totals = consolidateSummaries([summary({ teusTotal: 0 }), summary({ code: 'R04' })]);
    expect(totals.teusTotal).toBe(0);
  });
});
