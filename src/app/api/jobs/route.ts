import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { etlJobManager } from '@/lib/etlJobService';
import { apiSuccess, apiError, ERROR_CODES } from '@/lib/apiResponse';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('id');

  if (jobId) {
    const job = etlJobManager.getJob(jobId);
    if (!job) {
      return apiError('Job tidak ditemukan', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404,
      });
    }
    return apiSuccess(job);
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const jobs = etlJobManager.listJobs(limit);
  return apiSuccess(jobs);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'import:write' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { name, payload, maxRetries } = body || {};

    if (!name || typeof name !== 'string') {
      return apiError('Nama job wajib diisi string valid', {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: 400,
      });
    }

    const job = etlJobManager.createJob(name, payload, maxRetries ? Number(maxRetries) : 3);
    return apiSuccess(job, { status: 202 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat job';
    return apiError(msg, {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: 500,
    });
  }
}

