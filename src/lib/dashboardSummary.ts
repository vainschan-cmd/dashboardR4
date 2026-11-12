import type { DatabaseSync } from 'node:sqlite';
import { getDb } from './db';
import { getBranchByCode, OFFICIAL_BRANCHES } from './constants';
import { resolveDataStatus, type DataStatus } from './dataStatus';
import type { VerificationStatus } from './types';

/**
 * Server-side aggregation for the Beranda (executive) view — `PERF-03`.
 *
 * Problem
 * -------
 * Beranda downloaded every raw module row for the selected period and aggregated
 * in the browser: 523 KB uncompressed for a YTD window, dominated by
 * `module_peralatan` (191 KB) and `module_fasilitas` (58 KB) — tables whose
 * per-branch averages are the only thing the page needs.
 *
 * Semantics that MUST be preserved
 * --------------------------------
 * This page shows "the latest reported figure inside the window", not "the sum of
 * every month in the window". For a multi-month window `/api/modules-data` keeps
 * one row per (branch, account category) — the most recent month — and the client
 * sums those. Summing all months in SQL produced roughly double the legacy
 * revenue for every branch, which `scripts/verify-summary-equivalence.mjs`
 * caught immediately.
 *
 * | Figure | Rule |
 * |---|---|
 * | revenue | latest row per (branch, account category) whose `rekening` mentions "pendapatan"; falls back to opkom rows denominated in Rp |
 * | operating profit | latest row per (branch, category) whose `rekening` is "laba usaha" |
 * | RKAP / YoY | average over all opkom rows in the window; falls back to the revenue rows |
 * | TEUs / ton | sum of opkom rows whose unit mentions TEUS / TON; `0` when such rows exist but are zero |
 * | RFU | average `availability` of equipment rows with availability > 0; falls back to `kpi_rfu` |
 * | BOR | `bor` of the newest utilisasi row for the branch |
 *
 * A single-month window is treated like the raw endpoint treats an explicit
 * period: no per-category de-duplication.
 *
 * Verification: `scripts/verify-summary-equivalence.mjs` recomputes every branch
 * with the original client algorithm and diffs all eight figures.
 */

export interface BranchSummary {
  code: string;
  name: string;
  revenueTotal: number | null;
  operatingProfitTotal: number | null;
  teusTotal: number | null;
  tonTotal: number | null;
  avgRka: number | null;
  avgYoy: number | null;
  /** Average equipment availability (RFU), one decimal, as a display string. */
  rfu: string | null;
  bor: number | null;
  hasData: boolean;
  /**
   * Explicit status (`DATA-04`). Consumers must not infer "no data" from a zero:
   * a branch that reported zero TEUs is `verified` with value 0, while a branch
   * that never filed a report is `no_data` with value `null`.
   */
  dataStatus: DataStatus;
}

export interface SummaryQuery {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  /** Canonical branch codes; empty/undefined means all branches. */
  branchCodes?: string[];
  /** Viewer / forced mode: only rows whose verification_status is 'verified'. */
  verifiedOnly?: boolean;
}

/**
 * Account-category grouping used by `/api/modules-data`.
 * Mirrors `canonicalRekeningCategory`: order matters — "laba bersih" must be
 * classified before the generic "laba" match.
 */
const CATEGORY_SQL = `
  CASE
    WHEN LOWER(rekening) LIKE '%beban%' THEN 'beban'
    WHEN LOWER(rekening) LIKE '%bersih%' THEN 'laba_bersih'
    WHEN LOWER(rekening) LIKE '%laba%' THEN 'laba_usaha'
    WHEN LOWER(rekening) LIKE '%ebitda%' THEN 'ebitda'
    ELSE 'pendapatan'
  END
`;

/**
 * Build the period predicate and its parameters together, so the two can never
 * drift apart.
 *
 * Same-year windows collapse to `year = ? AND month BETWEEN ? AND ?`. Only a
 * window that actually crosses a year boundary needs the three-range form, and
 * that form is only correct when `startYear < endYear` — writing it
 * unconditionally made `(year = 2026 AND month >= 1)` match October and
 * November rows in a "YTD Sep 2026" window, which inflated four figures on eight
 * branches.
 *
 * Compact tricks such as `year * 100 + month BETWEEN ? AND ?` are avoided: they
 * wrap the columns in an expression and stop SQLite from using the
 * `(branch_code, year, month)` index.
 */
export function periodPredicate(
  alias: string,
  query: SummaryQuery,
  singleMonth: boolean
): { clause: string; params: number[] } {
  const p = alias ? `${alias}.` : '';
  if (singleMonth) {
    return {
      clause: ` AND ${p}year = ? AND ${p}month = ?`,
      params: [query.endYear, query.endMonth],
    };
  }
  if (query.startYear === query.endYear) {
    return {
      clause: ` AND ${p}year = ? AND ${p}month BETWEEN ? AND ?`,
      params: [query.startYear, Math.min(query.startMonth, 12), Math.max(query.endMonth, 1)],
    };
  }
  return {
    clause: ` AND ((${p}year = ? AND ${p}month >= ?) OR (${p}year > ? AND ${p}year < ?) OR (${p}year = ? AND ${p}month <= ?))`,
    params: [
      query.startYear,
      Math.min(query.startMonth, 12),
      query.startYear,
      query.endYear,
      query.endYear,
      Math.max(query.endMonth, 1),
    ],
  };
}

function branchClause(codes: string[] | undefined, column = 'branch_code'): string {
  if (!codes || codes.length === 0) return '';
  return ` AND ${column} IN (${codes.map(() => '?').join(',')})`;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildBranchSummaries(query: SummaryQuery): BranchSummary[] {
  const db: DatabaseSync = getDb();
  const codes = query.branchCodes && query.branchCodes.length > 0 ? query.branchCodes : undefined;
  const singleMonth = query.startYear === query.endYear && query.startMonth === query.endMonth;
  const period = periodPredicate('', query, singleMonth);
  const periodKpi = periodPredicate('r', query, singleMonth);
  const bParams = codes ?? [];
  const verified = Boolean(query.verifiedOnly);
  const verifiedFin = verified ? " AND verification_status = 'verified'" : '';

  // --- Finansial: latest month per (branch, account category) ---------------
  // A multi-month window reports the newest row of each account category; an
  // explicit single month keeps every row of that month (matching the raw
  // endpoint, which only de-duplicates when a range spans several months).
  const finansialRanked = singleMonth
    ? ''
    : `, ranked AS (
         SELECT scoped.*,
                ROW_NUMBER() OVER (
                  PARTITION BY branch_code, category
                  ORDER BY year DESC, month DESC, rowid ASC
                ) AS rn
           FROM scoped
       )`;
  const finansialSource = singleMonth ? 'scoped' : 'ranked';
  const finansialRankFilter = singleMonth ? '' : ' WHERE rn = 1';

  const finansialRows = db
    .prepare(
      `WITH scoped AS (
         SELECT branch_code, rekening, konsolidasi_rp,
                ROUND(rka, 1) AS rka, ROUND(yoy, 1) AS yoy,
                year, month, rowid AS rowid,
                ${CATEGORY_SQL} AS category
           FROM module_finansial
          WHERE 1 = 1${period.clause}${branchClause(codes)}${verifiedFin}
       )${finansialRanked}
       SELECT branch_code AS code,
              SUM(CASE WHEN LOWER(rekening) LIKE '%pendapatan%' THEN konsolidasi_rp ELSE 0 END) AS revenue,
              COUNT(CASE WHEN LOWER(rekening) LIKE '%pendapatan%' THEN 1 END) AS revenue_rows,
              ROUND(AVG(CASE WHEN LOWER(rekening) LIKE '%pendapatan%' THEN rka END), 1) AS revenue_rka,
              ROUND(AVG(CASE WHEN LOWER(rekening) LIKE '%pendapatan%' THEN yoy END), 1) AS revenue_yoy,
              SUM(CASE WHEN LOWER(rekening) = 'laba usaha' THEN konsolidasi_rp ELSE 0 END) AS profit,
              COUNT(CASE WHEN LOWER(rekening) = 'laba usaha' THEN 1 END) AS profit_rows
         FROM ${finansialSource}${finansialRankFilter}
        GROUP BY branch_code`
    )
    .all(...period.params, ...bParams) as Array<Record<string, unknown>>;

  // --- Opkom ---------------------------------------------------------------
  const opkomRows = db
    .prepare(
      `SELECT branch_code AS code,
              SUM(CASE WHEN satuan = 'Rp' THEN jumlah_rp ELSE 0 END) AS revenue_fallback,
              COUNT(CASE WHEN satuan = 'Rp' THEN 1 END) AS revenue_fallback_rows,
              SUM(CASE WHEN UPPER(satuan) LIKE '%TEUS%' THEN jumlah_rp ELSE 0 END) AS teus,
              COUNT(CASE WHEN UPPER(satuan) LIKE '%TEUS%' THEN 1 END) AS teus_rows,
              SUM(CASE WHEN UPPER(satuan) LIKE '%TON%' THEN jumlah_rp ELSE 0 END) AS ton,
              COUNT(CASE WHEN UPPER(satuan) LIKE '%TON%' THEN 1 END) AS ton_rows,
              ROUND(AVG(ROUND(rka, 1)), 1) AS avg_rka,
              ROUND(AVG(ROUND(yoy, 1)), 1) AS avg_yoy,
              COUNT(*) AS row_count
         FROM module_opkom
        WHERE 1 = 1${period.clause}${branchClause(codes)}${verifiedFin}
        GROUP BY branch_code`
    )
    .all(...period.params, ...bParams) as Array<Record<string, unknown>>;

  // --- Peralatan: average availability where > 0 ---------------------------
  const equipmentRows = db
    .prepare(
      `SELECT branch_code AS code, AVG(COALESCE(availability, 0)) AS rfu, COUNT(*) AS valid_count
         FROM module_peralatan
        WHERE COALESCE(availability, 0) > 0${period.clause}${branchClause(codes)}${verifiedFin}
        GROUP BY branch_code`
    )
    .all(...period.params, ...bParams) as Array<Record<string, unknown>>;

  // --- RFU fallback from KPI records --------------------------------------
  const rfuFallbackRows = db
    .prepare(
      `SELECT UPPER(b.code) AS code, AVG(r.realization) AS rfu
         FROM monthly_records r
         JOIN branches b ON r.branch_id = b.id
        WHERE r.indicator_id = 'kpi_rfu'${periodKpi.clause}
              ${branchClause(codes, 'UPPER(b.code)')}${verified ? " AND r.verification_status = 'verified'" : ''}
        GROUP BY UPPER(b.code)`
    )
    .all(...periodKpi.params, ...bParams) as Array<Record<string, unknown>>;

  // --- Utilisasi: the newest row's BOR (not an average) -------------------
  const utilisationRows = db
    .prepare(
      // The page shows the newest month's BOR, not an average: the raw endpoint
      // hands the client every utilisasi row and it reads only the first one.
      `WITH ranked AS (
         SELECT branch_code, COALESCE(bor, 0) AS bor,
                ROW_NUMBER() OVER (
                  PARTITION BY branch_code
                  ORDER BY year DESC, month DESC, rowid ASC
                ) AS rn
           FROM module_utilisasi
          WHERE 1 = 1${period.clause}${branchClause(codes)}${verifiedFin}
       )
       SELECT branch_code AS code, bor FROM ranked WHERE rn = 1`
    )
    .all(...period.params, ...bParams) as Array<Record<string, unknown>>;

  // --- Verification status per branch (`DATA-04`) --------------------------
  // Which statuses are present behind each figure. Read from the two tables that
  // define `hasData` (opkom and finansial) so the status and the numbers always
  // describe the same rows. Note this query is intentionally NOT filtered by
  // `verifiedOnly`: an executive needs to know that a branch has *only* pending
  // data, which is invisible if the rows are filtered out before counting.
  const statusRows = db
    .prepare(
      `SELECT code, verification_status AS status, SUM(n) AS n FROM (
         SELECT branch_code AS code, COALESCE(verification_status, 'pending_verification') AS verification_status, COUNT(*) AS n
           FROM module_opkom WHERE 1 = 1${period.clause}${branchClause(codes)}
          GROUP BY branch_code, verification_status
         UNION ALL
         SELECT branch_code AS code, COALESCE(verification_status, 'pending_verification') AS verification_status, COUNT(*) AS n
           FROM module_finansial WHERE 1 = 1${period.clause}${branchClause(codes)}
          GROUP BY branch_code, verification_status
       )
       GROUP BY code, status`
    )
    .all(...period.params, ...bParams, ...period.params, ...bParams) as Array<Record<string, unknown>>;

  const statusMap = new Map<string, { statuses: VerificationStatus[]; rowCount: number }>();
  for (const row of statusRows) {
    const code = String(row.code || '').toUpperCase();
    if (!code) continue;
    const entry = statusMap.get(code) ?? { statuses: [], rowCount: 0 };
    entry.statuses.push(String(row.status) as VerificationStatus);
    entry.rowCount += Number(row.n || 0);
    statusMap.set(code, entry);
  }

  const toMap = <T>(rows: Array<Record<string, unknown>>, pick: (row: Record<string, unknown>) => T) => {
    const map = new Map<string, T>();
    for (const row of rows) {
      const code = String(row.code || '').toUpperCase();
      if (code) map.set(code, pick(row));
    }
    return map;
  };

  const finansialMap = toMap(finansialRows, (r) => ({
    revenue: num(r.revenue),
    revenueRows: Number(r.revenue_rows || 0),
    revenueRka: num(r.revenue_rka),
    revenueYoy: num(r.revenue_yoy),
    profit: num(r.profit),
    profitRows: Number(r.profit_rows || 0),
  }));
  const opkomMap = toMap(opkomRows, (r) => ({
    revenueFallback: num(r.revenue_fallback),
    revenueFallbackRows: Number(r.revenue_fallback_rows || 0),
    teus: num(r.teus),
    teusRows: Number(r.teus_rows || 0),
    ton: num(r.ton),
    tonRows: Number(r.ton_rows || 0),
    avgRka: num(r.avg_rka),
    avgYoy: num(r.avg_yoy),
    rowCount: Number(r.row_count || 0),
  }));
  const equipmentMap = toMap(equipmentRows, (r) => ({
    rfu: num(r.rfu),
    validCount: Number(r.valid_count || 0),
  }));
  const rfuFallbackMap = toMap(rfuFallbackRows, (r) => num(r.rfu));
  const borMap = toMap(utilisationRows, (r) => num(r.bor));

  const targetCodes = codes ?? OFFICIAL_BRANCHES.map((b) => b.code);

  const summaries: BranchSummary[] = [];
  for (const rawCode of targetCodes) {
    const code = String(rawCode || '').toUpperCase();
    if (!code) continue;

    const fin = finansialMap.get(code);
    const opk = opkomMap.get(code);
    const alat = equipmentMap.get(code);
    const rfuFallback = rfuFallbackMap.get(code);

    // Revenue: finansial rows mentioning "pendapatan"; otherwise opkom in Rp.
    let revenueTotal: number | null = null;
    if (fin && fin.revenueRows > 0) revenueTotal = fin.revenue;
    else if (opk && opk.revenueFallbackRows > 0) revenueTotal = opk.revenueFallback;

    const operatingProfitTotal = fin && fin.profitRows > 0 ? fin.profit : null;

    // RKAP / YoY: opkom average wins whenever the branch has opkom rows.
    const avgRka =
      opk && opk.rowCount > 0 && opk.avgRka !== null
        ? opk.avgRka
        : fin && fin.revenueRows > 0 && fin.revenueRka !== null
          ? fin.revenueRka
          : null;
    const avgYoy =
      opk && opk.rowCount > 0 && opk.avgYoy !== null
        ? opk.avgYoy
        : fin && fin.revenueRows > 0 && fin.revenueYoy !== null
          ? fin.revenueYoy
          : null;

    // TEUs / ton: zero is a real reported value, distinct from "no rows".
    const teusTotal = opk && opk.teusRows > 0 ? opk.teus : null;
    const tonTotal = opk && opk.tonRows > 0 ? opk.ton : null;

    // RFU: equipment first, then KPI records.
    let rfu: string | null = null;
    if (alat && alat.validCount > 0 && alat.rfu !== null) {
      rfu = alat.rfu.toFixed(1);
    } else if (rfuFallback !== null && rfuFallback !== undefined) {
      rfu = rfuFallback.toFixed(1);
    }

    const bor = borMap.get(code) ?? null;
    const hasData = Boolean(
      (opk && opk.rowCount > 0) || (fin && fin.revenueRows > 0) || (fin && fin.profitRows > 0)
    );

    const info = getBranchByCode(code) || OFFICIAL_BRANCHES.find((b) => b.code === code);

    // `DATA-04`: the status is derived from the rows behind the numbers, so a
    // branch with data is never reported as "belum ada data" and vice versa.
    const statusEntry = statusMap.get(code);
    const dataStatus = resolveDataStatus({
      rowCount: statusEntry?.rowCount ?? 0,
      verificationStatuses: statusEntry?.statuses ?? [],
    });

    summaries.push({
      code,
      name: info ? info.name : code,
      revenueTotal,
      operatingProfitTotal,
      teusTotal,
      tonTotal,
      avgRka,
      avgYoy,
      rfu,
      bor,
      hasData,
      dataStatus,
    });
  }

  return summaries;
}

/** Consolidate per-branch summaries into the headline totals the cards show. */
export function consolidateSummaries(summaries: BranchSummary[]): {
  revenueTotal: number | null;
  operatingProfitTotal: number | null;
  teusTotal: number | null;
  tonTotal: number | null;
} {
  const sum = (values: Array<number | null>): number | null => {
    const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
    // A total over zero data points is "no data", not zero.
    return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
  };

  return {
    revenueTotal: sum(summaries.map((s) => s.revenueTotal)),
    operatingProfitTotal: sum(summaries.map((s) => s.operatingProfitTotal)),
    teusTotal: sum(summaries.map((s) => s.teusTotal)),
    tonTotal: sum(summaries.map((s) => s.tonTotal)),
  };
}
