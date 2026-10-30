import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;

    // Fetch records needing attention
    const pendingRecords = dbQueries.getMonthlyRecords({
      month,
      year,
      verification_status: 'pending_verification'
    });

    const revisionRecords = dbQueries.getMonthlyRecords({
      month,
      year,
      verification_status: 'revision_needed'
    });

    // Generate completeness summary matrix for the selected period
    const branches = dbQueries.getBranches();
    const departments = dbQueries.getDepartments();
    const allRecords = dbQueries.getMonthlyRecords({ month, year });

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
            records_count: 0
          };
        }
        const hasRevision = matching.some(r => r.verification_status === 'revision_needed');
        const hasPending = matching.some(r => r.verification_status === 'pending_verification');
        const hasDraft = matching.some(r => r.verification_status === 'draft');
        const allVerified = matching.every(r => r.verification_status === 'verified');

        const status = hasRevision ? 'revision_needed'
          : hasPending ? 'pending_verification'
          : hasDraft ? 'draft'
          : allVerified ? 'verified'
          : 'pending_verification';

        return {
          department_id: d.id,
          department_code: d.code,
          department_name: d.name,
          status,
          pic: d.pic_name,
          records_count: matching.length,
          last_updated: matching[0]?.uploaded_at
        };
      });

      return {
        branch_id: b.id,
        branch_code: b.code,
        branch_name: b.name,
        region: b.region,
        departments: deptStatuses
      };
    });

    return NextResponse.json({
      success: true,
      pendingCount: pendingRecords.length,
      revisionCount: revisionRecords.length,
      pendingRecords,
      revisionRecords,
      matrix
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordIds, status, verifierUsername, userRole, revisionNotes } = body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ success: false, message: 'ID record tidak valid' }, { status: 400 });
    }

    if (!['verified', 'revision_needed'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Status verifikasi hanya dapat berupa "verified" atau "revision_needed".' }, { status: 400 });
    }

    // Role check: Only admin_regional or super_admin can verify or request revisions
    if (userRole && !['admin_regional', 'super_admin'].includes(userRole)) {
      return NextResponse.json({
        success: false,
        message: 'Akses ditolak: Hanya Admin Regional atau Super Admin yang berhak memverifikasi atau meminta revisi data.'
      }, { status: 403 });
    }

    dbQueries.updateRecordVerification(recordIds, status, verifierUsername || 'adminreg', revisionNotes);

    const action = status === 'verified' ? 'APPROVE' : 'REVISE';
    const statusLabel = status === 'verified' ? 'Terverifikasi (Disetujui Resmi)' : 'Perlu Revisi';

    dbQueries.createAuditLog({
      user_id: verifierUsername || 'adminreg',
      user_name: verifierUsername || 'Admin Regional',
      user_role: userRole || 'admin_regional',
      action,
      entity: 'MONTHLY_RECORD',
      entity_id: recordIds.join(', '),
      details: `${statusLabel} untuk ${recordIds.length} data kinerja.${revisionNotes ? ` Catatan revisi: "${revisionNotes}"` : ''}`
    });

    return NextResponse.json({
      success: true,
      message: `Status berhasil diperbarui menjadi ${statusLabel}.`,
      updatedCount: recordIds.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
