import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSensitiveKey,
  redactForLog,
  getRequestId,
  logEvent,
  logError,
  REQUEST_ID_HEADER,
} from '@/lib/logger';

describe('isSensitiveKey', () => {
  it('mengenali kunci yang berbahaya untuk dilog', () => {
    const keys = [
      'password',
      'newPassword',
      'password_hash',
      'secret',
      'JWT_SECRET',
      'token',
      'access_token',
      'apiKey',
      'api_key',
      'authorization',
      'cookie',
      'credentials',
      'private_key',
      'session_id',
      'jti',
    ];
    for (const key of keys) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
  });

  it('tidak menyamarkan kunci yang wajar', () => {
    for (const key of ['nipp', 'name', 'branch_id', 'role', 'amount', 'period', 'totalRows']) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });
});

describe('redactForLog', () => {
  it('menyamarkan nilai sensitif pada objek bersarang', () => {
    const result = redactForLog({
      user: { nipp: '10000', password: 'rahasia-sekali' },
      headers: { authorization: 'Bearer abc.def.ghi', cookie: 'portsight=xyz' },
    }) as Record<string, Record<string, unknown>>;

    expect(result.user.nipp).toBe('10000');
    expect(result.user.password).toBe('[redacted]');
    expect(result.headers.authorization).toBe('[redacted]');
    expect(result.headers.cookie).toBe('[redacted]');
    expect(JSON.stringify(result)).not.toContain('rahasia-sekali');
    expect(JSON.stringify(result)).not.toContain('abc.def.ghi');
  });

  it('memotong string yang terlalu panjang', () => {
    const long = 'x'.repeat(900);
    const result = redactForLog({ detail: long }) as Record<string, unknown>;
    expect(String(result.detail).length).toBeLessThan(long.length);
    expect(String(result.detail).endsWith('…')).toBe(true);
  });

  it('membatasi kedalaman objek bersarang', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'terlalu-dalam' } } } } } };
    const serialized = JSON.stringify(redactForLog(deep));
    expect(serialized).toContain('[truncated]');
  });

  it('membatasi jumlah kunci per objek', () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) wide[`key${i}`] = i;
    const result = redactForLog(wide) as Record<string, number>;
    expect(Object.keys(result).length).toBeLessThanOrEqual(40);
  });

  it('menangani Error tanpa membocorkan stack trace', () => {
    const result = redactForLog(new Error('gagal konek')) as Record<string, unknown>;
    expect(result.message).toBe('gagal konek');
    expect(result).not.toHaveProperty('stack');
  });

  it('menangani null, undefined, dan nilai primitif', () => {
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(undefined)).toBeUndefined();
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(true)).toBe(true);
    expect(redactForLog(BigInt('10'))).toBe('10');
  });

  it('membatasi panjang array', () => {
    const result = redactForLog(Array.from({ length: 100 }, (_, i) => i)) as number[];
    expect(result.length).toBeLessThanOrEqual(40);
  });
});

describe('getRequestId', () => {
  it('menerima id dari hulu yang formatnya wajar', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'abc-123-DEF_456' });
    expect(getRequestId(headers)).toBe('abc-123-DEF_456');
  });

  it('mengabaikan id yang terlalu pendek', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'abc' });
    const id = getRequestId(headers);
    expect(id).not.toBe('abc');
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('menolak id dengan karakter berbahaya (anti log injection)', () => {
    // `Headers` sendiri menolak newline, jadi simulasikan sumber header mentah
    // untuk memastikan validator kita juga menolak bentuk berbahaya lainnya.
    const rawHeader = (value: string) => ({
      get: (name: string) => (name === REQUEST_ID_HEADER ? value : null),
    }) as unknown as Headers;

    for (const evil of ['abcd\n[ADMIN] login ok', 'abc def ghi', '<script>alert(1)</script>']) {
      const id = getRequestId(rawHeader(evil));
      expect(id).not.toContain('\n');
      expect(id).not.toContain('<');
      expect(id).not.toContain(' ');
    }
  });

  it('membuat UUID saat header tidak ada', () => {
    const id = getRequestId(new Headers());
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('logEvent / logError', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('menyertakan nama event pada setiap baris', () => {
    logEvent('info', 'api/master', { rows: 12 });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[api/master]'));
  });

  it('menyamarkan kredensial pada metadata', () => {
    logEvent('warn', 'auth/login', { nipp: '10000', password: 'rahasia' });
    const line = String(warnSpy.mock.calls[0][0]);
    expect(line).toContain('10000');
    expect(line).not.toContain('rahasia');
    expect(line).toContain('[redacted]');
  });

  it('logError tidak membocorkan token', () => {
    logError('api/records', new Error('boom'), { token: 'eyJhbGciOi.payload.sig' });
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('boom');
    expect(line).not.toContain('eyJhbGciOi');
  });
});
