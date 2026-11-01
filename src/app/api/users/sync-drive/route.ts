import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import {
  exportUsersToSpreadsheet,
  importUsersFromSpreadsheet,
  findLatestMasterUserSpreadsheet,
  getMasterUserSpreadsheetPath,
  DRIVE_ACCOUNT,
  MASTER_USER_FILE
} from '@/lib/userPicSync';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Check if multipart form data (user uploaded custom file)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'File Excel tidak ditemukan dalam request.' },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = importUsersFromSpreadsheet(buffer);

      return NextResponse.json({
        success: true,
        direction: 'pull',
        message: `Berhasil mengimpor spreadsheet "${file.name}": ${result.createdCount} PIC baru ditambahkan, ${result.updatedCount} PIC diperbarui. Total ${result.users.length} akun aktif tersinkron ke My Drive.`,
        account: DRIVE_ACCOUNT,
        fileName: file.name,
        totalUsers: result.users.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        syncedAt: new Date().toISOString(),
      });
    }

    // JSON payload or plain request
    let action = 'push';
    try {
      const body = await req.json();
      if (body && (body.action || body.direction)) {
        action = (body.action || body.direction).toLowerCase();
      }
    } catch {}

    if (action === 'pull' || action === 'import' || action === 'ambil') {
      // Pull data from spreadsheet (Downloads or data folder)
      const result = importUsersFromSpreadsheet();

      return NextResponse.json({
        success: true,
        direction: 'pull',
        message: `Berhasil mengambil data dari Spreadsheet My Drive (${result.sourceType === 'downloads' ? 'folder Downloads' : 'data internal'}): ${result.createdCount} PIC baru ditambahkan, ${result.updatedCount} PIC diperbarui. Total ${result.users.length} PIC siap digunakan.`,
        account: DRIVE_ACCOUNT,
        fileName: MASTER_USER_FILE,
        source: result.sourcePath,
        sourceType: result.sourceType,
        totalUsers: result.users.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        syncedAt: new Date().toISOString(),
      });
    } else {
      // Default: Push data to spreadsheet (My Drive)
      const users = dbQueries.getUsers();
      const filePath = exportUsersToSpreadsheet(users);
      const stat = fs.statSync(filePath);

      return NextResponse.json({
        success: true,
        direction: 'push',
        message: `Master Data PIC (${users.length} akun) berhasil diekspor dan disinkronkan ke Spreadsheet My Drive (${DRIVE_ACCOUNT}) di folder Downloads & data!`,
        account: DRIVE_ACCOUNT,
        fileName: MASTER_USER_FILE,
        totalUsers: users.length,
        fileSizeKb: Math.round(stat.size / 1024),
        syncedAt: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const filePath = getMasterUserSpreadsheetPath();
    const exists = fs.existsSync(filePath);

    let stats = null;
    if (exists) {
      const s = fs.statSync(filePath);
      stats = {
        sizeBytes: s.size,
        sizeKb: Math.round(s.size / 1024),
        lastModified: s.mtime.toISOString(),
      };
    }

    const latest = findLatestMasterUserSpreadsheet();

    return NextResponse.json({
      success: true,
      account: DRIVE_ACCOUNT,
      fileName: MASTER_USER_FILE,
      exists,
      stats,
      latestSource: latest?.source,
      latestModified: latest?.mtime.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
