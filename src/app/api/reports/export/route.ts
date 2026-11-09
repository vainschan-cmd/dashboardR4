import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { exportRecordsToExcel, generateTemplateWorkbook } from '@/lib/excelExporter';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'reports:export' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'data'; // 'data' or 'template'
    const rawBranchId = searchParams.get('branch_id') || undefined;
    const branch_id = enforceBranchFilterForRead(auth.session, rawBranchId);
    const department_id = searchParams.get('department_id') || undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const userRole = auth.session.role;

    if (type === 'template') {
      const templates = dbQueries.getTemplates();
      const targetTpl = (department_id ? templates.find(t => t.department_id === department_id) : templates[0]) || templates[0];
      const branches = dbQueries.getBranches();
      const indicators = dbQueries.getIndicators(targetTpl.department_id);

      const buffer = generateTemplateWorkbook(targetTpl, branches, indicators);
      const filename = `Template_${targetTpl.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: Export filtered records to Excel (scoped by branch for pic_cabang)
    const records = dbQueries.getMonthlyRecords({
      branch_id,
      department_id,
      month,
      year,
      verified_only: userRole === 'viewer',
    });

    const buffer = exportRecordsToExcel(records, 'Laporan_Kinerja_Pelabuhan');
    const periodStr = month && year ? `_${year}_${month}` : year ? `_${year}` : '';
    const filename = `Laporan_Eksekutif_Kinerja_Pelabuhan${periodStr}.xlsx`;

    // Audit log with verified JWT identity
    dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'EXPORT',
      entity: 'REPORT',
      details: `Ekspor data kinerja format Excel (.xlsx): ${records.length} baris data (Cabang: ${branch_id || 'ALL'}).`,
      ip_address: getClientIp(req),
    });

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
