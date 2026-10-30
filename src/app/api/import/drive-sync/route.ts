import { NextResponse } from 'next/server';
import { ingestInputData } from '@/lib/ingestInputData';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetFile = body.filePath || path.join(process.cwd(), 'data', 'input_data.xlsx');

    if (!fs.existsSync(targetFile)) {
      return NextResponse.json({
        success: false,
        error: `File ${targetFile} tidak ditemukan. Pastikan file input_data.xlsx dari akun regdashr@gmail.com tersedia.`
      }, { status: 404 });
    }

    const stats = ingestInputData(targetFile);

    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi file input_data.xlsx dari akun My Drive regdashr@gmail.com berhasil diproses!',
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
