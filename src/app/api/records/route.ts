import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import {
  requireAuth,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
  enforceVerificationFilterForRead,
  enforceVerificationStatusFilterForRead,
} from '@/lib/rbac';
import { recordsQuerySchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'records:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = {
      branch_id: searchParams.get('branch_id') || undefined,
      department_id: searchParams.get('department_id') || undefined,
      month: searchParams.get('month') || undefined,
      year: searchParams.get('year') || undefined,
      verified_only: searchParams.get('verified_only') || undefined,
      verification_status: searchParams.get('verification_status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    };

    const parsed = parseWithSchema(recordsQuerySchema, rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error, message: parsed.error },
        { status: 400 }
      );
    }

    const branch_id = enforceBranchFilterForRead(auth.session, parsed.data.branch_id);
    const department_id = enforceDepartmentFilterForRead(auth.session, parsed.data.department_id);
    const verified_only = enforceVerificationFilterForRead(auth.session, parsed.data.verified_only);
    const verification_status = enforceVerificationStatusFilterForRead(
      auth.session,
      parsed.data.verification_status
    );

    const filters = {
      branch_id,
      department_id,
      month: parsed.data.month,
      year: parsed.data.year,
      verified_only,
      verification_status,
    };

    const records = await dbQueries.getMonthlyRecords({
      ...filters,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    const total = await dbQueries.countMonthlyRecords(filters);

    // Field selection / DTO projection (PERF-07)
    const rawFields = searchParams.get('fields');
    const requestedFields = rawFields
      ? rawFields
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : null;

    const projectedRecords = requestedFields
      ? records.map((r) => {
          const projected: Record<string, unknown> = {};
          const recordMap = r as unknown as Record<string, unknown>;
          for (const f of requestedFields) {
            if (f in recordMap) {
              projected[f] = recordMap[f];
            }
          }
          return projected;
        })
      : records;

    return NextResponse.json({
      success: true,
      count: projectedRecords.length,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      hasMore: parsed.data.offset + projectedRecords.length < total,
      records: projectedRecords,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat rekaman bulanan.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
