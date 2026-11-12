import type { MonthlyRecord } from '../types';
import { getDb, withTransaction } from '../db/connection';

/**
 * Monthly KPI records — the table the verification workflow operates on
 * (`CODE-03`). Module tables are written alongside these and are kept in
 * `modules.ts`.
 */
export const recordsRepository = {
  // Monthly Records
  getMonthlyRecords: (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
    limit?: number;
    offset?: number;
  }): MonthlyRecord[] => {
    const db = getDb();
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter.branch_id && filter.branch_id !== 'ALL') {
      if (filter.branch_id === 'NONE') {
        conditions.push('1 = 0');
      } else {
        const tokens = filter.branch_id
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        if (tokens.length === 1) {
          conditions.push('(r.branch_id = ? OR UPPER(b.code) = UPPER(?))');
          params.push(tokens[0], tokens[0]);
        } else if (tokens.length > 1) {
          const placeholders = tokens.map(() => '(r.branch_id = ? OR UPPER(b.code) = UPPER(?))').join(' OR ');
          conditions.push(`(${placeholders})`);
          for (const tok of tokens) {
            params.push(tok, tok);
          }
        }
      }
    }
    if (filter.department_id && filter.department_id !== 'ALL') {
      conditions.push('r.department_id = ?');
      params.push(filter.department_id);
    }
    if (filter.month) {
      conditions.push('r.month = ?');
      params.push(filter.month);
    }
    if (filter.year) {
      conditions.push('r.year = ?');
      params.push(filter.year);
    }
    if (filter.verified_only) {
      conditions.push("r.verification_status = 'verified'");
    } else if (filter.verification_status && filter.verification_status !== 'ALL') {
      conditions.push('r.verification_status = ?');
      params.push(filter.verification_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // Bound the result set; callers may explicitly page through with limit/offset.
    const safeLimit = Math.min(1000, Math.max(1, Math.trunc(filter.limit ?? 200)));
    const safeOffset = Math.max(0, Math.trunc(filter.offset ?? 0));
    const sql = `
      SELECT r.*, 
             b.name as branch_name, b.code as branch_code,
             d.name as department_name,
             k.name as indicator_name, k.code as indicator_code, k.direction
      FROM monthly_records r
      JOIN branches b ON r.branch_id = b.id
      JOIN departments d ON r.department_id = d.id
      JOIN kpi_indicators k ON r.indicator_id = k.id
      ${whereClause}
      ORDER BY r.year DESC, r.month DESC, b.code ASC, k.code ASC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, safeLimit, safeOffset);
    return rows.map(r => ({
      ...(r as unknown as MonthlyRecord),
      is_simulated: Boolean(r.is_simulated)
    }));
  },

  /** Total row count for the same filter, so clients can render pagination. */
  countMonthlyRecords: (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
  }): number => {
    const db = getDb();
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter.branch_id && filter.branch_id !== 'ALL') {
      if (filter.branch_id === 'NONE') {
        conditions.push('1 = 0');
      } else {
        const tokens = filter.branch_id
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        if (tokens.length > 0) {
          const placeholders = tokens
            .map(() => '(r.branch_id = ? OR UPPER(b.code) = UPPER(?))')
            .join(' OR ');
          conditions.push(`(${placeholders})`);
          for (const tok of tokens) params.push(tok, tok);
        }
      }
    }
    if (filter.department_id && filter.department_id !== 'ALL') {
      conditions.push('r.department_id = ?');
      params.push(filter.department_id);
    }
    if (filter.month) {
      conditions.push('r.month = ?');
      params.push(filter.month);
    }
    if (filter.year) {
      conditions.push('r.year = ?');
      params.push(filter.year);
    }
    if (filter.verified_only) {
      conditions.push("r.verification_status = 'verified'");
    } else if (filter.verification_status && filter.verification_status !== 'ALL') {
      conditions.push('r.verification_status = ?');
      params.push(filter.verification_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM monthly_records r
         JOIN branches b ON r.branch_id = b.id
         ${whereClause}`
      )
      .get(...params) as { c: number } | undefined;
    return Number(row?.c || 0);
  },

  getMonthlyRecordsByIds: (recordIds: string[]): MonthlyRecord[] => {
    if (!recordIds || recordIds.length === 0) return [];
    const db = getDb();
    const placeholders = recordIds.map(() => '?').join(', ');
    const rows = db
      .prepare(`SELECT * FROM monthly_records WHERE id IN (${placeholders})`)
      .all(...recordIds);
    return rows.map(r => ({
      ...(r as unknown as MonthlyRecord),
      is_simulated: Boolean(r.is_simulated),
    }));
  },

  // Update record verification across monthly_records and all module_* tables
  updateRecordVerification: (
    recordIds: string[],
    status: 'verified' | 'revision_needed',
    verifiedBy: string,
    revisionNotes?: string
  ) => {
    if (!recordIds || recordIds.length === 0) return;
    const db = getDb();
    const now = new Date().toISOString();
    withTransaction(db, () => {
      const stmt = db.prepare(`
        UPDATE monthly_records
        SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?
        WHERE id = ?
      `);
      const moduleTables = [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ];
      const moduleStmts = moduleTables.map(table =>
        db.prepare(
          status === 'verified'
            ? `UPDATE ${table}
               SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?, verified_snapshot_json = NULL
               WHERE id = ? OR monthly_record_id = ?`
            : `UPDATE ${table}
               SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?
               WHERE id = ? OR monthly_record_id = ?`
        )
      );

      for (const id of recordIds) {
        stmt.run(status, verifiedBy, now, revisionNotes || null, id);
        for (const modStmt of moduleStmts) {
          modStmt.run(status, verifiedBy, now, revisionNotes || null, id, id);
        }
      }
    });
  },

  /**
   * Distinct uploaders recorded on the module rows that belong to the given
   * monthly records (`RBAC-14`).
   *
   * The four-eyes check used to look only at `monthly_records.uploaded_by`. Manual
   * input and import write the same figures into the six `module_*` tables as
   * well, and each of those rows carries its own `uploaded_by`; a verifier who is
   * the uploader of a module row was able to approve it as long as the parent
   * record said otherwise. This closes that gap.
   */
  getModuleUploadersByRecordIds: (recordIds: string[]): string[] => {
    if (!recordIds || recordIds.length === 0) return [];
    const db = getDb();
    const placeholders = recordIds.map(() => '?').join(',');
    const tables = [
      'module_finansial',
      'module_opkom',
      'module_kinerja',
      'module_utilisasi',
      'module_peralatan',
      'module_fasilitas',
    ];
    const uploaders = new Set<string>();
    for (const table of tables) {
      const rows = db
        .prepare(
          `SELECT DISTINCT uploaded_by FROM ${table}
            WHERE monthly_record_id IN (${placeholders}) AND uploaded_by IS NOT NULL AND uploaded_by != ''`
        )
        .all(...recordIds) as Array<{ uploaded_by: string }>;
      for (const row of rows) uploaders.add(String(row.uploaded_by).trim());
    }
    return [...uploaders];
  },

  // Save imported records
  insertMonthlyRecords: (records: Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>[]) => {
    if (!records || records.length === 0) return;
    const db = getDb();
    withTransaction(db, () => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO monthly_records (
          id, branch_id, department_id, indicator_id, month, year,
          target, realization, unit, achievement_pct, status_color, notes,
          source_type, batch_id, verification_status, revision_notes,
          uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const r of records) {
        stmt.run(
          r.id,
          r.branch_id,
          r.department_id,
          r.indicator_id,
          r.month,
          r.year,
          r.target,
          r.realization,
          r.unit,
          r.achievement_pct,
          r.status_color,
          r.notes || '',
          r.source_type,
          r.batch_id || null,
          r.verification_status,
          r.revision_notes || null,
          r.uploaded_by,
          r.uploaded_at,
          r.verified_by || null,
          r.verified_at || null,
          r.is_simulated ? 1 : 0
        );
      }
    });
  },
};
