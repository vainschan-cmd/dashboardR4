import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clientCache } from '@/lib/clientCache';

describe('Client Cache with Stale Time (PERF-04)', () => {
  beforeEach(() => {
    clientCache.invalidate();
  });

  it('stores and retrieves cached data when fresh', () => {
    clientCache.set('kpi_summary', { total: 100 }, 5000);
    expect(clientCache.get('kpi_summary')).toEqual({ total: 100 });
    expect(clientCache.hasFresh('kpi_summary')).toBe(true);
    expect(clientCache.isStale('kpi_summary')).toBe(false);
  });

  it('considers data stale after staleTime has passed', () => {
    vi.useFakeTimers();
    clientCache.set('kpi_summary', { total: 100 }, 1000); // 1s stale time

    expect(clientCache.get('kpi_summary')).toEqual({ total: 100 });

    // Advance time by 1.5 seconds
    vi.advanceTimersByTime(1500);

    expect(clientCache.isStale('kpi_summary')).toBe(true);
    expect(clientCache.get('kpi_summary')).toBeUndefined();
    // allowStale returns the stale value for optimistic rendering
    expect(clientCache.get('kpi_summary', true)).toEqual({ total: 100 });

    vi.useRealTimers();
  });

  it('fetchWithCache calls fetcher only once when data is fresh', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'ok', data: 42 });

    const res1 = await clientCache.fetchWithCache('test_key', fetcher, { staleTimeMs: 10000 });
    expect(res1).toEqual({ status: 'ok', data: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Call again immediately - should NOT call fetcher
    const res2 = await clientCache.fetchWithCache('test_key', fetcher, { staleTimeMs: 10000 });
    expect(res2).toEqual({ status: 'ok', data: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache by key or regex pattern', () => {
    clientCache.set('/api/master', { v: 1 });
    clientCache.set('/api/beranda-summary?t=2026', { v: 2 });
    clientCache.set('/api/users', { v: 3 });

    clientCache.invalidate('/api/beranda-summary');
    expect(clientCache.get('/api/beranda-summary?t=2026')).toBeUndefined();
    expect(clientCache.get('/api/master')).toEqual({ v: 1 });

    clientCache.invalidate();
    expect(clientCache.get('/api/master')).toBeUndefined();
  });
});

