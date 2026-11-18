import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser, maybeRunAuthHousekeeping } from '@/lib/db';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  issueSessionCookies,
  getClientIp,
} from '@/lib/auth';
import { loginSchema, parseWithSchema } from '@/lib/validation';
import { readRequestTextBounded } from '@/lib/httpBodyLimit';
import { logError } from '@/lib/logger';

const MAX_LOGIN_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  try {
    const rawBody = await readRequestTextBounded(req, MAX_LOGIN_BODY_BYTES);
    if (rawBody === null) {
      return NextResponse.json(
        { success: false, error: 'Ukuran payload login melebihi batas yang diizinkan.' },
        { status: 413 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Format body login tidak valid (JSON diharapkan).' },
        { status: 400 }
      );
    }

    const normalizedPayload = {
      nipp: String(body?.nipp || body?.username || '').trim(),
      password: String(body?.password || '').trim(),
    };

    const parsed = parseWithSchema(loginSchema, normalizedPayload);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const { nipp: inputNipp, password: inputPassword } = parsed.data;

    // 1. Check Brute-Force Rate Limit
    const rateLimit = checkLoginRateLimit(clientIp, inputNipp);
    if (!rateLimit.allowed) {
      // SA-07: Only record an audit log once per lockout window so an unauthenticated
      // 429 flood cannot amplify writes to PostgreSQL audit_logs and starve the DB pool.
      if (rateLimit.shouldAuditLockout) {
        try {
          await dbQueries.createAuditLog({
            user_id: inputNipp,
            user_name: inputNipp,
            user_role: 'anonymous',
            action: 'LOGIN',
            entity: 'AuthSession',
            entity_id: inputNipp,
            details: `Percobaan login diblokir sementara (Rate Limit). Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
            ip_address: clientIp,
          });
        } catch {
          // ignore non-fatal audit error
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan gagal. Silakan tunggu ${Math.ceil(rateLimit.retryAfterSeconds / 60)} menit sebelum mencoba kembali.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // 2. Authenticate User directly against PostgreSQL users table (fail-closed if PG is down)
    let user;
    try {
      user = await dbQueries.authenticateUserAsync(inputNipp, inputPassword);
    } catch (dbErr: unknown) {
      logError('POST /api/users/login db', dbErr, { requestId: req.headers.get('x-request-id') });
      return NextResponse.json(
        {
          success: false,
          error: 'Layanan autentikasi sedang tidak tersedia. Silakan coba beberapa saat lagi atau hubungi Administrator.',
        },
        { status: 503 }
      );
    }

    if (!user) {
      recordLoginFailure(clientIp, inputNipp);
      try {
        await dbQueries.createAuditLog({
          user_id: inputNipp,
          user_name: inputNipp,
          user_role: 'anonymous',
          action: 'LOGIN',
          entity: 'AuthSession',
          entity_id: inputNipp,
          details: `Gagal autentikasi untuk NIPP ${inputNipp}: kredensial tidak sesuai.`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }

      return NextResponse.json(
        {
          success: false,
          error: 'NIPP atau kata sandi yang Anda masukkan tidak sesuai.',
        },
        { status: 401 }
      );
    }

    if (!user.active) {
      recordLoginFailure(clientIp, inputNipp);
      try {
        await dbQueries.createAuditLog({
          user_id: user.id,
          user_name: user.name,
          user_role: user.role,
          action: 'LOGIN',
          entity: 'AuthSession',
          entity_id: user.nipp,
          details: `Percobaan login ditolak: akun NIPP ${user.nipp} berstatus nonaktif.`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Akun Anda sedang dinonaktifkan oleh Administrator.',
        },
        { status: 403 }
      );
    }

    // 3. Reset rate limit & Issue HttpOnly JWT Cookies
    resetLoginRateLimit(clientIp, inputNipp);
    maybeRunAuthHousekeeping();
    const systemParams = await dbQueries.getSystemParameters();
    const safeUser = toSafeUser(user);

    const response = NextResponse.json({
      success: true,
      message: `Autentikasi berhasil. Selamat bertugas, ${safeUser.name}.`,
      user: {
        id: safeUser.id,
        username: safeUser.username,
        nipp: safeUser.nipp,
        name: safeUser.name,
        email: safeUser.email,
        divisi: safeUser.divisi,
        departemen: safeUser.departemen,
        role: safeUser.role,
        branch_id: safeUser.branch_id,
        department_id: safeUser.department_id,
        must_change_password: Boolean(safeUser.must_change_password),
      },
      session: {
        timeoutMinutes: systemParams.session_timeout_minutes || 30,
      },
    });

    await issueSessionCookies(
      response,
      safeUser,
      systemParams.session_timeout_minutes || 30,
      {
        ipAddress: clientIp,
        userAgent: req.headers.get('user-agent') || undefined,
      }
    );

    // 4. Record successful LOGIN in audit_logs
    try {
      await dbQueries.createAuditLog({
        user_id: safeUser.id,
        user_name: safeUser.name,
        user_role: safeUser.role,
        action: 'LOGIN',
        entity: 'AuthSession',
        entity_id: safeUser.nipp,
        details: `Login berhasil ke PortSight untuk ${safeUser.name} (NIPP: ${safeUser.nipp}, Role: ${safeUser.role}).`,
        ip_address: clientIp,
      });
    } catch {
      // ignore non-fatal audit error
    }

    return response;
  } catch (error: unknown) {
    logError('POST /api/users/login', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat memproses autentikasi.' },
      { status: 500 }
    );
  }
}
