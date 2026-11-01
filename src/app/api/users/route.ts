import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { exportUsersToSpreadsheet, getMasterUserSpreadsheetPath, DRIVE_ACCOUNT } from '@/lib/userPicSync';
import fs from 'fs';

export async function GET() {
  try {
    const users = dbQueries.getUsers();
    const filePath = getMasterUserSpreadsheetPath();
    const exists = fs.existsSync(filePath);

    let fileStats = null;
    if (exists) {
      const s = fs.statSync(filePath);
      fileStats = {
        fileName: 'master_user_pic.xlsx',
        sizeBytes: s.size,
        sizeKb: Math.round(s.size / 1024),
        lastModified: s.mtime.toISOString(),
        driveAccount: DRIVE_ACCOUNT,
      };
    }

    return NextResponse.json({
      success: true,
      users,
      total: users.length,
      spreadsheet: fileStats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, nipp, divisi, departemen, password, role, branch_id, department_id, email } = body;

    if (!name || !nipp || !divisi || !departemen) {
      return NextResponse.json(
        { success: false, error: 'Kolom Nama, NIPP, Divisi, dan Departemen wajib diisi!' },
        { status: 400 }
      );
    }

    const cleanNipp = String(nipp).trim();

    // Check if NIPP already exists
    const existing = dbQueries.getUserByNipp(cleanNipp);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `NIPP ${cleanNipp} sudah terdaftar atas nama ${existing.name}. Silakan gunakan NIPP lain atau login.` },
        { status: 409 }
      );
    }

    const newUser = dbQueries.createUser({
      name: String(name).trim(),
      nipp: cleanNipp,
      divisi: String(divisi).trim(),
      departemen: String(departemen).trim(),
      password: password || 'password123',
      role: role || 'pic_cabang',
      branch_id: branch_id || null,
      department_id: department_id || null,
      email: email || `${cleanNipp}@pelindo.co.id`,
    });

    return NextResponse.json({
      success: true,
      message: `User PIC ${newUser.name} (NIPP: ${newUser.nipp}) berhasil didaftarkan dan tersinkron ke Spreadsheet My Drive!`,
      user: {
        id: newUser.id,
        username: newUser.username,
        nipp: newUser.nipp,
        name: newUser.name,
        email: newUser.email,
        divisi: newUser.divisi,
        departemen: newUser.departemen,
        role: newUser.role,
        branch_id: newUser.branch_id,
        created_at: newUser.created_at,
      },
      driveAccount: DRIVE_ACCOUNT,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, nipp, divisi, departemen, password, role, branch_id, department_id, email, active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID wajib disertakan.' },
        { status: 400 }
      );
    }

    if (!name || !divisi || !departemen) {
      return NextResponse.json(
        { success: false, error: 'Kolom Nama, Divisi, dan Departemen wajib diisi!' },
        { status: 400 }
      );
    }

    // If NIPP is changed, verify it doesn't conflict with another user
    if (nipp) {
      const cleanNipp = String(nipp).trim();
      const existing = dbQueries.getUserByNipp(cleanNipp);
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { success: false, error: `NIPP ${cleanNipp} sudah digunakan oleh ${existing.name}.` },
          { status: 409 }
        );
      }
    }

    const updated = dbQueries.updateUser(id, {
      name: String(name).trim(),
      nipp: nipp ? String(nipp).trim() : undefined,
      divisi: String(divisi).trim(),
      departemen: String(departemen).trim(),
      role: role || undefined,
      branch_id: branch_id || null,
      department_id: department_id || null,
      email: email ? String(email).trim() : undefined,
      active: active !== undefined ? Boolean(active) : undefined,
      password: password && String(password).trim().length > 0 ? String(password).trim() : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'User PIC tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Data PIC ${updated.name} (NIPP: ${updated.nipp}) berhasil diperbarui dan disinkronkan ke Spreadsheet My Drive!`,
      user: updated,
      driveAccount: DRIVE_ACCOUNT,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID diperlukan' },
        { status: 400 }
      );
    }

    dbQueries.deleteUser(id);
    return NextResponse.json({
      success: true,
      message: 'User berhasil dihapus dan spreadsheet diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

