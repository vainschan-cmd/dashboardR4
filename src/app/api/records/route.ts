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
import { logError } from '@/lib/logger';

const MAX_RECORD_FIELDS = 30;
const ALLOWED_RECORD_FIELDS = new Set([
  'id',
  'branch_id',
  'branch_code',
  'branch_name',
  'department_id',
  'department_name',
  'indicator_id',
  'indicator_code',
  'indicator_name',
  'direction',
  'month',
  'year',
  'target',
  'realization',
  'unit',
  'achievement_pct',
  'status_color',
  'notes',
  'source_type',
  'batch_id',
  'verification_status',
  'revision_notes',
  'uploaded_by',
  'uploaded_at',
  'verified_by',
  'verified_at',
  'is_simulated',
]);

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

    // Field selection / DTO projection (PERF-07 + SA-25 allowlist & cap)
    const rawFields = searchParams.get('fields');
    const requestedFields = rawFields
      ? Array.from(
          new Set(
            rawFields
              .split(',')
              .slice(0, MAX_RECORD_FIELDS)
              .map((f) => f.trim())
              .filter((f) => ALLOWED_RECORD_FIELDS.has(f))
          )
        )
      : null;

    const projectedRecords =
      requestedFields && requestedFields.length > 0
        ? records.map((r) => {
            const projected: Record<string, unknown> = {};
            const recordMap = r as unknown as Record<string, unknown>;
            for (const f of requestedFields) {
              if (Object.hasOwn(recordMap, f)) {
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
    logError('api/records', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal memuat rekaman bulanan.' }, { status: 500 });
  }
}
