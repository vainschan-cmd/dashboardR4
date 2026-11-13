import { NextRequest, NextResponse } from 'next/server';
import { isuStrategisRepository } from '@/lib/repositories/isuStrategis';
import { isuStrategisUpdateSchema, parseWithSchema } from '@/lib/validation';
import { resolveRequestSession } from '@/lib/rbac';
import { getClientIp } from '@/lib/auth';
import { dbQueries } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function resolveParamId(context: RouteContext): Promise<string> {
  const p = await Promise.resolve(context.params);
  return p?.id || '';
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const item = await isuStrategisRepository.getById(id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Data isu strategis tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error: unknown) {
    console.error('[GET /api/isu-strategis/:id] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengambil data isu.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const session = await resolveRequestSession(req);
    const clientIp = getClientIp(req);

    if (session && session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Akun Viewer (BOD) hanya memiliki izin baca.' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseWithSchema(isuStrategisUpdateSchema, body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const updater = session?.name || session?.sub || 'PIC_REGIONAL_4';
    const updated = await isuStrategisRepository.update(id, parsed.data, updater);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Data isu tidak ditemukan untuk diperbarui.' }, { status: 404 });
    }

    // Rekam Audit Trail
    try {
      await dbQueries.createAuditLog({
        user_id: session?.sub || 'user_pic',
        user_name: updater,
        user_role: session?.role || 'pic',
        action: 'UPDATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: id,
        details: `Memperbarui Isu Strategis [${updated.kode}] Status: ${updated.status}, Progres: ${updated.progres}%.`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      console.warn('[PUT /api/isu-strategis/:id] Audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Data isu strategis berhasil diperbarui di PostgreSQL.',
      data: updated,
    });
  } catch (error: unknown) {
    console.error('[PUT /api/isu-strategis/:id] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal memperbarui data isu.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const session = await resolveRequestSession(req);
    const clientIp = getClientIp(req);

    if (session && session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Akun Viewer (BOD) hanya memiliki izin baca.' },
        { status: 403 }
      );
    }

    const existing = await isuStrategisRepository.getById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Data isu tidak ditemukan.' }, { status: 404 });
    }

    const deleted = await isuStrategisRepository.delete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Gagal menghapus data isu dari database.' }, { status: 500 });
    }

    // Rekam Audit Trail
    try {
      await dbQueries.createAuditLog({
        user_id: session?.sub || 'user_pic',
        user_name: session?.name || 'PIC_REGIONAL_4',
        user_role: session?.role || 'pic',
        action: 'UPDATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: id,
        details: `Menghapus Isu Strategis [${existing.kode}] "${existing.judul}".`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      console.warn('[DELETE /api/isu-strategis/:id] Audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Isu strategis [${existing.kode}] berhasil dihapus dari PostgreSQL.`,
      id,
    });
  } catch (error: unknown) {
    console.error('[DELETE /api/isu-strategis/:id] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal menghapus data isu.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
