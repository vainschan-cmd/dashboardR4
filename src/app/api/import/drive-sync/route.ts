import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ingestInputData } from '@/lib/ingestInputData';
import { dbQueries, sanitizeSafeDataFilePath } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { driveSyncSchema, parseWithSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = parseWithSchema(driveSyncSchema, rawBody);
    const customPath = parsed.success ? parsed.data.customPath : undefined;
    const rawFilePath =
      customPath ||
      (typeof (rawBody as Record<string, unknown>)?.filePath === 'string'
        ? String((rawBody as Record<string, unknown>).filePath)
        : undefined);

    const { safeRelativePath, resolvedAbsolutePath: targetFile } = sanitizeSafeDataFilePath(
      rawFilePath,
      'input_data.xlsx',
      ['.xlsx', '.xls', '.csv']
    );

    if (!fs.existsSync(targetFile)) {
      return NextResponse.json(
        {
          success: false,
          error: `File ${safeRelativePath} tidak ditemukan. Pastikan file input_data.xlsx tersedia di direktori data.`,
        },
        { status: 404 }
      );
    }

    const stats = await ingestInputData(targetFile);

    try {
      dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'IMPORT',
        entity: 'GOOGLE_DRIVE_FILE',
        entity_id: safeRelativePath,
        details: `Sinkronisasi data dari file ${safeRelativePath} oleh ${auth.session.name} (NIPP: ${auth.session.nipp}).`,
        ip_address: getClientIp(req),
      });
    } catch {
      // ignore non-fatal audit error
    }

    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi data dari file input_data.xlsx telah selesai diproses.',
      stats,
      account: 'regdashr@gmail.com',
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal melakukan sinkronisasi file drive.';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  const filePath = path.join(process.cwd(), 'data', 'input_data.xlsx');
  const exists = fs.existsSync(filePath);
  let fileStats = null;
  if (exists) {
    const s = fs.statSync(filePath);
    fileStats = {
      sizeBytes: s.size,
      sizeKb: Math.round(s.size / 1024),
      lastModified: s.mtime.toISOString(),
    };
  }

  return NextResponse.json({
    success: true,
    account: 'regdashr@gmail.com',
    fileName: 'input_data.xlsx',
    exists,
    fileStats,
  });
}
