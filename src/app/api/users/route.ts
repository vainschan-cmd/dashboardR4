import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import { getSessionFromRequest, issueSessionCookies, getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { getMasterUserSpreadsheetPath, DRIVE_ACCOUNT } from '@/lib/userPicSync';
import { createUserSchema, updateUserSchema, parseWithSchema } from '@/lib/validation';
import type { UserRole } from '@/lib/types';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const users = (await dbQueries.getUsers()).map(toSafeUser);
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
    const parsed = parseWithSchema(createUserSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }
    const { name, nipp, divisi, departemen, password, role, branch_id, department_id, email } = parsed.data;

    const cleanNipp = String(nipp).trim();

    // Check if NIPP already exists
    const existing = await dbQueries.getUserByNipp(cleanNipp);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `NIPP ${cleanNipp} sudah terdaftar. Silakan gunakan NIPP lain atau masuk menggunakan akun yang sudah ada.` },
        { status: 409 }
      );
    }

    const session = await getSessionFromRequest(req);
    const isAdminSession = session && (session.role === 'super_admin' || session.role === 'admin_regional');
    // Prevent privilege escalation on public self-registration: only admins can assign elevated roles
    const allowedRoles: UserRole[] = ['super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang', 'viewer'];
    const effectiveRole: UserRole =
      isAdminSession && role && allowedRoles.includes(role)
        ? role
        : 'pic_cabang';

    const newUser = await dbQueries.createUser({
      name: String(name).trim(),
      nipp: cleanNipp,
      divisi: String(divisi).trim(),
      departemen: String(departemen).trim(),
      password: password || 'password123',
      role: effectiveRole,
      branch_id: branch_id || null,
      department_id: department_id || null,
      email: email || `${cleanNipp}@pelindo.co.id`,
    });

    const safeUser = toSafeUser(newUser);
    const clientIp = getClientIp(req);

    try {
      await dbQueries.createAuditLog({
        user_id: session?.sub || safeUser.id,
        user_name: session?.name || safeUser.name,
        user_role: session?.role || safeUser.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: safeUser.nipp,
        details: `Pendaftaran akun baru PIC ${safeUser.name} (NIPP: ${safeUser.nipp}, Role: ${safeUser.role}, Cabang: ${safeUser.branch_id || 'R99'}).`,
        ip_address: clientIp,
      });
    } catch {}

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

    // If self-registering (not logged in as admin), issue JWT session cookies for the new user
    if (!session) {
      const systemParams = await dbQueries.getSystemParameters();
      await issueSessionCookies(response, safeUser, systemParams.session_timeout_minutes || 30);
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
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

    // If NIPP is changed, verify it doesn't conflict with another user
    if (nipp) {
      const cleanNipp = String(nipp).trim();
      const existing = await dbQueries.getUserByNipp(cleanNipp);
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { success: false, error: `NIPP ${cleanNipp} sudah digunakan oleh ${existing.name}.` },
          { status: 409 }
        );
      }
    }

    const updated = await dbQueries.updateUser(id, {
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

    const safeUpdated = toSafeUser(updated);

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: safeUpdated.nipp,
        details: `Pembaruan akun PIC ${safeUpdated.name} (NIPP: ${safeUpdated.nipp}, Role: ${safeUpdated.role}, Cabang: ${safeUpdated.branch_id || 'R99'}, Status: ${safeUpdated.active ? 'Aktif' : 'Nonaktif'}).`,
        ip_address: getClientIp(req),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Data PIC ${safeUpdated.name} (NIPP: ${safeUpdated.nipp}) telah diperbarui dan disinkronkan ke master_user_pic.xlsx.`,
      user: safeUpdated,
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
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
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

    const targetUser = await dbQueries.getUserById(id);
    if (targetUser?.role === 'super_admin' && auth.session.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat menghapus akun Super Admin.' },
        { status: 403 }
      );
    }

    await dbQueries.deleteUser(id);

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: targetUser?.nipp || id,
        details: `Penghapusan akun PIC ${targetUser?.name || id} (NIPP: ${targetUser?.nipp || '-'}).`,
        ip_address: getClientIp(req),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'User berhasil dihapus dan file master_user_pic.xlsx telah diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
