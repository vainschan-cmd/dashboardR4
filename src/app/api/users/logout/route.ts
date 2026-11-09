import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { clearSessionCookies, getSessionFromRequest, getClientIp } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const clientIp = getClientIp(req);

    if (session) {
      try {
        dbQueries.createAuditLog({
          user_id: session.sub,
          user_name: session.name,
          user_role: session.role,
          action: 'LOGIN',
          entity: 'AuthSession',
          entity_id: session.nipp,
          details: `Sesi JWT diakhiri (Logout) oleh ${session.name} (NIPP: ${session.nipp}).`,
          ip_address: clientIp,
        });
      } catch {}
    }

    const response = NextResponse.json({
      success: true,
      message: 'Sesi pengguna telah diakhiri.',
    });

    clearSessionCookies(response);
    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { success: false, error: error.message || 'Gagal mengakhiri sesi.' },
      { status: 500 }
    );
    clearSessionCookies(response);
    return response;
  }
}

