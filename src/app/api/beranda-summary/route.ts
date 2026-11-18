import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  resolveSummaryBranchScope,
  enforceVerificationFilterForRead,
} from '@/lib/rbac';
import { getBerandaSummaryData } from '@/lib/berandaSummaryService';
import { logError } from '@/lib/logger';

function parsePositiveInt(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNmCbgParams(searchParams: URLSearchParams): string[] {
  const rawValues = searchParams.getAll('nmCbg');
  const result: string[] = [];
  for (const item of rawValues) {
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed && trimmed.toUpperCase() !== 'ALL') {
        result.push(trimmed);
      }
    }
  }
  return Array.from(new Set(result));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const tahun = parsePositiveInt(searchParams.get('tahun'));
    const bulan = parsePositiveInt(searchParams.get('bulan'));
    const nmCbgList = parseNmCbgParams(searchParams);

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

    const payload = await getBerandaSummaryData({
      tahun,
      bulan,
      nmCbgList,
      branchCodes,
      verifiedOnly,
      isPicCabang,
      picBranchCode,
    });

    return NextResponse.json(payload);
  } catch (err) {
    logError('api/beranda-summary', err, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal memuat ringkasan Beranda dari PostgreSQL',
      },
      { status: 500 }
    );
  }
}

