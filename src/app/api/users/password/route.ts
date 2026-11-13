import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import {
  clearSessionCookies,
  getClientIp,
  issueSessionCookies,
} from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import {
  changePasswordSchema,
  adminResetPasswordSchema,
  parseWithSchema,
} from '@/lib/validation';
import { authorize } from '@/lib/policy';

/**
 * POST /api/users/password
 *
 * Two modes, decided strictly by the authenticated session (never by client intent):
 *
 * 1. Self-service change — any authenticated user changes their own password.
 *    Body: { currentPassword, newPassword, confirmPassword }
 *
 * 2. Administrative reset — requires `users:manage` and targets another account.
 *    Body: { userId, newPassword, requireChangeOnNextLogin }
 *
 * In both cases every existing session of the affected account is revoked. For a
 * self-service change the caller immediately receives a fresh session so they are
 * not logged out of the tab they are using.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;

  const clientIp = getClientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Format permintaan tidak valid.' },
      { status: 400 }
    );
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const isAdminResetRequest =
    typeof payload.userId === 'string' && payload.userId.trim().length > 0;

  if (!isAdminResetRequest) {
    return handleSelfChange(req, payload, auth.session, clientIp);
  }

  // --- Administrative reset ------------------------------------------------
  const resetAuth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!resetAuth.authorized) return resetAuth.response;

  const parsed = parseWithSchema(adminResetPasswordSchema, payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const target = await dbQueries.getUserById(parsed.data.userId);
  if (!target) {
    return NextResponse.json(
      { success: false, error: 'Akun pengguna tidak ditemukan.' },
      { status: 404 }
    );
  }

  // Protected-account and self-target rules live in the centralised policy so
  // every administrative action applies them identically.
  const decision = authorize(
    {
      sub: auth.session.sub,
      role: auth.session.role,
      branch_id: auth.session.branch_id,
      department_id: auth.session.department_id,
      nipp: auth.session.nipp,
    },
    'user:reset_password',
    { targetUser: { id: target.id, role: target.role } }
  );
  if (!decision.allowed) {
    // Self-target is a usage error (400); a protected account is a denial (403).
    const status = decision.code === 'cannot_target_self' ? 400 : 403;
    return NextResponse.json(
      { success: false, error: decision.reason, code: decision.code },
      { status }
    );
  }

  try {
    await dbQueries.setUserPasswordAsync(target.id, parsed.data.newPassword, {
      mustChangePassword: parsed.data.requireChangeOnNextLogin,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mereset kata sandi.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  try {
    await dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'CONFIG_UPDATE',
      entity: 'UserAccount',
      entity_id: target.nipp,
      details: `Reset kata sandi akun ${target.name} (NIPP: ${target.nipp}) oleh ${auth.session.name}. Wajib ganti pada login berikutnya: ${parsed.data.requireChangeOnNextLogin ? 'ya' : 'tidak'}. Semua sesi akun tersebut dicabut.`,
      ip_address: clientIp,
    });
  } catch {
    // audit failure must not block the reset
  }

  return NextResponse.json({
    success: true,
    message: `Kata sandi ${target.name} (NIPP: ${target.nipp}) telah direset. Semua sesi akun tersebut telah dicabut.`,
  });
}

async function handleSelfChange(
  req: NextRequest,
  payload: Record<string, unknown>,
  session: { sub: string; nipp: string; name: string; role: string },
  clientIp: string
): Promise<NextResponse> {
  const parsed = parseWithSchema(changePasswordSchema, {
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
    confirmPassword: payload.confirmPassword,
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const user = await dbQueries.getUserById(session.sub);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Akun tidak ditemukan.' },
      { status: 404 }
    );
  }

  if (!(await dbQueries.verifyUserPasswordAsync(user.id, parsed.data.currentPassword))) {
    try {
      dbQueries.createAuditLog({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action: 'CONFIG_UPDATE',
        entity: 'UserAccount',
        entity_id: user.nipp,
        details: `Percobaan ubah kata sandi gagal: kata sandi saat ini tidak cocok (${user.name}, NIPP: ${user.nipp}).`,
        ip_address: clientIp,
      });
    } catch {
      // ignore non-fatal audit error
    }
    return NextResponse.json(
      { success: false, error: 'Kata sandi saat ini tidak sesuai.' },
      { status: 401 }
    );
  }

  try {
    await dbQueries.setUserPasswordAsync(user.id, parsed.data.newPassword, { mustChangePassword: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengubah kata sandi.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  // Refresh the caller's own session (all previous tokens were just revoked).
  const updated = await dbQueries.getUserById(user.id);
  const response = NextResponse.json({
    success: true,
    message: 'Kata sandi berhasil diperbarui. Sesi lain Anda telah diakhiri.',
  });

  if (updated) {
    const systemParams = await dbQueries.getSystemParameters();
    await issueSessionCookies(
      response,
      updated,
      systemParams.session_timeout_minutes || 30,
      { ipAddress: clientIp, userAgent: req.headers.get('user-agent') || undefined }
    );
  } else {
    clearSessionCookies(response);
  }

  try {
    await dbQueries.createAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action: 'CONFIG_UPDATE',
      entity: 'UserAccount',
      entity_id: user.nipp,
      details: `Kata sandi diperbarui oleh ${user.name} (NIPP: ${user.nipp}). Sesi lain dicabut.`,
      ip_address: clientIp,
    });
  } catch {
    // ignore non-fatal audit error
  }

  return response;
}
