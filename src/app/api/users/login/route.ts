import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  issueSessionCookies,
  getClientIp,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const { nipp, username, password } = body;

    const inputNipp = String(nipp || username || '').trim();
    const inputPassword = String(password || '').trim();

    if (!inputNipp) {
      return NextResponse.json(
        { success: false, error: 'Silakan masukkan NIPP Anda.' },
        { status: 400 }
      );
    }

    if (!inputPassword) {
      return NextResponse.json(
        { success: false, error: 'Silakan masukkan kata sandi Anda.' },
        { status: 400 }
      );
    }

    // 1. Check Brute-Force Rate Limit (IP + NIPP)
    const rateLimit = checkLoginRateLimit(clientIp, inputNipp);
    if (!rateLimit.allowed) {
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
      } catch {}

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

    // 2. Authenticate User against scrypt password hash (No universal bypass)
    const user = await dbQueries.authenticateUser(inputNipp, inputPassword);

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
      } catch {}

      // Uniform error message to prevent NIPP enumeration
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
      } catch {}

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
      },
      session: {
        timeoutMinutes: systemParams.session_timeout_minutes || 30,
      },
    });

    await issueSessionCookies(response, safeUser, systemParams.session_timeout_minutes || 30);

    // 4. Record successful LOGIN in audit_logs
    try {
      await dbQueries.createAuditLog({
        user_id: safeUser.id,
        user_name: safeUser.name,
        user_role: safeUser.role,
        action: 'LOGIN',
        entity: 'AuthSession',
        entity_id: safeUser.nipp,
        details: `Login sesi JWT berhasil untuk ${safeUser.name} (NIPP: ${safeUser.nipp}, Role: ${safeUser.role}, Cabang: ${safeUser.branch_id || 'R99'}).`,
        ip_address: clientIp,
      });
    } catch {}

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan saat memproses autentikasi.' },
      { status: 500 }
    );
  }
}
