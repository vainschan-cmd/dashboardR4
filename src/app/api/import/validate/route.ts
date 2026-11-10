import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import path from 'path';
import { validateSpreadsheetRows } from '@/lib/validator';
import { requireAuth, validateDepartmentWriteAccess } from '@/lib/rbac';
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_IMPORT_JSON_BYTES,
  MAX_IMPORT_ROWS,
  ALLOWED_SPREADSHEET_EXTENSIONS,
  importValidateJsonSchema,
  parseWithSchema,
} from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    const contentLength = Number(req.headers.get('content-length') || 0);

    let rows: Array<Record<string, unknown>> = [];
    let filename = 'spreadsheet.xlsx';
    let sourceType: 'upload_xlsx' | 'upload_csv' = 'upload_xlsx';
    let departmentId: string | undefined = undefined;
    const uploader = auth.session.nipp || 'pic_user';

    if (contentType.includes('multipart/form-data')) {
      if (contentLength > MAX_UPLOAD_FILE_BYTES + 65536) {
        return NextResponse.json(
          {
            success: false,
            message: 'Ukuran permintaan unggahan melebihi batas maksimal 5 MB.',
            error: 'Ukuran permintaan unggahan melebihi batas maksimal 5 MB.',
          },
          { status: 413 }
        );
      }

      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, message: 'Berkas unggahan tidak ditemukan.', error: 'Berkas unggahan tidak ditemukan.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: `Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB.`,
            error: `Ukuran berkas melebihi batas maksimal 5 MB.`,
          },
          { status: 413 }
        );
      }

      filename = file.name;
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_SPREADSHEET_EXTENSIONS.includes(ext as (typeof ALLOWED_SPREADSHEET_EXTENSIONS)[number])) {
        return NextResponse.json(
          {
            success: false,
            message: `Format berkas "${ext}" tidak didukung. Gunakan format .xlsx, .xls, atau .csv.`,
            error: `Format berkas "${ext}" tidak didukung.`,
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
      rows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;
    } else {
      if (contentLength > MAX_IMPORT_JSON_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: 'Ukuran payload JSON melebihi batas maksimum 2 MB.',
            error: 'Ukuran payload JSON melebihi batas maksimum 2 MB.',
          },
          { status: 413 }
        );
      }

      const rawText = await req.text();
      if (Buffer.byteLength(rawText, 'utf8') > MAX_IMPORT_JSON_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: 'Ukuran payload JSON melebihi batas maksimum 2 MB.',
            error: 'Ukuran payload JSON melebihi batas maksimum 2 MB.',
          },
          { status: 413 }
        );
      }

      let rawBody: unknown;
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        return NextResponse.json(
          { success: false, message: 'Format JSON tidak valid.', error: 'Format JSON tidak valid.' },
          { status: 400 }
        );
      }

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
          error: 'Berkas atau data kosong.',
        },
        { status: 400 }
      );
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          message: `Jumlah baris (${rows.length}) melebihi batas maksimum ${MAX_IMPORT_ROWS} baris per impor.`,
          error: `Jumlah baris melebihi batas maksimum ${MAX_IMPORT_ROWS} baris.`,
        },
        { status: 413 }
      );
    }

    const deptScope = validateDepartmentWriteAccess(auth.session, departmentId);
    if (!deptScope.allowed) {
      return NextResponse.json(
        { success: false, message: deptScope.error, error: deptScope.error },
        { status: 403 }
      );
    }

    const batchId = `batch_${Date.now()}`;
    const validation = validateSpreadsheetRows(rows, {
      departmentId: deptScope.effectiveDepartmentId || departmentId,
      uploaderUsername: uploader,
      sourceType,
      batchId,
      session: auth.session,
    });

    return NextResponse.json({
      success: true,
      filename,
      batchId,
      validation,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kesalahan internal server.';
    return NextResponse.json(
      { success: false, message: `Gagal memvalidasi spreadsheet: ${message}`, error: message },
      { status: 500 }
    );
  }
}
