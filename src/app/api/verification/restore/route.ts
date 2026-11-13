import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { dbQueries, query } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { parseWithSchema, restoreSnapshotSchema } from '@/lib/validation';
import { SNAPSHOT_TABLES } from '@/lib/lineage';
import { logError } from '@/lib/logger';

const ALLOWED_TABLES = new Set<string>(SNAPSHOT_TABLES);

/**
 * POST /api/verification/restore
 *
 * Memulihkan baris modul ke nilai snapshot yang terakhir diverifikasi (DATA-05)
 * langsung di database PostgreSQL ed_dashboard.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'verification:approve' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = parseWithSchema(restoreSnapshotSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const { table, id } = parsed.data;

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json(
        { success: false, error: `Tabel ${table} tidak didukung untuk pemulihan snapshot.` },
        { status: 400 }
      );
    }

    const scopeRes = await query<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    );
    const scopeRow = scopeRes.rows[0];

    if (!scopeRow) {
      return NextResponse.json(
        { success: false, error: `Baris ${id} tidak ditemukan pada ${table}.` },
        { status: 404 }
      );
    }

    const scopedBranch = enforceBranchFilterForRead(auth.session, undefined);
    if (scopedBranch && String(scopeRow.branch_code || '').toUpperCase() !== scopedBranch.toUpperCase()) {
      return NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: baris ini milik cabang ${scopeRow.branch_code}, di luar cakupan Anda.`,
        },
        { status: 403 }
      );
    }

    const rawSnapshot = scopeRow.verified_snapshot_json;
    if (!rawSnapshot) {
      return NextResponse.json(
        { success: false, error: 'Baris ini tidak memiliki snapshot terverifikasi yang dapat dipulihkan.' },
        { status: 409 }
      );
    }

    let snapshot: Record<string, unknown>;
    try {
      snapshot =
        typeof rawSnapshot === 'string'
          ? (JSON.parse(rawSnapshot) as Record<string, unknown>)
          : (rawSnapshot as Record<string, unknown>);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Snapshot rusak dan tidak dapat dibaca.' },
        { status: 409 }
      );
    }

    const fields = Object.keys(snapshot).filter((key) => key in scopeRow && key !== 'id');
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Snapshot tidak memuat kolom yang dapat dipulihkan.' },
        { status: 409 }
      );
    }

    const setClauses = fields.map((field, idx) => `"${field}" = $${idx + 1}`).join(', ');
    const values = fields.map((field) => snapshot[field]);
    const nextIdx = fields.length + 1;

    await query(
      `UPDATE ${table}
       SET ${setClauses},
           verification_status = 'verified',
           verified_by = $${nextIdx},
           verified_at = $${nextIdx + 1},
           verified_snapshot_json = NULL
       WHERE id = $${nextIdx + 2}`,
      [...values, auth.session.nipp, new Date().toISOString(), id]
    );

    await dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'RESTORE_SNAPSHOT',
      entity: table.toUpperCase(),
      entity_id: id,
      details:
        `Memulihkan baris ${id} pada ${table} ke nilai terverifikasi terakhir. ` +
        `Kolom dipulihkan: ${fields.join(', ')}.`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Baris ${id} dipulihkan ke nilai terverifikasi terakhir (${fields.length} kolom).`,
      fields,
    });
  } catch (error: unknown) {
    logError('api/verification/restore', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: 'Gagal memulihkan snapshot terverifikasi.' },
      { status: 500 }
    );
  }
}
