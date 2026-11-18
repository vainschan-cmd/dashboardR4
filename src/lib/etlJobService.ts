/**
 * ETL Job Scheduling, Status Tracking, and Resilient Retry Service (FEAT-03).
 * Provides robust background execution with exponential backoff and job history.
 */

export type JobStatus = 'pending' | 'running' | 'retrying' | 'completed' | 'failed';

export interface ETLJobOwner {
  userId: string;
  role: string;
}

export interface ETLJob<TResult = unknown, TPayload = unknown> {
  id: string;
  name: string;
  status: JobStatus;
  payload?: TPayload;
  progress: number; // 0 - 100
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  result?: TResult;
  createdBy?: ETLJobOwner;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

class ETLJobManager {
  private jobs = new Map<string, ETLJob>();
  private readonly maxHistory = 100;

  createJob<TPayload>(
    name: string,
    payload?: TPayload,
    maxRetries = 3,
    createdBy?: ETLJobOwner
  ): ETLJob<unknown, TPayload> {
    const safeMaxRetries = Number.isFinite(maxRetries)
      ? Math.min(10, Math.max(0, Math.floor(maxRetries)))
      : 3;
    const id = `job_etl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: ETLJob<unknown, TPayload> = {
      id,
      name,
      status: 'pending',
      payload,
      progress: 0,
      retryCount: 0,
      maxRetries: safeMaxRetries,
      ...(createdBy ? { createdBy } : {}),
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(id, job as ETLJob);
    this.trimHistory();
    return job;
  }

  getJob(id: string): ETLJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(limit = 20, ownerUserId?: string): ETLJob[] {
    const values = Array.from(this.jobs.values());
    const filtered = ownerUserId
      ? values.filter((job) => job.createdBy?.userId === ownerUserId)
      : values;
    return filtered
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  updateProgress(id: string, progress: number): void {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
    }
  }

  /**
   * Run job task with automatic exponential backoff retry.
   */
  async runJob<TResult>(
    id: string,
    taskFn: (job: ETLJob) => Promise<TResult>,
    options?: {
      initialBackoffMs?: number;
      backoffFactor?: number;
    }
  ): Promise<ETLJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    const initialBackoffMs = options?.initialBackoffMs ?? 100;
    const backoffFactor = options?.backoffFactor ?? 2;

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    while (job.retryCount <= job.maxRetries) {
      try {
        const result = await taskFn(job);
        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.completedAt = new Date().toISOString();
        return job;
      } catch (err: unknown) {
        job.retryCount++;
        job.lastError = err instanceof Error ? err.message : String(err);

        if (job.retryCount <= job.maxRetries) {
          job.status = 'retrying';
          const delayMs = initialBackoffMs * Math.pow(backoffFactor, job.retryCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          job.status = 'failed';
          job.completedAt = new Date().toISOString();
          return job;
        }
      }
    }

    return job;
  }

  private trimHistory(): void {
    if (this.jobs.size > this.maxHistory) {
      const sortedKeys = Array.from(this.jobs.entries())
        .sort(([, a], [, b]) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(([k]) => k);
      const toRemove = sortedKeys.slice(0, this.jobs.size - this.maxHistory);
      for (const k of toRemove) {
        this.jobs.delete(k);
      }
    }
  }
}

export const etlJobManager = new ETLJobManager();

