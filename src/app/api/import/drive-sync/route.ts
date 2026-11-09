import { NextRequest, NextResponse } from 'next/server';
import { ingestInputData } from '@/lib/ingestInputData';
import { sanitizeSafeDataFilePath } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { safeRelativePath, resolvedAbsolutePath: targetFile } = sanitizeSafeDataFilePath(
      body.filePath,
      'input_data.xlsx',
      ['.xlsx', '.xls', '.csv']
    );

    if (!fs.existsSync(targetFile)) {
      return NextResponse.json({
        success: false,
        error: `File ${safeRelativePath} tidak ditemukan. Pastikan file input_data.xlsx tersedia di direktori data.`
      }, { status: 404 });
    }

    const stats = ingestInputData(targetFile);

    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi data dari file input_data.xlsx telah selesai diproses.',
      stats,
      account: 'regdashr@gmail.com',
      syncedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in /api/import/drive-sync:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal melakukan sinkronisasi file drive.'
    }, { status: 500 });
  }
}

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'input_data.xlsx');
  const exists = fs.existsSync(filePath);
  let fileStats = null;
  if (exists) {
    const s = fs.statSync(filePath);
    fileStats = {
      sizeBytes: s.size,
      sizeKb: Math.round(s.size / 1024),
      lastModified: s.mtime.toISOString()
    };
  }

  return NextResponse.json({
    success: true,
    account: 'regdashr@gmail.com',
    fileName: 'input_data.xlsx',
    exists,
    fileStats
  });
}
