import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { verificationSchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const rawBranch = searchParams.get('branch_id') || undefined;
    const branch_id = enforceBranchFilterForRead(auth.session, rawBranch);

    // Fetch records needing attention (scoped by branch for pic_cabang)
    const pendingRecords = dbQueries.getMonthlyRecords({
      branch_id,
      month,
      year,
      verification_status: 'pending_verification',
    });

    const revisionRecords = dbQueries.getMonthlyRecords({
      branch_id,
      month,
      year,
      verification_status: 'revision_needed',
    });

    // Generate completeness summary matrix for the selected period
    const allBranches = dbQueries.getBranches();
    const branches = branch_id
      ? allBranches.filter(b => b.id === branch_id || b.code.toUpperCase() === branch_id.toUpperCase())
      : allBranches;
    const departments = dbQueries.getDepartments();
    const allRecords = dbQueries.getMonthlyRecords({ branch_id, month, year });

    const matrix = branches.map(b => {
      const deptStatuses = departments.map(d => {
        const matching = allRecords.filter(r => r.branch_id === b.id && r.department_id === d.id);
        if (matching.length === 0) {
          return {
            department_id: d.id,
            department_code: d.code,
            department_name: d.name,
            status: 'belum_upload' as const,
            pic: d.pic_name,
            records_count: 0,
          };
        }
        const hasRevision = matching.some(r => r.verification_status === 'revision_needed');
        const hasPending = matching.some(r => r.verification_status === 'pending_verification');
        const hasDraft = matching.some(r => r.verification_status === 'draft');
        const allVerified = matching.every(r => r.verification_status === 'verified');

        const status = hasRevision
          ? 'revision_needed'
          : hasPending
            ? 'pending_verification'
            : hasDraft
              ? 'draft'
              : allVerified
                ? 'verified'
                : 'pending_verification';

        return {
          department_id: d.id,
          department_code: d.code,
          department_name: d.name,
          status,
          pic: d.pic_name,
          records_count: matching.length,
          last_updated: matching[0]?.uploaded_at,
        };
      });

      return {
        branch_id: b.id,
        branch_code: b.code,
        branch_name: b.name,
        region: b.region,
        departments: deptStatuses,
      };
    });

    return NextResponse.json({
      success: true,
      pendingCount: pendingRecords.length,
      revisionCount: revisionRecords.length,
      pendingRecords,
      revisionRecords,
      matrix,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Server-side RBAC: Only super_admin or admin_regional can verify or request revisions
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = parseWithSchema(verificationSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error, error: parsed.error },
        { status: 400 }
      );
    }
    const { recordIds, status, revisionNotes } = parsed.data;

    // Four-Eyes Principle: Prevent self-approval of records uploaded by the same user
    const targetRecords = dbQueries.getMonthlyRecordsByIds(recordIds);
    const sessionNipp = auth.session.nipp.toLowerCase();
    const sessionName = auth.session.name.toLowerCase();

    const selfUploaded = targetRecords.find(r => {
      const uploader = String(r.uploaded_by || '').trim().toLowerCase();
      return uploader && (uploader === sessionNipp || uploader === sessionName);
    });

    if (selfUploaded) {
      return NextResponse.json(
        {
          success: false,
          message: `Prinsip Four-Eyes: Anda tidak dapat memverifikasi data (${selfUploaded.id}) yang Anda unggah sendiri.`,
          error: `Prinsip Four-Eyes: Anda tidak dapat memverifikasi data (${selfUploaded.id}) yang Anda unggah sendiri.`,
        },
        { status: 403 }
      );
    }

    dbQueries.updateRecordVerification(
      recordIds,
      status,
      auth.session.nipp,
      revisionNotes
    );

    const action = status === 'verified' ? 'APPROVE' : 'REVISE';
    const statusLabel = status === 'verified' ? 'Terverifikasi (Disetujui Resmi)' : 'Perlu Revisi';

    dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action,
      entity: 'MONTHLY_RECORD',
      entity_id: recordIds.join(', '),
      details: `${statusLabel} untuk ${recordIds.length} data kinerja oleh ${auth.session.name} (NIPP: ${auth.session.nipp}).${revisionNotes ? ` Catatan revisi: "${revisionNotes}"` : ''}`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Status verifikasi berhasil diperbarui menjadi ${statusLabel}.`,
      updatedCount: recordIds.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
