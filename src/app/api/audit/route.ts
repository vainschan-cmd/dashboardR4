import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';
import { auditQuerySchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'audit_logs:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseWithSchema(auditQuerySchema, {
      limit: searchParams.get('limit') || undefined,
    });
    const limit = parsed.success ? parsed.data.limit : 100;
    const logs = await dbQueries.getAuditLogs(limit);
    const batches = await dbQueries.getImportBatches();

    return NextResponse.json({
      success: true,
      logs,
      batches,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat log audit.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
