import { query } from '@/lib/db/connection';
import { roundTo } from '@/lib/numericPrecision';

export interface TargetVersion {
  id: string;
  indicator_id: string;
  version: number;
  target_value: number;
  effective_from: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface CreateTargetVersionInput {
  indicator_id: string;
  target_value: number;
  effective_from: string;
  notes?: string;
  created_by: string;
}

export async function ensureTargetVersionsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS kpi_target_versions (
      id VARCHAR(64) PRIMARY KEY,
      indicator_id VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      target_value NUMERIC(18, 4) NOT NULL,
      effective_from DATE NOT NULL,
      notes TEXT,
      created_by VARCHAR(64) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_indicator_version UNIQUE (indicator_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_kpi_target_ver_ind ON kpi_target_versions (indicator_id, effective_from DESC);
  `);
}

export async function getTargetVersions(indicatorId: string): Promise<TargetVersion[]> {
  await ensureTargetVersionsTable();
  const res = await query(
    `SELECT id, indicator_id, version, target_value, effective_from::text as effective_from, notes, created_by, created_at::text as created_at
     FROM kpi_target_versions
     WHERE indicator_id = $1
     ORDER BY version DESC`,
    [indicatorId]
  );

  return res.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    indicator_id: String(r.indicator_id),
    version: Number(r.version),
    target_value: Number(r.target_value),
    effective_from: String(r.effective_from).slice(0, 10),
    notes: String(r.notes || ''),
    created_by: String(r.created_by),
    created_at: String(r.created_at),
  }));
}

export async function getActiveTarget(
  indicatorId: string,
  referenceDate?: string
): Promise<TargetVersion | null> {
  await ensureTargetVersionsTable();
  const dateStr = referenceDate || new Date().toISOString().slice(0, 10);
  const res = await query(
    `SELECT id, indicator_id, version, target_value, effective_from::text as effective_from, notes, created_by, created_at::text as created_at
     FROM kpi_target_versions
     WHERE indicator_id = $1 AND effective_from <= $2
     ORDER BY effective_from DESC, version DESC
     LIMIT 1`,
    [indicatorId, dateStr]
  );

  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: String(r.id),
    indicator_id: String(r.indicator_id),
    version: Number(r.version),
    target_value: Number(r.target_value),
    effective_from: String(r.effective_from).slice(0, 10),
    notes: String(r.notes || ''),
    created_by: String(r.created_by),
    created_at: String(r.created_at),
  };
}

export async function createTargetVersion(
  input: CreateTargetVersionInput
): Promise<TargetVersion> {
  await ensureTargetVersionsTable();
  const indicatorId = input.indicator_id.trim();
  const targetVal = roundTo(input.target_value, 4);
  const effectiveFrom = input.effective_from.trim().slice(0, 10);
  const notes = (input.notes || '').trim();
  const createdBy = input.created_by.trim() || 'system';

  // Get current max version
  const maxRes = await query(
    `SELECT COALESCE(MAX(version), 0) as max_ver FROM kpi_target_versions WHERE indicator_id = $1`,
    [indicatorId]
  );
  const nextVer = Number(maxRes.rows[0]?.max_ver || 0) + 1;
  const id = `tgt_ver_${indicatorId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_v${nextVer}_${Date.now()}`;

  const insertRes = await query(
    `INSERT INTO kpi_target_versions (id, indicator_id, version, target_value, effective_from, notes, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, indicator_id, version, target_value, effective_from::text as effective_from, notes, created_by, created_at::text as created_at`,
    [id, indicatorId, nextVer, targetVal, effectiveFrom, notes, createdBy]
  );

  const r = insertRes.rows[0];
  return {
    id: String(r.id),
    indicator_id: String(r.indicator_id),
    version: Number(r.version),
    target_value: Number(r.target_value),
    effective_from: String(r.effective_from).slice(0, 10),
    notes: String(r.notes || ''),
    created_by: String(r.created_by),
    created_at: String(r.created_at),
  };
}

