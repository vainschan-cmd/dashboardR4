import type { AuditLog, ImportBatch } from '../types';
import { getPool } from '../db/connection';

/**
 * Import batches and the audit trail.
 * Seluruh pencatatan riwayat audit disimpan langsung ke tabel 'audit_logs' dan 'import_batches' di PostgreSQL.
 */
export const auditRepository = {
  createImportBatch: async (batch: ImportBatch): Promise<void> => {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO import_batches (
          id, filename_or_url, source_type, department_id, branch_id,
          period_month, period_year, total_rows, valid_rows, error_rows,
          status, uploaded_by, uploaded_at, error_log
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::jsonb)`,
        [
          batch.id,
          batch.filename_or_url,
          batch.source_type,
          batch.department_id || null,
          batch.branch_id || null,
          batch.period_month,
          batch.period_year,
          batch.total_rows,
          batch.valid_rows,
          batch.error_rows,
          batch.status,
          batch.uploaded_by,
          batch.uploaded_at,
          batch.error_log ? JSON.stringify(batch.error_log) : null,
        ]
      );
    } catch (e) {
      console.warn('[PG] Gagal menyimpan import batch:', e);
    }
  },

  getImportBatches: async (): Promise<ImportBatch[]> => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM import_batches ORDER BY uploaded_at DESC LIMIT 50');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.rows.map((r: any) => ({
        ...r,
        error_log: typeof r.error_log === 'string' && r.error_log ? JSON.parse(r.error_log) : (r.error_log || null),
      })) as ImportBatch[];
    } catch {
      return [];
    }
  },

  createAuditLog: async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    try {
      const pool = getPool();
      const id = 'aud_' + Math.random().toString(36).substring(2, 10);
      const timestamp = new Date().toISOString();
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10)`,
        [
          id,
          log.user_id,
          log.user_name,
          log.user_role,
          log.action,
          log.entity,
          log.entity_id || null,
          log.details,
          timestamp,
          log.ip_address || '127.0.0.1',
        ]
      );
    } catch (e) {
      console.warn('[PG] Gagal mencatat audit log:', e);
    }
  },

  getAuditLogs: async (limit = 100): Promise<AuditLog[]> => {
    try {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows as AuditLog[];
    } catch {
      return [];
    }
  },
};
