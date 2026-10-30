import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { MonthlyRecord, ImportBatch } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, filename, records, sourceType, uploader, userRole } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, message: 'Tidak ada data valid untuk disimpan.' }, { status: 400 });
    }

    const firstRec = records[0];
    const month = firstRec.month || 1;
    const year = firstRec.year || 2026;
    const departmentId = firstRec.department_id || null;
    const branchId = firstRec.branch_id || null;

    // 1. Insert records to database
    dbQueries.insertMonthlyRecords(records);

    // 2. Log batch
    const importBatch: ImportBatch = {
      id: batchId || `batch_${Date.now()}`,
      filename_or_url: filename || 'Upload Spreadsheet',
      source_type: sourceType || 'upload_xlsx',
      department_id: departmentId,
      branch_id: branchId,
      period_month: month,
      period_year: year,
      total_rows: records.length,
      valid_rows: records.length,
      error_rows: 0,
      status: 'completed',
      uploaded_by: uploader || 'user',
      uploaded_at: new Date().toISOString(),
      error_log: null
    };
    dbQueries.createImportBatch(importBatch);

    // 3. Log Audit Trail
    dbQueries.createAuditLog({
      user_id: uploader || 'usr_unknown',
      user_name: uploader || 'Pengguna',
      user_role: userRole || 'pic_cabang',
      action: 'IMPORT',
      entity: 'MONTHLY_RECORD',
      entity_id: importBatch.id,
      details: `Berhasil mengimpor dan menyimpan ${records.length} data kinerja bulanan untuk periode ${month}/${year}. Status awal: Menunggu Verifikasi.`
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan ${records.length} data kinerja. Data saat ini berstatus 'Menunggu Verifikasi'.`,
      batchId: importBatch.id,
      savedCount: records.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Gagal menyimpan data: ${error.message}` },
      { status: 500 }
    );
  }
}
