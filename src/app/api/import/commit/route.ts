import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { MAX_IMPORT_JSON_BYTES, importCommitSchema, parseWithSchema } from '@/lib/validation';
import { commitValidatedImportRecords } from '@/lib/importService';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_IMPORT_JSON_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ukuran permintaan impor melebihi batas maksimum 2 MB.',
          error: 'Ukuran permintaan impor melebihi batas maksimum 2 MB.',
        },
        { status: 413 }
      );
    }

    const rawText = await req.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_IMPORT_JSON_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ukuran permintaan impor melebihi batas maksimum 2 MB.',
          error: 'Ukuran permintaan impor melebihi batas maksimum 2 MB.',
        },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Format JSON tidak valid.', error: 'Format JSON tidak valid.' },
        { status: 400 }
      );
    }

    const parsed = parseWithSchema(importCommitSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error, error: parsed.error },
        { status: 400 }
      );
    }

    const result = commitValidatedImportRecords({
      session: auth.session,
      clientIp: getClientIp(req),
      batchId: parsed.data.batchId,
      filename: parsed.data.filename,
      sourceType: parsed.data.sourceType,
      records: parsed.data.records,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      batchId: result.batchId,
      savedCount: result.savedCount,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      unchangedCount: result.unchangedCount,
      revertedVerifiedCount: result.revertedVerifiedCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kesalahan internal server.';
    return NextResponse.json(
      { success: false, message: `Gagal menyimpan data: ${message}`, error: message },
      { status: 500 }
    );
  }
}
