/**
 * Client Cache with Stale-Time support (PERF-04).
 * Prevents redundant identical network requests on tab navigation.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTimeMs: number;
}

const MAX_CACHE_ENTRIES = 200;

class ClientCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultStaleTimeMs = 60_000; // 60 seconds

  /**
   * Set default stale time in milliseconds.
   */
  setDefaultStaleTime(ms: number): void {
    this.defaultStaleTimeMs = ms;
  }

  /**
   * Get cached data if present and not stale (or return data even if stale when allowStale=true).
   */
  get<T>(key: string, allowStale = false): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    const isStale = Date.now() - entry.timestamp > entry.staleTimeMs;
    if (isStale && !allowStale) {
      return undefined;
    }
    return entry.data;
  }

  /**
   * Put data into cache with a specific or default stale time (bounded to MAX_CACHE_ENTRIES).
   */
  set<T>(key: string, data: T, staleTimeMs?: number): void {
    const now = Date.now();
    if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_ENTRIES) {
      for (const [k, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.staleTimeMs) {
          this.cache.delete(k);
        }
      }
      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      data,
      timestamp: now,
      staleTimeMs: staleTimeMs ?? this.defaultStaleTimeMs,
    });
  }

  /**
   * Check if cache has key and is still fresh.
   */
  hasFresh(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Check if cache entry is stale.
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > entry.staleTimeMs;
  }

  /**
   * Invalidate specific key or keys matching pattern.
   */
  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Fetch with cache. If fresh data exists in cache, returns it immediately without calling fetcher.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      staleTimeMs?: number;
      force?: boolean;
    }
  ): Promise<T> {
    const { staleTimeMs = this.defaultStaleTimeMs, force = false } = options || {};

    if (!force) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    const freshData = await fetcher();
    this.set(key, freshData, staleTimeMs);
    return freshData;
  }
}

export const clientCache = new ClientCache();

