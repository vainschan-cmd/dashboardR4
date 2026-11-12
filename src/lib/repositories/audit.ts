import type { AuditLog, ImportBatch } from '../types';
import { getDb } from '../db/connection';

/**
 * Import batches and the audit trail (`CODE-03`).
 *
 * Both exist to answer "who did what, when" — keeping them in one module means
 * every mutating path has a single place to record itself, and the trail cannot
 * drift from the batch it describes.
 */
export const auditRepository = {
  // Import Batches
  createImportBatch: (batch: ImportBatch) => {
    const db = getDb();
    db.prepare(`
      INSERT INTO import_batches (
        id, filename_or_url, source_type, department_id, branch_id,
        period_month, period_year, total_rows, valid_rows, error_rows,
        status, uploaded_by, uploaded_at, error_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
      batch.error_log ? JSON.stringify(batch.error_log) : null
    );
  },
  getImportBatches: (): ImportBatch[] => {
    const rows = getDb().prepare('SELECT * FROM import_batches ORDER BY uploaded_at DESC LIMIT 50').all();
    return rows.map(r => ({
      ...(r as unknown as ImportBatch),
      error_log: typeof r.error_log === 'string' && r.error_log ? JSON.parse(r.error_log) : null
    }));
  },

  // Audit Log
  createAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const db = getDb();
    const id = 'aud_' + Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.user_id,
      log.user_name,
      log.user_role,
      log.action,
      log.entity,
      log.entity_id || null,
      log.details,
      timestamp,
      log.ip_address || '127.0.0.1'
    );
  },
  getAuditLogs: (limit = 100): AuditLog[] => {
    return getDb().prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as unknown as AuditLog[];
  },
};
