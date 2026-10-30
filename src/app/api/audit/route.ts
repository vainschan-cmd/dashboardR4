import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const logs = dbQueries.getAuditLogs(limit);
    const batches = dbQueries.getImportBatches();

    return NextResponse.json({
      success: true,
      logs,
      batches
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
