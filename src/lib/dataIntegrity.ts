import type { DatabaseSync } from 'node:sqlite';
import { OFFICIAL_BRANCHES } from './constants';

/**
 * Referential integrity for the `module_*` tables (`DATA-10`).
 *
 * These six tables store a `branch_code` and a `(year, month)` but have no foreign
 * key to `branches` — SQLite cannot add one retroactively without rebuilding the
 * table, and the ingest scripts write into them directly. The result was a silent
 * class of bug: a row attributed to `"R1"`, `"MAKASSAR"`, or `"R01 "` looks valid
 * to every query and simply never appears on any branch's dashboard, so the totals
 * quietly disagree with the branch reports.
 *
 * Two defences, because validation only protects the future:
 *
 * 1. `validateModuleScope` — called before a write, so a bad code never lands.
 * 2. `auditModuleTables` — reports rows that are already orphaned, so an operator
 *    can repair them instead of hoping they do not exist.
 */

export const MODULE_TABLES = [
  'module_finansial',
  'module_opkom',
  'module_kinerja',
  'module_utilisasi',
  'module_peralatan',
  'module_fasilitas',
] as const;

export type ModuleTable = (typeof MODULE_TABLES)[number];

const KNOWN_BRANCH_CODES = new Set(OFFICIAL_BRANCHES.map((b) => b.code.toUpperCase()));

/** Plausible reporting window. Anything outside is a typo, not a period. */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export interface ModuleScope {
  branchCode: unknown;
  month: unknown;
  year: unknown;
}

export interface ScopeValidation {
  ok: boolean;
  /** Present only when `ok` is true — the value actually safe to store. */
  scope?: { branchCode: string; month: number; year: number };
  /** Human-readable problems, empty when `ok`. */
  issues: string[];
}

/**
 * A branch code is only valid if it is already canonical. This is deliberately
 * stricter than `getCanonicalBranchCode`, which passes unknown codes through: for
 * a write we must refuse rather than guess, because a wrong branch is worse than
 * a rejected save.
 */
export function isKnownBranchCode(code: unknown): boolean {
  return KNOWN_BRANCH_CODES.has(String(code ?? '').trim().toUpperCase());
}

export function validateModuleScope(input: ModuleScope): ScopeValidation {
  const issues: string[] = [];

  const rawCode = String(input.branchCode ?? '').trim();
  const branchCode = rawCode.toUpperCase();
  if (!rawCode) {
    issues.push('Kode cabang wajib diisi; data tidak boleh diatribusikan ke cabang default.');
  } else if (!KNOWN_BRANCH_CODES.has(branchCode)) {
    issues.push(
      `Kode cabang "${rawCode}" tidak dikenal. Gunakan kode resmi seperti R01, R04, atau R99.`
    );
  } else if (rawCode !== branchCode) {
    // Not an error, but normalise so `r01` and `R01` do not become two branches.
    // Recorded as an observation rather than a rejection.
    issues.push('__normalise__');
  }

  const month = Number(input.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    issues.push(`Bulan "${String(input.month)}" tidak valid; harus bilangan bulat 1–12.`);
  }

  const year = Number(input.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    issues.push(`Tahun "${String(input.year)}" tidak valid; harus ${MIN_YEAR}–${MAX_YEAR}.`);
  }

  const realIssues = issues.filter((i) => i !== '__normalise__');
  if (realIssues.length > 0) return { ok: false, issues: realIssues };

  return {
    ok: true,
    scope: { branchCode, month, year },
    issues: [],
  };
}

/** Thrown by write paths so the caller can return 400 instead of storing garbage. */
export class ModuleScopeError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join(' '));
    this.name = 'ModuleScopeError';
    this.issues = issues;
  }
}

/** Validate or throw. Use this at the boundary of a write. */
export function assertModuleScope(input: ModuleScope): { branchCode: string; month: number; year: number } {
  const result = validateModuleScope(input);
  if (!result.ok || !result.scope) throw new ModuleScopeError(result.issues);
  return result.scope;
}

export interface TableIntegrityReport {
  table: ModuleTable;
  totalRows: number;
  /** Rows whose branch code is not one of the official branches. */
  orphanBranchRows: number;
  /** Rows with a month outside 1–12 or a year outside the accepted window. */
  invalidPeriodRows: number;
  /** Rows pointing at a monthly record that no longer exists. */
  danglingRecordRows: number;
  /** A few ids from each category, so a human can find them. */
  sampleIds: string[];
}

export interface IntegrityAudit {
  checkedAt: string;
  tables: TableIntegrityReport[];
  /** True when every table is clean. */
  ok: boolean;
  totalProblems: number;
}

function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((c) => c.name === column);
}

/**
 * Report rows in the module tables that no branch or period can explain.
 *
 * Read-only by design: deleting financial rows automatically is a worse failure
 * mode than reporting them, and the correct repair depends on where the row came
 * from (re-import, manual correction, or removal).
 */
export function auditModuleTables(db: DatabaseSync): IntegrityAudit {
  const tables: TableIntegrityReport[] = [];
  let totalProblems = 0;

  for (const table of MODULE_TABLES) {
    if (!tableExists(db, table)) {
      tables.push({
        table,
        totalRows: 0,
        orphanBranchRows: 0,
        invalidPeriodRows: 0,
        danglingRecordRows: 0,
        sampleIds: [],
      });
      continue;
    }

    const totalRows = Number(
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n ?? 0
    );

    const knownList = [...KNOWN_BRANCH_CODES].map(() => '?').join(',');
    const orphanRows = db
      .prepare(
        `SELECT id, branch_code FROM ${table}
          WHERE branch_code IS NULL OR UPPER(TRIM(branch_code)) NOT IN (${knownList})`
      )
      .all(...[...KNOWN_BRANCH_CODES]) as Array<{ id: string; branch_code: string | null }>;

    const invalidPeriod = db
      .prepare(
        `SELECT id FROM ${table}
          WHERE month IS NULL OR month < 1 OR month > 12
             OR year IS NULL OR year < ? OR year > ?`
      )
      .all(MIN_YEAR, MAX_YEAR) as Array<{ id: string }>;

    let dangling: Array<{ id: string }> = [];
    if (hasColumn(db, table, 'monthly_record_id') && tableExists(db, 'monthly_records')) {
      dangling = db
        .prepare(
          `SELECT m.id FROM ${table} m
            WHERE m.monthly_record_id IS NOT NULL AND m.monthly_record_id != ''
              AND NOT EXISTS (SELECT 1 FROM monthly_records r WHERE r.id = m.monthly_record_id)`
        )
        .all() as Array<{ id: string }>;
    }

    const problems = orphanRows.length + invalidPeriod.length + dangling.length;
    totalProblems += problems;

    tables.push({
      table,
      totalRows,
      orphanBranchRows: orphanRows.length,
      invalidPeriodRows: invalidPeriod.length,
      danglingRecordRows: dangling.length,
      sampleIds: [
        ...orphanRows.slice(0, 3).map((r) => r.id),
        ...invalidPeriod.slice(0, 3).map((r) => r.id),
        ...dangling.slice(0, 3).map((r) => r.id),
      ],
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    tables,
    ok: totalProblems === 0,
    totalProblems,
  };
}
