import { NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { exportUsersToSpreadsheet, getMasterUserSpreadsheetPath, DRIVE_ACCOUNT, MASTER_USER_FILE } from '@/lib/userPicSync';
import fs from 'fs';

export async function POST() {
  try {
    const users = dbQueries.getUsers();
    const filePath = exportUsersToSpreadsheet(users);

    const stat = fs.statSync(filePath);

    return NextResponse.json({
      success: true,
      message: `Master Data PIC berhasil diekspor dan disinkronkan ke Spreadsheet My Drive (${DRIVE_ACCOUNT})!`,
      account: DRIVE_ACCOUNT,
      fileName: MASTER_USER_FILE,
      totalUsers: users.length,
      fileSizeKb: Math.round(stat.size / 1024),
      syncedAt: new Date().toISOString(),
    });
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

    return NextResponse.json({
      success: true,
      account: DRIVE_ACCOUNT,
      fileName: MASTER_USER_FILE,
      exists,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
