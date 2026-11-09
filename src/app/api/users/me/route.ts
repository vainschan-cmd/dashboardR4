import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import {
  getSessionFromRequest,
  verifyJwtToken,
  issueSessionCookies,
  clearSessionCookies,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    let session = await getSessionFromRequest(req);
    let shouldRotateCookies = false;

    // If access token is expired or missing, check HttpOnly refresh token
    if (!session) {
      const refreshCookie = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
      if (refreshCookie) {
        const refreshPayload = await verifyJwtToken(refreshCookie);
        if (refreshPayload && refreshPayload.type === 'refresh') {
          session = refreshPayload;
          shouldRotateCookies = true;
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
      dbQueries.getUserById(session.sub) ||
      dbQueries.getUserByNipp(session.nipp);

    if (!dbUser || !dbUser.active) {
      const unauthRes = NextResponse.json(
        { success: false, authenticated: false, user: null },
        { status: 401 }
      );
      clearSessionCookies(unauthRes);
      return unauthRes;
    }

    const safeUser = toSafeUser(dbUser);
    const systemParams = dbQueries.getSystemParameters();

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
      },
      session: {
        jti: session.jti,
        iat: session.iat,
        exp: session.exp,
        timeoutMinutes: systemParams.session_timeout_minutes || 30,
      },
    });

    if (shouldRotateCookies) {
      await issueSessionCookies(
        response,
        safeUser,
        systemParams.session_timeout_minutes || 30
      );
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, authenticated: false, user: null, error: error.message },
      { status: 500 }
    );
  }
}

