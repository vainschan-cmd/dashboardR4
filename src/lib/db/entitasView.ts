import type { DatabaseSync } from 'node:sqlite';

/**
 * `v_module_finansial_entitas` — a bridge between this project's financial table
 * and the shape the ported aggregation services expect.
 *
 * Why it exists
 * -------------
 * `module_finansial` stores one row per (branch, rekening, month) and keeps the
 * entity breakdown in **wide columns**: `cabang_rp`, `pjm_rp`, `pmt_rp`, `psl_rp`,
 * `ptp_rp`, `eliminasi_rp`, `konsolidasi_rp`.
 *
 * The aggregation SQL that arrived with the UI overhaul was written for the
 * PostgreSQL branch, where the same data is stored **tall**: one row per
 * (branch, rekening, entitas) with a single `realisasi` column. It therefore
 * selects a column called `entitas` and filters on it.
 *
 * Rather than reshape the table — which would break ingest, lineage, four-eyes,
 * and the verification workflow that all read the wide columns — the tall shape
 * is presented as a **view**. Both representations come from the same rows, so
 * no figure can drift: the view is a projection, not a copy.
 *
 * Adding a new entity means adding one branch to the UNION below, and nothing
 * else. `v_module_finansial_entitas_columns` in the test suite asserts that the
 * union covers every `*_rp` column, so a forgotten branch fails CI rather than
 * silently dropping that entity from the consolidated totals.
 */

/** Entity → the wide column that holds its amount, in display order. */
export const ENTITAS_SOURCE_COLUMNS = [
  { entitas: 'CABANG', column: 'cabang_rp' },
  { entitas: 'PJM', column: 'pjm_rp' },
  { entitas: 'PMT', column: 'pmt_rp' },
  { entitas: 'PSL', column: 'psl_rp' },
  { entitas: 'PTP', column: 'ptp_rp' },
  { entitas: 'ELIMINASI', column: 'eliminasi_rp' },
] as const;

/**
 * Build the view. `verified_snapshot_json` is projected unchanged so the
 * `eff_realisasi` / `eff_rka` / `eff_yoy` expressions keep working: they read the
 * snapshot to show the last verified value while an edit is pending.
 */
export function buildEntitasViewSql(): string {
  const selects = ENTITAS_SOURCE_COLUMNS.map(
    ({ entitas, column }) => `    SELECT
      id || '-${entitas}' AS id,
      monthly_record_id,
      year,
      month,
      branch_code,
      branch_name,
      rekening,
      '${entitas}' AS entitas,
      COALESCE(${column}, 0) AS realisasi,
      rka,
      yoy,
      source_type,
      verification_status,
      uploaded_by,
      uploaded_at,
      verified_by,
      verified_at,
      revision_notes,
      verified_snapshot_json,
      konsolidasi_rp
    FROM module_finansial`
  );

  return `CREATE VIEW IF NOT EXISTS v_module_finansial_entitas AS\n${selects.join('\n    UNION ALL\n')}`;
}

/** Create (or refresh) the bridge view. Idempotent. */
export function ensureEntitasView(db: DatabaseSync): void {
  db.exec(buildEntitasViewSql());
}

/** True when the source table exists, so migrations can no-op on partial schemas. */
export function hasFinansialTable(db: DatabaseSync): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'module_finansial'")
    .get();
  return Boolean(row);
}
