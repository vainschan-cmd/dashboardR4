import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleSheetData, validateGoogleSheetsTarget } from '@/lib/googleSheetsAdapter';
import { validateSpreadsheetRows } from '@/lib/validator';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth, enforceDepartmentFilterForRead } from '@/lib/rbac';
import { sheetsSyncSchema, parseWithSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const rawBody = await req.json();
    const parsed = parseWithSchema(sheetsSyncSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error, error: parsed.error },
        { status: 400 }
      );
    }

    const { spreadsheetUrl, spreadsheetId, sheetName, range } = parsed.data;
    const targetInput = spreadsheetUrl || spreadsheetId || '';

    if (!targetInput) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL atau Spreadsheet ID wajib diisi.',
          error: 'URL atau Spreadsheet ID wajib diisi.',
        },
        { status: 400 }
      );
    }

    const targetCheck = validateGoogleSheetsTarget(
      targetInput,
      sheetName || 'Input_Kinerja_Bulanan',
      range || 'A1:K100'
    );
    if (!targetCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          message: targetCheck.error,
          error: targetCheck.error,
        },
        { status: 400 }
      );
    }

    const fetchResult = await fetchGoogleSheetData(
      targetCheck.spreadsheetId,
      targetCheck.sheetName,
      targetCheck.range
    );

    if (!fetchResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: fetchResult.message,
          error: fetchResult.message,
          spreadsheetId: fetchResult.spreadsheetId,
        },
        { status: 400 }
      );
    }

    const batchId = `batch_gsheet_${Date.now()}`;
    const scopedDepartmentId = enforceDepartmentFilterForRead(auth.session, undefined);
    const validation = validateSpreadsheetRows(fetchResult.data, {
      departmentId: scopedDepartmentId,
      uploaderUsername: auth.session.nipp,
      sourceType: 'google_sheets',
      batchId,
      session: auth.session,
    });

    // Update integration config metadata
    const currentCfg = await dbQueries.getGoogleSheetsConfig();
    currentCfg.spreadsheet_id = fetchResult.spreadsheetId;
    currentCfg.sheet_name = targetCheck.sheetName || currentCfg.sheet_name;
    currentCfg.range = targetCheck.range || currentCfg.range;
    currentCfg.last_sync_at = new Date().toISOString();
    await dbQueries.saveGoogleSheetsConfig(currentCfg);

    // Audit log using verified server session identity
    await dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'UPLOAD',
      entity: 'GOOGLE_SHEETS',
      entity_id: fetchResult.spreadsheetId,
      details: `Sinkronisasi Google Sheets ID ${fetchResult.spreadsheetId} (${fetchResult.data.length} baris dibaca) oleh ${auth.session.name} (NIPP: ${auth.session.nipp}).`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: fetchResult.message,
      isSimulatedAdapter: fetchResult.isSimulatedAdapter,
      spreadsheetId: fetchResult.spreadsheetId,
      batchId,
      validation,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kesalahan internal server.';
    return NextResponse.json(
      { success: false, message: `Sinkronisasi Google Sheets gagal: ${message}`, error: message },
      { status: 500 }
    );
  }
}
