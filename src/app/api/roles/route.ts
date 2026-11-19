import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { rolesRepository, PERMISSION_GROUPS } from '@/lib/repositories/roles';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  try {
    const roles = await rolesRepository.getAllRolesWithCounts();
    return NextResponse.json({
      success: true,
      roles,
      groups: PERMISSION_GROUPS,
      total: roles.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data peran.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { id, name, description, scope, permissions } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Nama peran wajib diisi (minimal 3 karakter).' },
        { status: 400 }
      );
    }

    const cleanId = (id || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    if (cleanId.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Kode identitas peran tidak valid (minimal 3 karakter alfanumerik).' },
        { status: 400 }
      );
    }

    const savedRole = await rolesRepository.saveCustomRole({
      id: cleanId,
      name: name.trim(),
      description: (description || '').trim(),
      scope: scope === 'global' || scope === 'cabang' ? scope : 'regional',
      permissions: Array.isArray(permissions) ? permissions : [],
    });

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'RoleManagement',
        entity_id: savedRole.id,
        details: `Penambahan peran baru '${savedRole.name}' (${savedRole.id}) dengan cakupan '${savedRole.scope}' dan ${savedRole.permissions.length} hak akses.`,
        ip_address: getClientIp(req),
      });
    } catch {
      // non-fatal audit log error
    }

    return NextResponse.json({
      success: true,
      role: savedRole,
      message: `Peran '${savedRole.name}' berhasil disimpan.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menambahkan peran baru.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { id, name, description, scope, permissions } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID peran wajib disertakan.' },
        { status: 400 }
      );
    }

    const savedRole = await rolesRepository.saveCustomRole({
      id: id.trim(),
      name: (name || id).trim(),
      description: (description || '').trim(),
      scope: scope === 'global' || scope === 'cabang' ? scope : 'regional',
      permissions: Array.isArray(permissions) ? permissions : [],
    });

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'RoleManagement',
        entity_id: savedRole.id,
        details: `Pembaruan peran '${savedRole.name}' (${savedRole.id}): ${savedRole.permissions.length} hak akses dikonfigurasi.`,
        ip_address: getClientIp(req),
      });
    } catch {
      // non-fatal audit log error
    }

    return NextResponse.json({
      success: true,
      role: savedRole,
      message: `Peran '${savedRole.name}' berhasil diperbarui.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui peran.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    let roleId = searchParams.get('id');

    if (!roleId) {
      const body = await req.json().catch(() => ({}));
      roleId = body.id;
    }

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'ID peran yang akan dihapus wajib disertakan.' },
        { status: 400 }
      );
    }

    await rolesRepository.deleteCustomRole(roleId);

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'RoleManagement',
        entity_id: roleId,
        details: `Penghapusan peran kustom '${roleId}'.`,
        ip_address: getClientIp(req),
      });
    } catch {
      // non-fatal audit log error
    }

    return NextResponse.json({
      success: true,
      message: `Peran kustom '${roleId}' berhasil dihapus.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus peran.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
