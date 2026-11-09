import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const logs = dbQueries.getAuditLogs(limit);
    const batches = dbQueries.getImportBatches();

    return NextResponse.json({
      success: true,
      logs,
      batches,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
