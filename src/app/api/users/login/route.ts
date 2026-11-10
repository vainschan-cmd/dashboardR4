import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  issueSessionCookies,
  getClientIp,
} from '@/lib/auth';
import { loginSchema, parseWithSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  try {
    const body = (await req.json()) as Record<string, unknown>;
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

    // 1. Check Brute-Force Rate Limit (Persistent SQLite WAL storage by IP + NIPP)
    const rateLimit = checkLoginRateLimit(clientIp, inputNipp);
    if (!rateLimit.allowed) {
      try {
        dbQueries.createAuditLog({
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

    // 2. Authenticate User against scrypt password hash
    const user = dbQueries.authenticateUser(inputNipp, inputPassword);

    if (!user) {
      recordLoginFailure(clientIp, inputNipp);
      try {
        dbQueries.createAuditLog({
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
      try {
        dbQueries.createAuditLog({
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
    const systemParams = dbQueries.getSystemParameters();
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
      },
      session: {
        timeoutMinutes: systemParams.session_timeout_minutes || 30,
      },
    });

    await issueSessionCookies(response, safeUser, systemParams.session_timeout_minutes || 30);

    // 4. Record successful LOGIN in audit_logs
    try {
      dbQueries.createAuditLog({
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
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses autentikasi.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
