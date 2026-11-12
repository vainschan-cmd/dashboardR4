import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { resolvePeriodRange } from '@/lib/period';
import { logError } from '@/lib/logger';
import { resolveReadBranchScope, resolveVerifiedOnly } from '@/lib/policy';
import { buildBranchSummaries, consolidateSummaries } from '@/lib/dashboardSummary';
import { getCanonicalBranchCode } from '@/lib/constants';

/**
 * GET /api/dashboard/summary
 *
 * Pre-aggregated figures for the Beranda (executive) view.
 *
 * Replaces downloading raw module rows and aggregating in the browser: the
 * payload for a YTD window drops from ~523 KB to a few KB of per-branch numbers.
 * Every figure is computed with SQL `GROUP BY` so the database does the work and
 * the wire only carries results.
 *
 * Query: `period` (label from the UI), `branch` (canonical code or comma list),
 * `verifiedOnly` (forced to true for viewers).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);

    const range = resolvePeriodRange(searchParams.get('period'), new Date());

    const requestedBranch =
      searchParams.get('branch') ||
      searchParams.get('branches') ||
      searchParams.get('branchCode') ||
      '';
    const scopedBranch = resolveReadBranchScope(
      {
        role: auth.session.role,
        branch_id: auth.session.branch_id,
        department_id: auth.session.department_id,
        sub: auth.session.sub,
      },
      requestedBranch
    );

    // Executive viewers only ever see verified data, whatever the query says.
    const verifiedOnly = resolveVerifiedOnly(
      { role: auth.session.role },
      searchParams.get('verifiedOnly')
    );

    const branchCodes: string[] = [];
    if (scopedBranch && scopedBranch !== 'ALL' && scopedBranch !== 'NONE') {
      for (const raw of scopedBranch.split(',')) {
        const code = getCanonicalBranchCode(raw.trim(), raw.trim());
        if (code) branchCodes.push(code);
      }
    }

    const summaries =
      scopedBranch === 'NONE'
        ? []
        : buildBranchSummaries({
            startYear: range.startYear,
            startMonth: range.startMonth,
            endYear: range.endYear,
            endMonth: range.endMonth,
            branchCodes,
            verifiedOnly,
          });

    return NextResponse.json({
      success: true,
      period: {
        label: range.label,
        startYear: range.startYear,
        startMonth: range.startMonth,
        endYear: range.endYear,
        endMonth: range.endMonth,
      },
      verifiedOnly,
      totals: consolidateSummaries(summaries),
      branches: summaries,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan dashboard.';
    logError('api/dashboard/summary', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: message, requestId: req.headers.get('x-request-id') },
      { status: 500 }
    );
  }
}
