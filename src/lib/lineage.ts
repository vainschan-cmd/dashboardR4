import type { DatabaseSync } from 'node:sqlite';

/**
 * Data lineage and verified-snapshot recovery (`DATA-05`).
 *
 * Two questions this module answers, both of which used to require reading the
 * database by hand:
 *
 * 1. **"Where did this number come from?"** — file, sheet, row, batch, uploader,
 *    upload time. Without it a figure on the dashboard cannot be traced back to
 *    the spreadsheet a branch manager sent, so a dispute has no resolution path.
 * 2. **"What did we approve, before it was edited?"** — verified rows keep a copy
 *    of the approved values; this module restores them.
 *
 * The snapshot is written by the write paths (a verified row that is edited stores
 * its last approved values). Restoring is deliberately explicit and audited: it
 * changes official figures, so it must name the actor.
 */

export interface LineageInput {
  sourceFile?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
  batchId?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  sourceType?: string | null;
}

export interface Lineage {
  sourceFile: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  batchId: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  sourceType: string | null;
  /** True when enough is known to point at a specific cell in a specific file. */
  isTraceable: boolean;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

/** Normalise whatever the caller has into a consistent lineage record. */
export function buildLineage(input: LineageInput): Lineage {
  const sourceRow = Number(input.sourceRow);
  return {
    sourceFile: clean(input.sourceFile),
    sourceSheet: clean(input.sourceSheet),
    sourceRow: Number.isFinite(sourceRow) && sourceRow > 0 ? Math.trunc(sourceRow) : null,
    batchId: clean(input.batchId),
    uploadedBy: clean(input.uploadedBy),
    uploadedAt: clean(input.uploadedAt),
    sourceType: clean(input.sourceType),
    // A file plus a row is what makes an origin claim checkable; a batch id alone
    // only says "one of the uploads".
    isTraceable: Boolean(clean(input.sourceFile) && Number.isFinite(sourceRow) && sourceRow > 0),
  };
}

/**
 * Human-readable origin, e.g.
 * `"dari laporan.xlsx, sheet LAPKEU, baris 12 · diunggah 10002 · batch batch_abc"`.
 * Returns `null` when nothing at all is known, so the UI can omit the line instead
 * of printing "tidak diketahui" everywhere.
 */
export function describeLineage(input: LineageInput): string | null {
  const lineage = buildLineage(input);
  const parts: string[] = [];

  if (lineage.sourceFile) {
    const where = [
      lineage.sourceSheet ? `sheet ${lineage.sourceSheet}` : null,
      lineage.sourceRow ? `baris ${lineage.sourceRow}` : null,
    ].filter(Boolean);
    parts.push(`dari ${lineage.sourceFile}${where.length ? `, ${where.join(', ')}` : ''}`);
  } else if (lineage.sourceType) {
    parts.push(
      lineage.sourceType === 'manual_input'
        ? 'input manual'
        : `sumber ${lineage.sourceType}`
    );
  }

  if (lineage.uploadedBy) parts.push(`diunggah ${lineage.uploadedBy}`);
  if (lineage.batchId) parts.push(`batch ${lineage.batchId}`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

export const SNAPSHOT_TABLES = [
  'module_finansial',
  'module_opkom',
  'module_kinerja',
  'module_utilisasi',
  'module_peralatan',
  'module_fasilitas',
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

export interface RestoreResult {
  restored: boolean;
  /** Columns that were written back, for the audit detail. */
  fields: string[];
  reason?: string;
}

/**
 * Restore a row to its last verified snapshot.
 *
 * Why this is not automatic: an edited row is `pending_verification`, and an
 * approver may legitimately prefer the new values. Reverting on its own would
 * throw away a correction. So the operation is explicit, names its actor, and
 * reports exactly which fields changed.
 */
export function restoreVerifiedSnapshot(
  db: DatabaseSync,
  options: { table: SnapshotTable; id: string; actorNipp: string }
): RestoreResult {
  const { table, id, actorNipp } = options;

  const row = db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  if (!row) return { restored: false, fields: [], reason: 'Baris tidak ditemukan.' };

  const rawSnapshot = row.verified_snapshot_json;
  if (!rawSnapshot) {
    return {
      restored: false,
      fields: [],
      reason: 'Baris ini tidak memiliki snapshot terverifikasi yang dapat dipulihkan.',
    };
  }

  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(String(rawSnapshot)) as Record<string, unknown>;
  } catch {
    return { restored: false, fields: [], reason: 'Snapshot rusak dan tidak dapat dibaca.' };
  }

  // Only restore columns that actually exist on the row: snapshots written before a
  // schema change may mention columns that are gone.
  const fields = Object.keys(snapshot).filter((key) => key in row && key !== 'id');
  if (fields.length === 0) {
    return { restored: false, fields: [], reason: 'Snapshot tidak memuat kolom yang dapat dipulihkan.' };
  }

  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => snapshot[field] as string | number | null);

  db.prepare(
    `UPDATE ${table}
        SET ${assignments},
            verification_status = 'verified',
            verified_by = ?,
            verified_at = ?,
            verified_snapshot_json = NULL
      WHERE id = ?`
  ).run(...values, actorNipp, new Date().toISOString(), id);

  return { restored: true, fields };
}

/** Does a row still carry a snapshot that could be restored? */
export function hasRestorableSnapshot(row: Record<string, unknown>): boolean {
  const raw = row.verified_snapshot_json;
  if (!raw) return false;
  try {
    const snapshot = JSON.parse(String(raw)) as Record<string, unknown>;
    return Object.keys(snapshot).length > 0;
  } catch {
    return false;
  }
}
