import { describe, it, expect } from 'vitest';
import { etlJobManager } from '@/lib/etlJobService';

describe('ETL Job Runner & Resilient Retry (FEAT-03)', () => {
  it('creates and tracks job lifecycle from pending to completed', async () => {
    const job = etlJobManager.createJob('sync_monthly_records', { branch: 'R01' });
    expect(job.status).toBe('pending');
    expect(job.progress).toBe(0);

    const executed = await etlJobManager.runJob(job.id, async (j) => {
      etlJobManager.updateProgress(j.id, 50);
      return { syncedRows: 120 };
    });

    expect(executed.status).toBe('completed');
    expect(executed.progress).toBe(100);
    expect(executed.result).toEqual({ syncedRows: 120 });
    expect(executed.completedAt).toBeDefined();
  });

  it('retries on failure with exponential backoff and succeeds on subsequent try', async () => {
    const job = etlJobManager.createJob('sync_sheets_flaky', {}, 3);
    let attempts = 0;

    const executed = await etlJobManager.runJob(
      job.id,
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Koneksi timeout sementara');
        }
        return { success: true };
      },
      { initialBackoffMs: 10, backoffFactor: 2 }
    );

    expect(executed.status).toBe('completed');
    expect(executed.retryCount).toBe(1);
    expect(attempts).toBe(2);
  });

  it('marks job as failed when retries are exhausted', async () => {
    const job = etlJobManager.createJob('sync_unreachable', {}, 2);
    let attempts = 0;

    const executed = await etlJobManager.runJob(
      job.id,
      async () => {
        attempts++;
        throw new Error('Layanan eksternal tidak dapat dihubungi');
      },
      { initialBackoffMs: 5, backoffFactor: 2 }
    );

    expect(executed.status).toBe('failed');
    expect(executed.retryCount).toBe(3); // Initial try + 2 retries = 3 attempts
    expect(attempts).toBe(3);
    expect(executed.lastError).toBe('Layanan eksternal tidak dapat dihubungi');
  });

  it('lists jobs in reverse chronological order', () => {
    const list = etlJobManager.listJobs();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

