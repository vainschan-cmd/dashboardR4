import { NextResponse } from 'next/server';

/**
 * Standard API response envelope and error taxonomy (CODE-05).
 *
 * All endpoints adhering to this standard emit:
 * - Success: { ok: true, success: true, data: T, requestId?: string }
 * - Error: { ok: false, success: false, error: { code: string, message: string, details?: unknown, requestId?: string }, message: string, requestId?: string }
 *
 * Dual compatibility: preserves both `ok` and legacy `success`/`message` fields so existing
 * client code and regression tests run without modification.
 */

export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | string;

export interface ApiSuccessEnvelope<T = unknown> {
  ok: true;
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorEnvelope {
  ok: false;
  success: false;
  error: ApiErrorDetail;
  message: string;
  requestId?: string;
}

export type ApiResponseEnvelope<T = unknown> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    headers?: HeadersInit;
    requestId?: string;
  }
): NextResponse<ApiSuccessEnvelope<T>> {
  const { status = 200, headers = {}, requestId } = options || {};
  const responseHeaders = new Headers(headers);
  if (requestId) {
    responseHeaders.set('x-request-id', requestId);
  }

  return NextResponse.json(
    {
      ok: true,
      success: true,
      data,
      ...(requestId ? { requestId } : {}),
    },
    { status, headers: responseHeaders }
  );
}

export function apiError(
  message: string,
  options?: {
    code?: ErrorCode;
    status?: number;
    details?: unknown;
    requestId?: string;
    headers?: HeadersInit;
  }
): NextResponse<ApiErrorEnvelope> {
  const {
    code = ERROR_CODES.INTERNAL_ERROR,
    status = 500,
    details,
    requestId,
    headers = {},
  } = options || {};

  const responseHeaders = new Headers(headers);
  if (requestId) {
    responseHeaders.set('x-request-id', requestId);
  }

  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
      message,
      ...(requestId ? { requestId } : {}),
    },
    { status, headers: responseHeaders }
  );
}
