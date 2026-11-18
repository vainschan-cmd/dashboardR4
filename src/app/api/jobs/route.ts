import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/rbac';
import { etlJobManager } from '@/lib/etlJobService';
import { apiSuccess, apiError, ERROR_CODES } from '@/lib/apiResponse';
import { readRequestTextBounded } from '@/lib/httpBodyLimit';
import { logError } from '@/lib/logger';

const MAX_JOB_BODY_BYTES = 64 * 1024; // 64 KB cap (NV-05)

const createJobSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama job wajib diisi string valid')
    .max(120, 'Nama job maksimal 120 karakter')
    .regex(/^[A-Za-z0-9_.:-]+$/, 'Nama job hanya boleh berisi alfanumerik, _, ., :, -'),
  payload: z.record(z.string(), z.unknown()).optional(),
  maxRetries: z.coerce.number().int().min(0).max(10).optional().default(3),
});

function canInspectAllJobs(role: string): boolean {
  return role === 'super_admin' || role === 'admin_regional';
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('id');
  const isAdmin = canInspectAllJobs(auth.session.role);

  if (jobId) {
    const job = etlJobManager.getJob(jobId);
    if (!job || (!isAdmin && job.createdBy?.userId !== auth.session.sub)) {
      return apiError('Job tidak ditemukan', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404,
      });
    }
    return apiSuccess(job);
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20) || 20));
  const jobs = etlJobManager.listJobs(limit, isAdmin ? undefined : auth.session.sub);
  return apiSuccess(jobs);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const rawBody = await readRequestTextBounded(req, MAX_JOB_BODY_BYTES);
    if (rawBody === null) {
      return apiError('Ukuran payload job melebihi batas 64 KB.', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 413,
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return apiError('Payload JSON tidak valid.', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    const parsed = createJobSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Payload job tidak valid.';
      return apiError(firstIssue, {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    const { name, payload, maxRetries } = parsed.data;
    const job = etlJobManager.createJob(name, payload, maxRetries, {
      userId: auth.session.sub,
      role: auth.session.role,
    });
    return apiSuccess(job, { status: 202 });
  } catch (err: unknown) {
    logError('api/jobs', err, { requestId: req.headers.get('x-request-id') });
    return apiError('Gagal membuat job.', {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: 500,
    });
  }
}

