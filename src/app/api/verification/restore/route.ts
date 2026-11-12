import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { dbQueries, getDb } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { parseWithSchema, restoreSnapshotSchema } from '@/lib/validation';
import { restoreVerifiedSnapshot, type SnapshotTable } from '@/lib/lineage';
import { logError } from '@/lib/logger';

/**
 * POST /api/verification/restore
 *
 * Reverts one module row to the values that were last approved (`DATA-05`).
 *
 * The snapshot exists because editing a verified row stores its approved values
 * before overwriting them. Without a way to restore, that copy is write-only: it
 * records what was approved but cannot be brought back, so a mistaken overwrite of
 * an official figure is unrecoverable.
 *
 * Deliberately explicit rather than automatic. An approver may genuinely prefer
 * the newly submitted numbers, so silently reverting would discard a correction.
 * Every restore is audited with the actor's NIPP.
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

    // The row must be inside the actor's branch scope; a snapshot restore rewrites
    // official figures, so it is a write for scoping purposes.
    const db = getDb();
    const scopeRow = db
      .prepare(`SELECT branch_code FROM ${table} WHERE id = ?`)
      .get(id) as { branch_code: string | null } | undefined;

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

    const result = restoreVerifiedSnapshot(db, {
      table: table as SnapshotTable,
      id,
      actorNipp: auth.session.nipp,
    });

    if (!result.restored) {
      return NextResponse.json(
        { success: false, error: result.reason ?? 'Snapshot tidak dapat dipulihkan.' },
        { status: 409 }
      );
    }

    dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'RESTORE_SNAPSHOT',
      entity: table.toUpperCase(),
      entity_id: id,
      details:
        `Memulihkan baris ${id} pada ${table} ke nilai terverifikasi terakhir. ` +
        `Kolom dipulihkan: ${result.fields.join(', ')}.`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Baris ${id} dipulihkan ke nilai terverifikasi terakhir (${result.fields.length} kolom).`,
      fields: result.fields,
    });
  } catch (error: unknown) {
    logError('api/verification/restore', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: 'Gagal memulihkan snapshot terverifikasi.' },
      { status: 500 }
    );
  }
}
