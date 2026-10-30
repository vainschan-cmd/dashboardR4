import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleSheetData } from '@/lib/googleSheetsAdapter';
import { validateSpreadsheetRows } from '@/lib/validator';
import { dbQueries } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spreadsheetUrl, sheetName, range, uploader, userRole } = body;

    if (!spreadsheetUrl) {
      return NextResponse.json({
        success: false,
        message: 'URL atau Spreadsheet ID wajib diisi.'
      }, { status: 400 });
    }

    const fetchResult = await fetchGoogleSheetData(
      spreadsheetUrl,
      sheetName || 'Input_Kinerja_Bulanan',
      range || 'A1:K100'
    );

    if (!fetchResult.success) {
      return NextResponse.json({
        success: false,
        message: fetchResult.message,
        spreadsheetId: fetchResult.spreadsheetId
      }, { status: 400 });
    }

    const batchId = `batch_gsheet_${Date.now()}`;
    const validation = validateSpreadsheetRows(fetchResult.data, {
      uploaderUsername: uploader || 'pic_gsheet',
      sourceType: 'google_sheets',
      batchId
    });

    // Update integration config
    const currentCfg = dbQueries.getGoogleSheetsConfig();
    currentCfg.spreadsheet_id = fetchResult.spreadsheetId;
    currentCfg.sheet_name = sheetName || currentCfg.sheet_name;
    currentCfg.last_sync_at = new Date().toISOString();
    dbQueries.saveGoogleSheetsConfig(currentCfg);

    // Audit log
    dbQueries.createAuditLog({
      user_id: uploader || 'usr_gsheet',
      user_name: uploader || 'Google Sheets Sync',
      user_role: userRole || 'pic_dept_regional',
      action: 'UPLOAD',
      entity: 'GOOGLE_SHEETS',
      entity_id: fetchResult.spreadsheetId,
      details: `Sinkronisasi Google Sheets ID ${fetchResult.spreadsheetId} (${fetchResult.data.length} baris dibaca).`
    });

    return NextResponse.json({
      success: true,
      message: fetchResult.message,
      isSimulatedAdapter: fetchResult.isSimulatedAdapter,
      spreadsheetId: fetchResult.spreadsheetId,
      batchId,
      validation
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Sinkronisasi Google Sheets gagal: ${error.message}` },
      { status: 500 }
    );
  }
}
