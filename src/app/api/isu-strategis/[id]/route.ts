import { NextRequest, NextResponse } from 'next/server';
import { isuStrategisRepository } from '@/lib/repositories/isuStrategis';
import { isuStrategisUpdateSchema, parseWithSchema } from '@/lib/validation';
import {
  requireAuth,
  enforceBranchFilterForRead,
  validateBranchWriteAccess,
} from '@/lib/rbac';
import { getClientIp, type JwtSessionPayload } from '@/lib/auth';
import { getBranchNameByCode } from '@/lib/constants';
import { dbQueries } from '@/lib/db';
import { logError } from '@/lib/logger';

type IsuStrategisRecord = NonNullable<Awaited<ReturnType<typeof isuStrategisRepository.getById>>>;

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function resolveParamId(context: RouteContext): Promise<string> {
  const p = await Promise.resolve(context.params);
  return p?.id || '';
}

async function loadWritableIsu(
  id: string,
  session: JwtSessionPayload,
  notFoundMessage: string
): Promise<
  | { ok: true; existing: IsuStrategisRecord; canonicalCode: string }
  | { ok: false; response: NextResponse }
> {
  const existing = await isuStrategisRepository.getById(id);
  if (!existing) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: notFoundMessage }, { status: 404 }),
    };
  }
  const existingCheck = validateBranchWriteAccess(session, existing.cabangCode);
  if (!existingCheck.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: existingCheck.error || 'Akses ditolak: isu strategis berada di luar cabang Anda.' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, existing, canonicalCode: existingCheck.canonicalCode };
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const item = await isuStrategisRepository.getById(id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Data isu strategis tidak ditemukan.' }, { status: 404 });
    }

    const scopedBranch = enforceBranchFilterForRead(auth.session, null);
    if (scopedBranch && item.cabangCode !== scopedBranch && item.cabangCode !== 'R99') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: isu strategis berada di luar cakupan cabang Anda.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error: unknown) {
    logError('api/isu-strategis/[id]', error, { method: 'GET', requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal mengambil data isu.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req, { requiredPermission: 'manual_input:write' });
  if (!auth.authorized) return auth.response;

  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const loaded = await loadWritableIsu(id, auth.session, 'Data isu tidak ditemukan untuk diperbarui.');
    if (!loaded.ok) return loaded.response;

    const clientIp = getClientIp(req);
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseWithSchema(isuStrategisUpdateSchema, body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const updatePayload = { ...parsed.data };
    if (updatePayload.cabangCode !== undefined) {
      const targetCheck = validateBranchWriteAccess(auth.session, updatePayload.cabangCode);
      if (!targetCheck.allowed) {
        return NextResponse.json(
          { success: false, error: targetCheck.error || 'Akses ditolak: cabang tujuan berada di luar wewenang Anda.' },
          { status: 403 }
        );
      }
      updatePayload.cabangCode = targetCheck.canonicalCode;
      if (auth.session.role === 'pic_cabang') {
        updatePayload.cabangName = getBranchNameByCode(targetCheck.canonicalCode);
      }
    } else if (auth.session.role === 'pic_cabang' && updatePayload.cabangName !== undefined) {
      updatePayload.cabangName = getBranchNameByCode(loaded.canonicalCode);
    }

    const updater = auth.session.name || auth.session.sub;
    const updated = await isuStrategisRepository.update(id, updatePayload, updater);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Data isu tidak ditemukan untuk diperbarui.' }, { status: 404 });
    }

    // Rekam Audit Trail
    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: updater,
        user_role: auth.session.role,
        action: 'UPDATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: id,
        details: `Memperbarui Isu Strategis [${updated.kode}] Status: ${updated.status}, Progres: ${updated.progres}%.`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      logError('api/isu-strategis/[id]:audit', auditErr, { method: 'PUT', requestId: req.headers.get('x-request-id') });
    }

    return NextResponse.json({
      success: true,
      message: 'Data isu strategis berhasil diperbarui di PostgreSQL.',
      data: updated,
    });
  } catch (error: unknown) {
    logError('api/isu-strategis/[id]', error, { method: 'PUT', requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal memperbarui data isu.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req, { requiredPermission: 'manual_input:write' });
  if (!auth.authorized) return auth.response;

  try {
    const id = await resolveParamId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID isu tidak valid.' }, { status: 400 });
    }

    const loaded = await loadWritableIsu(id, auth.session, 'Data isu tidak ditemukan.');
    if (!loaded.ok) return loaded.response;
    const { existing } = loaded;

    const clientIp = getClientIp(req);
    const deleted = await isuStrategisRepository.delete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Gagal menghapus data isu dari database.' }, { status: 500 });
    }

    // Rekam Audit Trail
    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name || auth.session.sub,
        user_role: auth.session.role,
        action: 'UPDATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: id,
        details: `Menghapus Isu Strategis [${existing.kode}] "${existing.judul}".`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      logError('api/isu-strategis/[id]:audit', auditErr, { method: 'DELETE', requestId: req.headers.get('x-request-id') });
    }

    return NextResponse.json({
      success: true,
      message: `Isu strategis [${existing.kode}] berhasil dihapus dari PostgreSQL.`,
      id,
    });
  } catch (error: unknown) {
    logError('api/isu-strategis/[id]', error, { method: 'DELETE', requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal menghapus data isu.' }, { status: 500 });
  }
}
