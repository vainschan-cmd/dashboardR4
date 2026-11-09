import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'records:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawBranchId = searchParams.get('branch_id') || undefined;
    const branch_id = enforceBranchFilterForRead(auth.session, rawBranchId);
    const department_id = searchParams.get('department_id') || undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const verified_only = searchParams.get('verified_only') === 'true';
    const verification_status = searchParams.get('verification_status') || undefined;

    const records = dbQueries.getMonthlyRecords({
      branch_id,
      department_id,
      month,
      year,
      verified_only,
      verification_status,
    });

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
