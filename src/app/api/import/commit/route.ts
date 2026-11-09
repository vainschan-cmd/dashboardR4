import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import {
  requireAuth,
  validateBranchWriteAccess,
  validateDepartmentWriteAccess,
} from '@/lib/rbac';
import { ImportBatch } from '@/lib/types';
import { importCommitSchema, parseWithSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = parseWithSchema(importCommitSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error, error: parsed.error },
        { status: 400 }
      );
    }
    const { batchId, filename, records, sourceType } = parsed.data;

    // Validate Branch & Department Scope (ABAC) for every record in the batch
    const sanitizedRecords: any[] = [];
    for (const r of records as any[]) {
      const branchCheck = validateBranchWriteAccess(auth.session, r.branch_id);
      if (!branchCheck.allowed) {
        return NextResponse.json(
          { success: false, message: branchCheck.error, error: branchCheck.error },
          { status: 403 }
        );
      }

      const deptCheck = validateDepartmentWriteAccess(auth.session, r.department_id);
      if (!deptCheck.allowed) {
        return NextResponse.json(
          { success: false, message: deptCheck.error, error: deptCheck.error },
          { status: 403 }
        );
      }

      sanitizedRecords.push({
        ...r,
        branch_id: branchCheck.branchId || r.branch_id,
        department_id: deptCheck.effectiveDepartmentId || r.department_id,
        verification_status: 'pending_verification' as const,
        uploaded_by: auth.session.nipp,
        uploaded_at: new Date().toISOString(),
        verified_by: null,
        verified_at: null,
      });
    }

    const firstRec = sanitizedRecords[0];
    const month = Number(firstRec.month) || 1;
    const year = Number(firstRec.year) || 2026;
    const departmentId = firstRec.department_id || null;
    const branchId = firstRec.branch_id || null;

    // 1. Insert records to database
    dbQueries.insertMonthlyRecords(sanitizedRecords);

    // 2. Log batch
    const resolvedSourceType: ImportBatch['source_type'] =
      sourceType === 'upload_csv' || sourceType === 'google_sheets'
        ? sourceType
        : 'upload_xlsx';
    const importBatch: ImportBatch = {
      id: batchId || `batch_${Date.now()}`,
      filename_or_url: filename || 'Upload Spreadsheet',
      source_type: resolvedSourceType,
      department_id: departmentId,
      branch_id: branchId,
      period_month: month,
      period_year: year,
      total_rows: sanitizedRecords.length,
      valid_rows: sanitizedRecords.length,
      error_rows: 0,
      status: 'completed',
      uploaded_by: auth.session.nipp,
      uploaded_at: new Date().toISOString(),
      error_log: null,
    };
    dbQueries.createImportBatch(importBatch);

    // 3. Log Audit Trail using verified JWT identity
    dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'IMPORT',
      entity: 'MONTHLY_RECORD',
      entity_id: importBatch.id,
      details: `Mengimpor dan menyimpan ${sanitizedRecords.length} data kinerja bulanan untuk periode ${month}/${year} oleh ${auth.session.name} (NIPP: ${auth.session.nipp}). Status awal: Menunggu Verifikasi.`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Data kinerja sebanyak ${sanitizedRecords.length} baris telah disimpan dengan status Menunggu Verifikasi.`,
      batchId: importBatch.id,
      savedCount: sanitizedRecords.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Gagal menyimpan data: ${error.message}` },
      { status: 500 }
    );
  }
}
