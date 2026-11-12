import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { getFinansialModuleSummary } from '@/lib/finansialConsolidationService';

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
    const rawBranch = enforceBranchFilterForRead(auth.session, requestedBranch);

    const isPicCabang =
      auth.session.role === 'pic_cabang' &&
      Boolean(auth.session.branch_id) &&
      auth.session.branch_id !== 'R99';

    const picBranchCode = isPicCabang ? rawBranch || auth.session.branch_id || null : null;

    const branchCodes =
      !isPicCabang && rawBranch && rawBranch !== 'ALL'
        ? rawBranch === 'NONE'
          ? ['__NONE__']
          : rawBranch
              .split(',')
              .map((b) => b.trim())
              .filter(Boolean)
        : undefined;

    const isBodViewer = auth.session.role === 'viewer';
    const verifiedOnlyParam = searchParams.get('verifiedOnly');
    const verifiedOnly =
      verifiedOnlyParam !== null ? verifiedOnlyParam === 'true' : isBodViewer;

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
    console.error('[/api/finansial-summary] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal memuat ringkasan Finansial dari PostgreSQL',
      },
      { status: 500 }
    );
  }
}

