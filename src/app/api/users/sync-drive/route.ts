import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { dbQueries, toSafeUser } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';
import { MAX_UPLOAD_FILE_BYTES, userSyncDriveSchema, parseWithSchema } from '@/lib/validation';
import {
  exportUsersToSpreadsheet,
  importUsersFromSpreadsheet,
  findLatestMasterUserSpreadsheet,
  getMasterUserSpreadsheetPath,
  DRIVE_ACCOUNT,
  MASTER_USER_FILE,
} from '@/lib/userPicSync';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

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
      if (file.size > MAX_UPLOAD_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Ukuran berkas Excel melebihi batas maksimum 5 MB.' },
          { status: 413 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await importUsersFromSpreadsheet(buffer, {
        actorRole: auth.session.role,
        actorNipp: auth.session.nipp,
      });

      return NextResponse.json({
        success: true,
        direction: 'pull',
        message: `Berhasil mengimpor spreadsheet "${file.name}": ${result.createdCount} PIC baru ditambahkan, ${result.updatedCount} PIC diperbarui${result.rejectedCount > 0 ? `, ${result.rejectedCount} baris ditolak` : ''}. Total ${result.users.length} akun aktif tersinkron ke My Drive.`,
        account: DRIVE_ACCOUNT,
        fileName: file.name,
        totalUsers: result.users.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        rejectedCount: result.rejectedCount,
        rejected: result.rejected,
        syncedAt: new Date().toISOString(),
      });
    }

    // JSON payload or plain request
    let action = 'push';
    try {
      const rawBody = await req.json();
      const parsed = parseWithSchema(userSyncDriveSchema, rawBody ?? {});
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
      }
      action = parsed.data.action;
    } catch {
      // No JSON body at all: behave like a push (the documented default).
    }

    if (action === 'pull' || action === 'import' || action === 'ambil') {
      const result = await importUsersFromSpreadsheet(undefined, {
        actorRole: auth.session.role,
        actorNipp: auth.session.nipp,
      });

      return NextResponse.json({
        success: true,
        direction: 'pull',
        message: `Berhasil mengambil data dari Spreadsheet My Drive (${result.sourceType === 'downloads' ? 'folder Downloads' : 'data internal'}): ${result.createdCount} PIC baru ditambahkan, ${result.updatedCount} PIC diperbarui${result.rejectedCount > 0 ? `, ${result.rejectedCount} baris ditolak` : ''}. Total ${result.users.length} PIC siap digunakan.`,
        account: DRIVE_ACCOUNT,
        fileName: MASTER_USER_FILE,
        source: result.sourcePath,
        sourceType: result.sourceType,
        totalUsers: result.users.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        rejectedCount: result.rejectedCount,
        rejected: result.rejected,
        syncedAt: new Date().toISOString(),
      });
    } else {
      const rawUsers = await dbQueries.getUsers();
      const users = rawUsers.map(toSafeUser);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyinkronkan data pengguna.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memeriksa status berkas sinkronisasi.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
