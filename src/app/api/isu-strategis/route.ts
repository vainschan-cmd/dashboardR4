import { NextRequest, NextResponse } from 'next/server';
import { isuStrategisRepository } from '@/lib/repositories/isuStrategis';
import { isuStrategisSchema, parseWithSchema } from '@/lib/validation';
import { resolveRequestSession } from '@/lib/rbac';
import { getClientIp } from '@/lib/auth';
import { dbQueries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = {
      cabang: searchParams.get('cabang') || undefined,
      kategori: searchParams.get('kategori') || undefined,
      prioritas: searchParams.get('prioritas') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('q') || searchParams.get('search') || undefined,
    };

    const data = await isuStrategisRepository.getAll(filter);
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error: unknown) {
    console.error('[GET /api/isu-strategis] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal memuat data isu strategis.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    const clientIp = getClientIp(req);

    // Verifikasi role jika ada sesi (viewer / BOD adalah read-only)
    if (session && session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Akun Viewer (BOD) hanya memiliki izin baca.' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseWithSchema(isuStrategisSchema, body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const author = session?.name || session?.sub || 'PIC_REGIONAL_4';
    const created = await isuStrategisRepository.create(parsed.data, author);

    // Rekam Audit Trail ke PostgreSQL
    try {
      await dbQueries.createAuditLog({
        user_id: session?.sub || 'user_pic',
        user_name: author,
        user_role: session?.role || 'pic',
        action: 'CREATE_MANUAL_DATA',
        entity: 'ISU_STRATEGIS',
        entity_id: created.id,
        details: `Menambahkan Isu Strategis baru: [${created.kode}] ${created.judul} (${created.cabangName}) - Prioritas: ${created.prioritas}.`,
        ip_address: clientIp,
      });
    } catch (auditErr) {
      console.warn('[POST /api/isu-strategis] Audit log non-fatal error:', auditErr);
    }

    return NextResponse.json(
      { success: true, message: 'Isu strategis berhasil ditambahkan ke database PostgreSQL.', data: created },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/isu-strategis] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal menyimpan isu strategis.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
