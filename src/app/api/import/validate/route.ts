import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { validateSpreadsheetRows } from '@/lib/validator';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rows: Array<Record<string, any>> = [];
    let filename = 'spreadsheet.xlsx';
    let sourceType: 'upload_xlsx' | 'upload_csv' = 'upload_xlsx';
    let departmentId: string | undefined = undefined;
    let targetMonth: number | undefined = undefined;
    let targetYear: number | undefined = undefined;
    let uploader = 'pic_user';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, message: 'File tidak ditemukan' }, { status: 400 });
      }

      filename = file.name;
      sourceType = filename.endsWith('.csv') ? 'upload_csv' : 'upload_xlsx';
      departmentId = (formData.get('department_id') as string) || undefined;
      uploader = (formData.get('uploader') as string) || 'pic_user';

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, any>>;
    } else {
      const body = await req.json();
      rows = body.rows || [];
      filename = body.filename || 'input_data.json';
      sourceType = body.source_type || 'upload_xlsx';
      departmentId = body.department_id;
      uploader = body.uploader || 'pic_user';
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'File atau data kosong, tidak ada baris yang dapat dibaca.'
      }, { status: 400 });
    }

    const batchId = `batch_${Date.now()}`;
    const validation = validateSpreadsheetRows(rows, {
      departmentId,
      targetMonth,
      targetYear,
      uploaderUsername: uploader,
      sourceType,
      batchId
    });

    return NextResponse.json({
      success: true,
      filename,
      batchId,
      validation
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Gagal memvalidasi spreadsheet: ${error.message}` },
      { status: 500 }
    );
  }
}
