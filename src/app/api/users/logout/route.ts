import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import {
  clearSessionCookies,
  getSessionFromRequest,
  getClientIp,
  readRefreshTokenCookie,
  resolveSessionToken,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const clientIp = getClientIp(req);

    // Revoke the access token session itself.
    if (session) {
      dbQueries.revokeAuthSession(session.jti, 'logout');
    }

    // Also revoke the refresh token presented with this request, so logout is terminal.
    const refreshCookie = readRefreshTokenCookie(req);
    if (refreshCookie) {
      const refreshPayload = await resolveSessionToken(refreshCookie, 'refresh');
      if (refreshPayload) {
        dbQueries.revokeAuthSession(refreshPayload.jti, 'logout');
      }
    }

    if (session) {
      try {
        await dbQueries.createAuditLog({
          user_id: session.sub,
          user_name: session.name,
          user_role: session.role,
          action: 'LOGIN',
          entity: 'AuthSession',
          entity_id: session.nipp,
          details: `Sesi JWT diakhiri (Logout) oleh ${session.name} (NIPP: ${session.nipp}).`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Sesi pengguna telah diakhiri.',
    });

    clearSessionCookies(response);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengakhiri sesi.';
    const response = NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
    clearSessionCookies(response);
    return response;
  }
}
