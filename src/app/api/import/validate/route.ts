import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import path from 'path';
import { validateSpreadsheetRows } from '@/lib/validator';
import { requireAuth } from '@/lib/rbac';
import {
  MAX_UPLOAD_FILE_BYTES,
  ALLOWED_SPREADSHEET_EXTENSIONS,
  importValidateJsonSchema,
  parseWithSchema,
} from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let rows: Array<Record<string, any>> = [];
    let filename = 'spreadsheet.xlsx';
    let sourceType: 'upload_xlsx' | 'upload_csv' = 'upload_xlsx';
    let departmentId: string | undefined = undefined;
    let targetMonth: number | undefined = undefined;
    let targetYear: number | undefined = undefined;
    let uploader = auth.session.nipp || 'pic_user';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, message: 'Berkas unggahan tidak ditemukan.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: `Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB.`,
          },
          { status: 413 }
        );
      }

      filename = file.name;
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_SPREADSHEET_EXTENSIONS.includes(ext as any)) {
        return NextResponse.json(
          {
            success: false,
            message: `Format berkas "${ext}" tidak didukung. Gunakan format .xlsx, .xls, atau .csv.`,
          },
          { status: 400 }
        );
      }

      sourceType = ext === '.csv' ? 'upload_csv' : 'upload_xlsx';
      departmentId = (formData.get('department_id') as string) || undefined;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, any>>;
    } else {
      const rawBody = await req.json();
      const parsed = parseWithSchema(importValidateJsonSchema, rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: parsed.error, error: parsed.error },
          { status: 400 }
        );
      }
      rows = parsed.data.rows;
      filename = parsed.data.filename || 'input_data.json';
      sourceType = parsed.data.source_type || 'upload_xlsx';
      departmentId = parsed.data.department_id;
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Berkas atau data kosong, tidak ada baris yang dapat dibaca.',
        },
        { status: 400 }
      );
    }

    const batchId = `batch_${Date.now()}`;
    const validation = validateSpreadsheetRows(rows, {
      departmentId,
      targetMonth,
      targetYear,
      uploaderUsername: uploader,
      sourceType,
      batchId,
    });

    return NextResponse.json({
      success: true,
      filename,
      batchId,
      validation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Gagal memvalidasi spreadsheet: ${error.message}` },
      { status: 500 }
    );
  }
}
