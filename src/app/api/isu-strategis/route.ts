import { NextRequest, NextResponse } from 'next/server';
import { isuStrategisRepository } from '@/lib/repositories/isuStrategis';
import { isuStrategisSchema, parseWithSchema } from '@/lib/validation';
import {
  requireAuth,
  enforceBranchFilterForRead,
  validateBranchWriteAccess,
} from '@/lib/rbac';
import { getClientIp } from '@/lib/auth';
import { getBranchNameByCode } from '@/lib/constants';
import { dbQueries } from '@/lib/db';
import { logError } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const filter = {
      cabang: enforceBranchFilterForRead(auth.session, searchParams.get('cabang') || undefined),
      kategori: searchParams.get('kategori') || undefined,
      prioritas: searchParams.get('prioritas') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('q') || searchParams.get('search') || undefined,
    };

    const data = await isuStrategisRepository.getAll(filter);
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error: unknown) {
    logError('api/isu-strategis', error, { method: 'GET', requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal memuat data isu strategis.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'manual_input:write' });
  if (!auth.authorized) return auth.response;

  try {
    const clientIp = getClientIp(req);
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseWithSchema(isuStrategisSchema, body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const branchCheck = validateBranchWriteAccess(auth.session, parsed.data.cabangCode);
    if (!branchCheck.allowed) {
      return NextResponse.json(
        { success: false, error: branchCheck.error || 'Akses ditolak: cabang di luar wewenang Anda.' },
        { status: 403 }
      );
    }

    const scopedPayload =
      auth.session.role === 'pic_cabang'
        ? {
            ...parsed.data,
            cabangCode: branchCheck.canonicalCode,
            cabangName: getBranchNameByCode(branchCheck.canonicalCode),
          }
        : {
            ...parsed.data,
            cabangCode: branchCheck.canonicalCode,
          };

    const author = auth.session.name || auth.session.sub;
    const created = await isuStrategisRepository.create(scopedPayload, author);

    // Rekam Audit Trail ke PostgreSQL
    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: author,
        user_role: auth.session.role,
        action: 'CREATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: created.id,
        details: `Menambahkan Isu Strategis baru: [${created.kode}] ${created.judul} (${created.cabangName}) - Prioritas: ${created.prioritas}.`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      logError('api/isu-strategis:audit', auditErr, { method: 'POST', requestId: req.headers.get('x-request-id') });
    }

    return NextResponse.json(
      { success: true, message: 'Isu strategis berhasil ditambahkan ke database PostgreSQL.', data: created },
      { status: 201 }
    );
  } catch (error: unknown) {
    logError('api/isu-strategis', error, { method: 'POST', requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal menyimpan isu strategis.' }, { status: 500 });
  }
}
