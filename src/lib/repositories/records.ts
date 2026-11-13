import type { MonthlyRecord } from '../types';
import { query, withTransaction } from '../db/connection';
import type { PoolClient } from 'pg';

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const s = String(val);
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? s : new Date(parsed).toISOString();
}

function toIsoStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  return toIsoString(val);
}

export const recordsRepository = {
  // Monthly Records
  getMonthlyRecords: async (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MonthlyRecord[]> => {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filter.branch_id && filter.branch_id !== 'ALL') {
        if (filter.branch_id === 'NONE') {
          conditions.push('1 = 0');
        } else {
          const tokens = filter.branch_id
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          if (tokens.length === 1) {
            const p = `$${paramIndex++}`;
            conditions.push(`(r.branch_id = ${p} OR UPPER(b.code) = UPPER(${p}))`);
            params.push(tokens[0]);
          } else if (tokens.length > 1) {
            const orParts = tokens.map((tok) => {
              const p = `$${paramIndex++}`;
              params.push(tok);
              return `(r.branch_id = ${p} OR UPPER(b.code) = UPPER(${p}))`;
            });
            conditions.push(`(${orParts.join(' OR ')})`);
          }
        }
      }
      if (filter.department_id && filter.department_id !== 'ALL') {
        conditions.push(`r.department_id = $${paramIndex++}`);
        params.push(filter.department_id);
      }
      if (filter.month) {
        conditions.push(`r.month = $${paramIndex++}`);
        params.push(filter.month);
      }
      if (filter.year) {
        conditions.push(`r.year = $${paramIndex++}`);
        params.push(filter.year);
      }
      if (filter.verified_only) {
        conditions.push("r.verification_status = 'verified'");
      } else if (filter.verification_status && filter.verification_status !== 'ALL') {
        conditions.push(`r.verification_status = $${paramIndex++}`);
        params.push(filter.verification_status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let limitClause = '';
      if (filter.limit && filter.limit > 0) {
        limitClause = ` LIMIT $${paramIndex++}`;
        params.push(filter.limit);
        if (filter.offset && filter.offset > 0) {
          limitClause += ` OFFSET $${paramIndex++}`;
          params.push(filter.offset);
        }
      }
      const sql = `
        SELECT r.*,
               b.name AS branch_name, b.code AS branch_code,
               d.name AS department_name,
               k.name AS indicator_name, k.code AS indicator_code, k.direction
        FROM monthly_records r
        JOIN branches b ON r.branch_id = b.id
        JOIN departments d ON r.department_id = d.id
        JOIN kpi_indicators k ON r.indicator_id = k.id
        ${whereClause}
        ORDER BY r.year DESC, r.month DESC, b.code ASC, k.code ASC
        ${limitClause}
      `;

      const res = await query<Record<string, unknown>>(sql, params);
      return res.rows.map((r) => ({
        ...r,
        month: Number(r.month),
        year: Number(r.year),
        target: Number(r.target),
        realization: Number(r.realization),
        achievement_pct: Number(r.achievement_pct),
        uploaded_at: toIsoString(r.uploaded_at),
        verified_at: toIsoStringOrNull(r.verified_at),
        is_simulated: Boolean(r.is_simulated),
      })) as MonthlyRecord[];
    } catch {
      return [];
    }
  },

  getMonthlyRecordsByIds: async (recordIds: string[]): Promise<MonthlyRecord[]> => {
    if (!recordIds || recordIds.length === 0) return [];
    try {
      const res = await query<Record<string, unknown>>('SELECT * FROM monthly_records WHERE id = ANY($1::varchar[])', [recordIds]);
      return res.rows.map((r) => ({
        ...r,
        month: Number(r.month),
        year: Number(r.year),
        target: Number(r.target),
        realization: Number(r.realization),
        achievement_pct: Number(r.achievement_pct),
        uploaded_at: toIsoString(r.uploaded_at),
        verified_at: toIsoStringOrNull(r.verified_at),
        is_simulated: Boolean(r.is_simulated),
      })) as MonthlyRecord[];
    } catch {
      return [];
    }
  },

  countMonthlyRecords: async (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
  }): Promise<number> => {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filter.branch_id && filter.branch_id !== 'ALL') {
        if (filter.branch_id === 'NONE') {
          conditions.push('1 = 0');
        } else {
          const tokens = filter.branch_id.split(',').map((t) => t.trim()).filter(Boolean);
          if (tokens.length > 0) {
            const orParts = tokens.map((tok) => {
              const p = `$${paramIndex++}`;
              params.push(tok);
              return `(r.branch_id = ${p} OR UPPER(b.code) = UPPER(${p}))`;
            });
            conditions.push(`(${orParts.join(' OR ')})`);
          }
        }
      }
      if (filter.department_id && filter.department_id !== 'ALL') {
        conditions.push(`r.department_id = $${paramIndex++}`);
        params.push(filter.department_id);
      }
      if (filter.month) {
        conditions.push(`r.month = $${paramIndex++}`);
        params.push(filter.month);
      }
      if (filter.year) {
        conditions.push(`r.year = $${paramIndex++}`);
        params.push(filter.year);
      }
      if (filter.verified_only) {
        conditions.push("r.verification_status = 'verified'");
      } else if (filter.verification_status && filter.verification_status !== 'ALL') {
        conditions.push(`r.verification_status = $${paramIndex++}`);
        params.push(filter.verification_status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT COUNT(*)::int AS c
        FROM monthly_records r
        JOIN branches b ON r.branch_id = b.id
        ${whereClause}
      `;
      const res = await query(sql, params);
      return Number(res.rows[0]?.c || 0);
    } catch {
      return 0;
    }
  },

  getModuleUploadersByRecordIds: async (recordIds: string[]): Promise<Record<string, string>> => {
    if (!recordIds || recordIds.length === 0) return {};
    try {
      const res = await query(
        `SELECT DISTINCT monthly_record_id, uploaded_by
         FROM module_finansial
         WHERE monthly_record_id = ANY($1::varchar[]) AND uploaded_by IS NOT NULL`,
        [recordIds]
      );
      const map: Record<string, string> = {};
      for (const r of res.rows) {
        if (r.monthly_record_id && r.uploaded_by) {
          map[r.monthly_record_id] = r.uploaded_by;
        }
      }
      return map;
    } catch {
      return {};
    }
  },

  // Update record verification across monthly_records and all module_* tables
  updateRecordVerification: async (
    recordIds: string[],
    status: 'verified' | 'revision_needed',
    verifiedBy: string,
    revisionNotes?: string
  ): Promise<void> => {
    if (!recordIds || recordIds.length === 0) return;
    const now = new Date().toISOString();

    await withTransaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE monthly_records
         SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4
         WHERE id = ANY($5::varchar[])`,
        [status, verifiedBy, now, revisionNotes || null, recordIds]
      );

      const moduleTables = [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ];

      for (const table of moduleTables) {
        const sql =
          status === 'verified'
            ? `UPDATE ${table}
               SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4, verified_snapshot_json = NULL
               WHERE id = ANY($5::varchar[]) OR monthly_record_id = ANY($5::varchar[])`
            : `UPDATE ${table}
               SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4
               WHERE id = ANY($5::varchar[]) OR monthly_record_id = ANY($5::varchar[])`;
        await client.query(sql, [status, verifiedBy, now, revisionNotes || null, recordIds]);
      }
    });
  },

  // Save imported records
  insertMonthlyRecords: async (
    records: Omit<
      MonthlyRecord,
      'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'
    >[]
  ): Promise<void> => {
    if (!records || records.length === 0) return;

    await withTransaction(async (client: PoolClient) => {
      const upsertSql = `
        INSERT INTO monthly_records (
          id, branch_id, department_id, indicator_id, month, year,
          target, realization, unit, achievement_pct, status_color, notes,
          source_type, batch_id, verification_status, revision_notes,
          uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18::timestamptz, $19, $20::timestamptz, $21
        )
        ON CONFLICT (id) DO UPDATE SET
          branch_id = EXCLUDED.branch_id,
          department_id = EXCLUDED.department_id,
          indicator_id = EXCLUDED.indicator_id,
          month = EXCLUDED.month,
          year = EXCLUDED.year,
          target = EXCLUDED.target,
          realization = EXCLUDED.realization,
          unit = EXCLUDED.unit,
          achievement_pct = EXCLUDED.achievement_pct,
          status_color = EXCLUDED.status_color,
          notes = EXCLUDED.notes,
          source_type = EXCLUDED.source_type,
          batch_id = EXCLUDED.batch_id,
          verification_status = EXCLUDED.verification_status,
          revision_notes = EXCLUDED.revision_notes,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          is_simulated = EXCLUDED.is_simulated
      `;

      for (const r of records) {
        await client.query(upsertSql, [
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
          r.status_color || null,
          r.notes || null,
          r.source_type || 'manual_entry',
          r.batch_id || null,
          r.verification_status || 'verified',
          r.revision_notes || null,
          r.uploaded_by || null,
          r.uploaded_at || new Date().toISOString(),
          r.verified_by || null,
          r.verified_at || null,
          Boolean(r.is_simulated),
        ]);
      }
    });
  },
};
