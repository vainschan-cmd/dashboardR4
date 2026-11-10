import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { dbQueries, toSafeUser } from '@/lib/db';
import { issueSessionCookies, getClientIp } from '@/lib/auth';
import {
  requireAuth,
  resolveRequestSession,
  hasPermission,
  resolveServerAssignedUserScope,
} from '@/lib/rbac';
import { getMasterUserSpreadsheetPath, DRIVE_ACCOUNT } from '@/lib/userPicSync';
import { createUserSchema, updateUserSchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:read' });
  if (!auth.authorized) return auth.response;

  try {
    const users = dbQueries.getUsers().map(toSafeUser);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar pengguna.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const allowPublicRegistration = process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
  const session = await resolveRequestSession(req);
  const canManageUsers = Boolean(session && hasPermission(session.role, 'users:manage'));

  if (!canManageUsers && !allowPublicRegistration) {
    const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
    if (!auth.authorized) return auth.response;
  }

  try {
    const body = await req.json();
    const parsed = parseWithSchema(createUserSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error, message: parsed.error },
        { status: 400 }
      );
    }
    const { name, nipp, divisi, departemen, password, role, branch_id, department_id, email } = parsed.data;
    const cleanNipp = String(nipp).trim();

    if (canManageUsers && role === 'super_admin' && session?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat membuat akun dengan role Super Admin.' },
        { status: 403 }
      );
    }

    // Check if NIPP already exists
    const existing = dbQueries.getUserByNipp(cleanNipp);
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `NIPP ${cleanNipp} sudah terdaftar. Silakan gunakan NIPP lain atau masuk menggunakan akun yang sudah ada.`,
        },
        { status: 409 }
      );
    }

    // Assign role, branch_id, and department_id strictly via server-side rules
    const assignedScope = resolveServerAssignedUserScope({
      role: canManageUsers ? role : 'pic_cabang',
      branch_id,
      department_id,
      divisi,
      departemen,
      isPublicSelfRegistration: !canManageUsers,
    });

    const newUser = dbQueries.createUser({
      name: String(name).trim(),
      nipp: cleanNipp,
      divisi: String(divisi).trim(),
      departemen: String(departemen).trim(),
      password: String(password).trim(),
      role: assignedScope.role,
      branch_id: assignedScope.branch_id,
      department_id: assignedScope.department_id,
      email: email || `${cleanNipp}@pelindo.co.id`,
    });

    const safeUser = toSafeUser(newUser);
    const clientIp = getClientIp(req);

    try {
      dbQueries.createAuditLog({
        user_id: session?.sub || safeUser.id,
        user_name: session?.name || safeUser.name,
        user_role: session?.role || safeUser.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: safeUser.nipp,
        details: `Pendaftaran akun baru PIC ${safeUser.name} (NIPP: ${safeUser.nipp}, Role: ${safeUser.role}, Cabang: ${safeUser.branch_id || 'R99'}, Dept: ${safeUser.department_id || '-'}).`,
        ip_address: clientIp,
      });
    } catch {
      // ignore non-fatal audit error
    }

    const response = NextResponse.json({
      success: true,
      message: `Akun PIC ${safeUser.name} (NIPP: ${safeUser.nipp}) telah didaftarkan dan disinkronkan ke master_user_pic.xlsx.`,
      user: {
        id: safeUser.id,
        username: safeUser.username,
        nipp: safeUser.nipp,
        name: safeUser.name,
        email: safeUser.email,
        divisi: safeUser.divisi,
        departemen: safeUser.departemen,
        role: safeUser.role,
        branch_id: safeUser.branch_id,
        department_id: safeUser.department_id,
        created_at: safeUser.created_at,
      },
      driveAccount: DRIVE_ACCOUNT,
    });

    if (!session && allowPublicRegistration) {
      const systemParams = dbQueries.getSystemParameters();
      await issueSessionCookies(response, safeUser, systemParams.session_timeout_minutes || 30);
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mendaftarkan pengguna baru.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = parseWithSchema(updateUserSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }
    const { id, name, nipp, divisi, departemen, password, role, branch_id, department_id, email, active } = parsed.data;

    // Only super_admin can promote or modify a user to super_admin
    if (role === 'super_admin' && auth.session.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat menetapkan role Super Admin.' },
        { status: 403 }
      );
    }

    const existingUser = dbQueries.getUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'User PIC tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (existingUser.role === 'super_admin' && auth.session.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat mengubah akun Super Admin.' },
        { status: 403 }
      );
    }

    // If NIPP is changed, verify it doesn't conflict with another user
    if (nipp) {
      const cleanNipp = String(nipp).trim();
      const existingByNipp = dbQueries.getUserByNipp(cleanNipp);
      if (existingByNipp && existingByNipp.id !== id) {
        return NextResponse.json(
          { success: false, error: `NIPP ${cleanNipp} sudah digunakan oleh ${existingByNipp.name}.` },
          { status: 409 }
        );
      }
    }

    const assignedScope = resolveServerAssignedUserScope({
      role: role || existingUser.role,
      branch_id: branch_id !== undefined ? branch_id : existingUser.branch_id,
      department_id: department_id !== undefined ? department_id : existingUser.department_id,
      divisi,
      departemen,
      isPublicSelfRegistration: false,
    });

    const updated = dbQueries.updateUser(id, {
      name: String(name).trim(),
      nipp: nipp ? String(nipp).trim() : undefined,
      divisi: String(divisi).trim(),
      departemen: String(departemen).trim(),
      role: assignedScope.role,
      branch_id: assignedScope.branch_id,
      department_id: assignedScope.department_id,
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

    const safeUpdated = toSafeUser(updated);

    try {
      dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: safeUpdated.nipp,
        details: `Pembaruan akun PIC ${safeUpdated.name} (NIPP: ${safeUpdated.nipp}, Role: ${safeUpdated.role}, Cabang: ${safeUpdated.branch_id || 'R99'}, Status: ${safeUpdated.active ? 'Aktif' : 'Nonaktif'}).`,
        ip_address: getClientIp(req),
      });
    } catch {
      // ignore non-fatal audit error
    }

    return NextResponse.json({
      success: true,
      message: `Data PIC ${safeUpdated.name} (NIPP: ${safeUpdated.nipp}) telah diperbarui dan disinkronkan ke master_user_pic.xlsx.`,
      user: safeUpdated,
      driveAccount: DRIVE_ACCOUNT,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui pengguna.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID diperlukan.' },
        { status: 400 }
      );
    }

    if (id === auth.session.sub) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak dapat menghapus akun yang sedang digunakan saat ini.' },
        { status: 400 }
      );
    }

    const targetUser = dbQueries.getUserById(id);
    if (targetUser?.role === 'super_admin' && auth.session.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat menghapus akun Super Admin.' },
        { status: 403 }
      );
    }

    dbQueries.deleteUser(id);

    try {
      dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: targetUser?.nipp || id,
        details: `Penghapusan akun PIC ${targetUser?.name || id} (NIPP: ${targetUser?.nipp || '-'}) oleh ${auth.session.name}.`,
        ip_address: getClientIp(req),
      });
    } catch {
      // ignore non-fatal audit error
    }

    return NextResponse.json({
      success: true,
      message: 'User PIC telah dihapus dan master_user_pic.xlsx telah diperbarui.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus pengguna.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
