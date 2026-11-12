import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import {
  requireAuth,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
  resolveBranchIdentity,
} from '@/lib/rbac';
import { verificationSchema, parseWithSchema } from '@/lib/validation';
import { checkSeparationOfDuties, fourEyesMessage } from '@/lib/fourEyes';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'verification:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const rawBranch = searchParams.get('branch_id') || undefined;
    const rawDept = searchParams.get('department_id') || undefined;
    const branch_id = enforceBranchFilterForRead(auth.session, rawBranch);
    const department_id = enforceDepartmentFilterForRead(auth.session, rawDept);

    const pendingRecords = dbQueries.getMonthlyRecords({
      branch_id,
      department_id,
      month,
      year,
      verification_status: 'pending_verification',
    });

    const revisionRecords = dbQueries.getMonthlyRecords({
      branch_id,
      department_id,
      month,
      year,
      verification_status: 'revision_needed',
    });

    const allBranches = dbQueries.getBranches();
    const branches = branch_id
      ? allBranches.filter(b => b.id === branch_id || b.code.toUpperCase() === branch_id.toUpperCase())
      : allBranches;
    const allDepartments = dbQueries.getDepartments();
    const departments = department_id
      ? allDepartments.filter(d => d.id === department_id)
      : allDepartments;
    const allRecords = dbQueries.getMonthlyRecords({ branch_id, department_id, month, year });

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat status verifikasi.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'verification:approve' });
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

    // Every requested ID must exist: reject partially-valid batches atomically.
    if (targetRecords.length !== new Set(recordIds).size) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sebagian ID rekaman tidak ditemukan. Tidak ada data yang diubah.',
          error: 'Sebagian ID rekaman tidak ditemukan.',
        },
        { status: 404 }
      );
    }

    // Row-level scope: admin_regional/super_admin are regional, PIC roles stay inside their scope.
    const scopedBranch = enforceBranchFilterForRead(auth.session, undefined);
    const scopedDept = enforceDepartmentFilterForRead(auth.session, undefined);
    const allowedBranchIdentities = new Set<string>();
    if (scopedBranch) {
      allowedBranchIdentities.add(scopedBranch.toUpperCase());
      const resolved = resolveBranchIdentity(scopedBranch);
      if (resolved) {
        allowedBranchIdentities.add(resolved.id.toUpperCase());
        allowedBranchIdentities.add(resolved.code.toUpperCase());
      }
    }

    const outOfScope = targetRecords.find((record) => {
      if (allowedBranchIdentities.size > 0) {
        const branch = String(record.branch_id || '').toUpperCase();
        if (!allowedBranchIdentities.has(branch)) return true;
      }
      if (scopedDept && String(record.department_id || '') !== scopedDept) {
        return true;
      }
      return false;
    });

    if (outOfScope) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak: terdapat rekaman di luar cabang/departemen penugasan Anda.',
          error: 'Akses ditolak: terdapat rekaman di luar cakupan Anda.',
        },
        { status: 403 }
      );
    }

    // Only records awaiting a decision may be verified or sent back for revision.
    const invalidState = targetRecords.find(
      (record) =>
        record.verification_status !== 'pending_verification' &&
        record.verification_status !== 'revision_needed'
    );
    if (invalidState) {
      return NextResponse.json(
        {
          success: false,
          message: `Rekaman ${invalidState.id} berstatus "${invalidState.verification_status}" dan tidak dapat diproses.`,
          error: 'Status rekaman tidak valid untuk operasi verifikasi.',
        },
        { status: 409 }
      );
    }

    // Four-eyes check across the whole chain (`RBAC-14`): the actor must not be
    // the uploader on the monthly record *or* on any of the module rows that
    // belong to it. Checking only the parent record let a manual-input user
    // approve module rows they had written themselves.
    const moduleUploaders = dbQueries.getModuleUploadersByRecordIds(recordIds);
    const uploaderValues = [
      ...targetRecords.map((record) => record.uploaded_by),
      ...moduleUploaders,
    ];
    const separation = checkSeparationOfDuties(
      { nipp: auth.session.nipp, name: auth.session.name, sub: auth.session.sub },
      { uploaders: uploaderValues }
    );

    if (!separation.allowed) {
      // Name the record so support can find it without asking the user to describe
      // which row was rejected.
      const conflictLower = separation.conflict.uploader.toLowerCase();
      const owningRecord = targetRecords.find(
        (record) => String(record.uploaded_by || '').trim().toLowerCase() === conflictLower
      );
      const message = fourEyesMessage(separation.conflict, owningRecord?.id);
      return NextResponse.json(
        { success: false, message, error: message, code: 'four_eyes_violation' },
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
      message: `${recordIds.length} data telah diubah menjadi ${statusLabel}.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memproses verifikasi.';
    return NextResponse.json(
      { success: false, message: `Gagal memproses verifikasi: ${message}` },
      { status: 500 }
    );
  }
}
