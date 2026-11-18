import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import {
  getTargetVersions,
  getActiveTarget,
  createTargetVersion,
} from '@/lib/targetVersions';
import { apiSuccess, apiError, ERROR_CODES } from '@/lib/apiResponse';
import { dbQueries } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const indicatorId = searchParams.get('indicator_id');

  if (!indicatorId) {
    return apiError('Parameter indicator_id wajib disertakan', {
      code: ERROR_CODES.BAD_REQUEST,
      status: 400,
    });
  }

  try {
    const versions = await getTargetVersions(indicatorId);
    const active = await getActiveTarget(indicatorId);
    return apiSuccess({
      indicator_id: indicatorId,
      active_target: active,
      versions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil versi target';
    return apiError(msg, {
      code: ERROR_CODES.DATABASE_ERROR,
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { indicator_id, target_value, effective_from, notes } = body || {};

    if (!indicator_id || typeof indicator_id !== 'string') {
      return apiError('indicator_id wajib diisi string valid', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    if (target_value === undefined || isNaN(Number(target_value))) {
      return apiError('target_value wajib berupa angka valid', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    if (!effective_from || typeof effective_from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effective_from)) {
      return apiError('effective_from wajib berupa tanggal format YYYY-MM-DD', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    const created = await createTargetVersion({
      indicator_id,
      target_value: Number(target_value),
      effective_from,
      notes: typeof notes === 'string' ? notes : undefined,
      created_by: auth.session.nipp || auth.session.username,
    });

    // Audit log
    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'CONFIG_UPDATE',
        entity: 'KPI_TARGET_VERSION',
        entity_id: created.id,
        details: `Versi target ${created.version} untuk ${indicator_id} sebesar ${created.target_value} berlaku ${created.effective_from}`,
        ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      });
    } catch (auditErr) {
      console.warn('[POST /api/master/target-versions] Audit log error:', auditErr);
    }

    return apiSuccess(created, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat versi target baru';
    return apiError(msg, {
      code: ERROR_CODES.DATABASE_ERROR,
      status: 500,
    });
  }
}
