import { dbQueries } from './db';
import type { JwtSessionPayload } from './auth';
import { validateBranchWriteAccess, validateDepartmentWriteAccess } from './rbac';
import type { ImportBatch, MonthlyRecord, StatusColor } from './types';
import type { ValidatedImportCommitRecord } from './validation';
import { MAX_IMPORT_ROWS } from './validation';

export interface CommitImportResult {
  success: true;
  batchId: string;
  savedCount: number;
  message: string;
}

export interface CommitImportError {
  success: false;
  status: number;
  error: string;
}

/**
 * Business & transactional storage service for committing validated import records.
 * Enforces ABAC (branch & department scope), master indicator integrity, server-side
 * achievement calculation, and atomic SQLite transaction across records + batch + audit log.
 */
export function commitValidatedImportRecords(params: {
  session: JwtSessionPayload;
  clientIp: string;
  batchId?: string;
  filename?: string;
  sourceType?: 'upload_xlsx' | 'upload_csv' | 'google_sheets' | 'manual_input';
  records: ValidatedImportCommitRecord[];
}): CommitImportResult | CommitImportError {
  const { session, clientIp, batchId, filename, sourceType, records } = params;

  if (!records || records.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'Tidak ada data valid untuk disimpan.',
    };
  }

  if (records.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      status: 413,
      error: `Jumlah baris (${records.length}) melebihi batas maksimum ${MAX_IMPORT_ROWS} baris per operasi impor.`,
    };
  }

  const branches = dbQueries.getBranches();
  const branchMapById = new Map(branches.map(b => [b.id, b]));
  const branchMapByCode = new Map(branches.map(b => [b.code.toUpperCase(), b]));

  const departments = dbQueries.getDepartments();
  const deptMapById = new Map(departments.map(d => [d.id, d]));

  const indicators = dbQueries.getIndicators();
  const indicatorMapById = new Map(indicators.map(i => [i.id, i]));

  const nowIso = new Date().toISOString();
  const resolvedBatchId = batchId || `batch_${Date.now()}`;
  const resolvedSourceType: ImportBatch['source_type'] =
    sourceType === 'upload_csv' || sourceType === 'google_sheets'
      ? sourceType
      : 'upload_xlsx';

  const sanitizedRecords: Array<
    Omit<
      MonthlyRecord,
      'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'
    >
  > = [];

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];

    // 1. Enforce Branch Write Scope (ABAC)
    const branchCheck = validateBranchWriteAccess(session, r.branch_id);
    if (!branchCheck.allowed) {
      return {
        success: false,
        status: 403,
        error: branchCheck.error || 'Akses cabang ditolak.',
      };
    }

    const matchedBranch =
      branchMapById.get(branchCheck.branchId) ||
      branchMapByCode.get(branchCheck.canonicalCode.toUpperCase()) ||
      branchMapById.get(r.branch_id);

    if (!matchedBranch) {
      return {
        success: false,
        status: 400,
        error: `Baris #${idx + 1}: Cabang "${r.branch_id}" tidak ditemukan pada Master Cabang.`,
      };
    }

    // 2. Enforce Department Write Scope (ABAC)
    const deptCheck = validateDepartmentWriteAccess(session, r.department_id);
    if (!deptCheck.allowed) {
      return {
        success: false,
        status: 403,
        error: deptCheck.error || 'Akses departemen ditolak.',
      };
    }

    const effectiveDeptId = deptCheck.effectiveDepartmentId || r.department_id;
    const matchedDept = deptMapById.get(effectiveDeptId);
    if (!matchedDept) {
      return {
        success: false,
        status: 400,
        error: `Baris #${idx + 1}: Departemen "${effectiveDeptId}" tidak ditemukan pada Master Departemen.`,
      };
    }

    // 3. Validate Indicator existence & compute server-authoritative achievement/status
    const matchedIndicator = indicatorMapById.get(r.indicator_id);
    if (!matchedIndicator) {
      return {
        success: false,
        status: 400,
        error: `Baris #${idx + 1}: Indikator "${r.indicator_id}" tidak ditemukan pada Master Indikator KPI.`,
      };
    }

    const targetNum = Number(r.target);
    const realNum = Number(r.realization);
    let achievementPct = 100;
    let statusColor: StatusColor = 'green';

    if (matchedIndicator.direction === 'higher_is_better') {
      achievementPct = targetNum > 0 ? Number(((realNum / targetNum) * 100).toFixed(1)) : 100;
      statusColor = achievementPct >= 100 ? 'green' : achievementPct >= 85 ? 'yellow' : 'red';
    } else {
      if (targetNum === 0) {
        achievementPct = realNum === 0 ? 100 : 0;
        statusColor = realNum === 0 ? 'green' : 'red';
      } else {
        achievementPct = Number((100 + ((targetNum - realNum) / targetNum) * 100).toFixed(1));
        statusColor = realNum <= targetNum ? 'green' : realNum <= targetNum * 1.2 ? 'yellow' : 'red';
      }
    }

    const recordId =
      r.id && r.id.trim().length > 0
        ? r.id.trim()
        : `rec_imp_${r.year}_${r.month}_${matchedBranch.code}_${matchedIndicator.code}_${Date.now()}_${idx}`.toLowerCase();

    sanitizedRecords.push({
      id: recordId,
      branch_id: matchedBranch.id,
      department_id: matchedDept.id,
      indicator_id: matchedIndicator.id,
      month: r.month,
      year: r.year,
      target: targetNum,
      realization: realNum,
      unit: r.unit || matchedIndicator.unit,
      achievement_pct: achievementPct,
      status_color: statusColor,
      notes: r.notes || 'Diimpor melalui spreadsheet',
      source_type: resolvedSourceType,
      batch_id: resolvedBatchId,
      verification_status: 'pending_verification',
      revision_notes: null,
      uploaded_by: session.nipp,
      uploaded_at: nowIso,
      verified_by: null,
      verified_at: null,
      is_simulated: Boolean(r.is_simulated),
    });
  }

  const firstRec = sanitizedRecords[0];
  const month = Number(firstRec.month) || 1;
  const year = Number(firstRec.year) || 2026;

  const importBatch: ImportBatch = {
    id: resolvedBatchId,
    filename_or_url: filename || 'Upload Spreadsheet',
    source_type: resolvedSourceType,
    department_id: firstRec.department_id || null,
    branch_id: firstRec.branch_id || null,
    period_month: month,
    period_year: year,
    total_rows: sanitizedRecords.length,
    valid_rows: sanitizedRecords.length,
    error_rows: 0,
    status: 'completed',
    uploaded_by: session.nipp,
    uploaded_at: nowIso,
    error_log: null,
  };

  // Atomic commit: records + batch metadata + audit log in a single transaction
  dbQueries.commitImportTransaction({
    records: sanitizedRecords,
    batch: importBatch,
    auditLog: {
      user_id: session.sub,
      user_name: session.name,
      user_role: session.role,
      action: 'IMPORT',
      entity: 'MONTHLY_RECORD',
      entity_id: importBatch.id,
      details: `Mengimpor dan menyimpan ${sanitizedRecords.length} data kinerja bulanan untuk periode ${month}/${year} oleh ${session.name} (NIPP: ${session.nipp}). Status awal: Menunggu Verifikasi.`,
      ip_address: clientIp,
    },
  });

  return {
    success: true,
    batchId: importBatch.id,
    savedCount: sanitizedRecords.length,
    message: `Data kinerja sebanyak ${sanitizedRecords.length} baris telah disimpan dengan status Menunggu Verifikasi.`,
  };
}

