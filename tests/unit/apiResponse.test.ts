import { describe, it, expect } from 'vitest';
import { apiSuccess, apiError, ERROR_CODES } from '@/lib/apiResponse';

describe('API Response Envelope (CODE-05)', () => {
  it('generates a conforming success response envelope', async () => {
    const res = apiSuccess({ kpi: 100 }, { status: 200, requestId: 'req-123' });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-123');

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      success: true,
      data: { kpi: 100 },
      requestId: 'req-123',
    });
  });

  it('generates a conforming error response envelope with taxonomy code', async () => {
    const res = apiError('Parameter tidak valid', {
      code: ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      details: [{ field: 'year', message: 'Tahun wajib diisi' }],
      requestId: 'req-err-456',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('x-request-id')).toBe('req-err-456');

    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parameter tidak valid',
        details: [{ field: 'year', message: 'Tahun wajib diisi' }],
        requestId: 'req-err-456',
      },
      message: 'Parameter tidak valid',
      requestId: 'req-err-456',
    });
  });

  it('provides default internal error code and 500 status if omitted', async () => {
    const res = apiError('Koneksi terputus');
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(json.message).toBe('Koneksi terputus');
  });
});

