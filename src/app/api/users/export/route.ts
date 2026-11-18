import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeUser } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { logError } from '@/lib/logger';
import { buildUsersWorkbookBuffer, MASTER_USER_FILE } from '@/lib/userPicSync';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const rawUsers = await dbQueries.getUsers();
    const users = rawUsers.map(toSafeUser);
    // SA-13 / SA-22: Stream workbook purely from memory without mutating local/Downloads disk on GET.
    const fileBuffer = buildUsersWorkbookBuffer(users);

    try {
      await dbQueries.createAuditLog({
        user_id: auth.session.sub,
        user_name: auth.session.name,
        user_role: auth.session.role,
        action: 'EXPORT',
        entity: 'USER',
        entity_id: MASTER_USER_FILE,
        details: `Mengekspor daftar pengguna (${users.length} akun) ke spreadsheet oleh ${auth.session.name} (NIPP: ${auth.session.nipp}).`,
        ip_address: getClientIp(req),
      });
    } catch {
      // ignore non-fatal audit error
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${MASTER_USER_FILE}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    logError('api/users/export', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json({ success: false, error: 'Gagal mengekspor data pengguna.' }, { status: 500 });
  }
}
