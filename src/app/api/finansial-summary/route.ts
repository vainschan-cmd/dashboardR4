import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  resolveSummaryBranchScope,
  enforceDepartmentFilterForRead,
  enforceVerificationFilterForRead,
} from '@/lib/rbac';
import { getFinansialModuleSummary } from '@/lib/finansialConsolidationService';
import { logError } from '@/lib/logger';

/**
 * Mengurai parameter period:
 * - undefined (tidak dikirim) -> undefined (pakai default sinkron 2026 / 8)
 * - 'ALL' / 'SEMUA' -> null (seluruh periode)
 * - angka positif -> number
 */
function parsePeriodParam(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return undefined;
  if (trimmed === 'ALL' || trimmed === 'SEMUA') return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  const scopedDept = enforceDepartmentFilterForRead(auth.session, undefined);
  if (scopedDept && scopedDept !== 'dept_keu') {
    return NextResponse.json(
      { success: false, error: 'Akses ditolak: data finansial berada di luar departemen Anda.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const tahun = parsePeriodParam(searchParams.get('tahun'));
    const bulan = parsePeriodParam(searchParams.get('bulan'));
    const entitas = searchParams.get('entitas');
    const nmCbg = searchParams.get('nmCbg');
    const rekening = searchParams.get('rekening');
    const search = searchParams.get('search');

    const requestedBranch =
      searchParams.get('branchCode') ||
      searchParams.get('branch') ||
      searchParams.get('terminal') ||
      undefined;
    const { isPicCabang, picBranchCode, branchCodes } = resolveSummaryBranchScope(
      auth.session,
      requestedBranch
    );

    const verifiedOnly = enforceVerificationFilterForRead(
      auth.session,
      searchParams.get('verifiedOnly') ?? searchParams.get('verified_only')
    );

    const payload = await getFinansialModuleSummary({
      tahun,
      bulan,
      entitas,
      nmCbg,
      branchCodes,
      rekening,
      search,
      verifiedOnly,
      isPicCabang,
      picBranchCode,
    });

    return NextResponse.json(payload);
  } catch (err) {
    logError('api/finansial-summary', err, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal memuat ringkasan Finansial dari PostgreSQL',
      },
      { status: 500 }
    );
  }
}

