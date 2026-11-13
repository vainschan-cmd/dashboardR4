import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { dbQueries, toSafeUser } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { exportUsersToSpreadsheet, MASTER_USER_FILE } from '@/lib/userPicSync';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'users:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const rawUsers = await dbQueries.getUsers();
    const users = rawUsers.map(toSafeUser);
    const filePath = exportUsersToSpreadsheet(users);
    const fileBuffer = fs.readFileSync(filePath);

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

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${MASTER_USER_FILE}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengekspor data pengguna.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
