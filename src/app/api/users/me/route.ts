import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import {
  getSessionFromRequest,
  resolveSessionToken,
  verifyJwtToken,
  issueSessionCookies,
  issueAccessCookie,
  clearSessionCookies,
  getClientIp,
  readRefreshTokenCookie,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // `rotate=1` is the client's silent renewal + activity heartbeat: it issues a
    // new short-lived access token without touching the refresh token, so it is
    // safe to call while other requests are in flight.
    const wantsAccessRotation = req.nextUrl.searchParams.get('rotate') === '1';

    let session = await getSessionFromRequest(req);
    let shouldRotateCookies = false;
    let rotatedFromJti: string | null = null;

    // If access token is expired or missing, exchange the HttpOnly refresh token once.
    if (!session) {
      const refreshCookie = readRefreshTokenCookie(req);
      if (refreshCookie) {
        // Reuse detection: a token already consumed by rotation must never work again.
        const rawRefresh = await verifyJwtToken(refreshCookie);
        if (rawRefresh && rawRefresh.type === 'refresh') {
          const existing = dbQueries.getAuthSession(rawRefresh.jti);
          if (existing && existing.revoked_at !== null && existing.revoked_reason === 'rotated') {
            dbQueries.revokeAllUserSessions(rawRefresh.sub, 'refresh_reuse_detected');
            try {
              dbQueries.createAuditLog({
                user_id: rawRefresh.sub,
                user_name: rawRefresh.name,
                user_role: rawRefresh.role,
                action: 'LOGIN',
                entity: 'AuthSession',
                entity_id: rawRefresh.nipp,
                details: `Deteksi penggunaan ulang refresh token untuk ${rawRefresh.name} (NIPP: ${rawRefresh.nipp}). Semua sesi dicabut.`,
                ip_address: getClientIp(req),
              });
            } catch {
              // ignore non-fatal audit error
            }
            const reuseResponse = NextResponse.json(
              { success: false, authenticated: false, user: null },
              { status: 401 }
            );
            clearSessionCookies(reuseResponse);
            return reuseResponse;
          }
        }

        const refreshPayload = await resolveSessionToken(refreshCookie, 'refresh');
        if (refreshPayload) {
          session = refreshPayload;
          shouldRotateCookies = true;
          rotatedFromJti = refreshPayload.jti;
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        { success: false, authenticated: false, user: null },
        { status: 401 }
      );
    }

    const dbUser =
      (await dbQueries.getUserById(session.sub)) ||
      (await dbQueries.getUserByNipp(session.nipp));

    if (!dbUser || !dbUser.active) {
      const unauthRes = NextResponse.json(
        { success: false, authenticated: false, user: null },
        { status: 401 }
      );
      clearSessionCookies(unauthRes);
      return unauthRes;
    }

    const safeUser = toSafeUser(dbUser);
    const systemParams = await dbQueries.getSystemParameters();

    const response = NextResponse.json({
      success: true,
      authenticated: true,
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
        jti: session.jti,
        iat: session.iat,
        exp: session.exp,
        timeoutMinutes: systemParams.session_timeout_minutes || 30,
      },
    });

    if (shouldRotateCookies) {
      // Rotate: invalidate the consumed refresh token before issuing a new pair.
      if (rotatedFromJti) {
        dbQueries.revokeAuthSession(rotatedFromJti, 'rotated');
      }
      await issueSessionCookies(
        response,
        safeUser,
        systemParams.session_timeout_minutes || 30,
        {
          ipAddress: getClientIp(req),
          userAgent: req.headers.get('user-agent') || undefined,
        }
      );
    } else if (wantsAccessRotation) {
      await issueAccessCookie(response, safeUser, systemParams.session_timeout_minutes || 30, {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || undefined,
      });
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat sesi pengguna.';
    return NextResponse.json(
      { success: false, authenticated: false, user: null, error: message },
      { status: 500 }
    );
  }
}
