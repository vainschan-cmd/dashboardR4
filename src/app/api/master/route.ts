import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, toSafeDbConfig, toSafeIntegrationCredentials, toSafeUser } from '@/lib/db';
import {
  requireAuth,
  hasPermission,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
} from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { session } = auth;
    const allBranches = dbQueries.getBranches();
    const scopedBranchCode = enforceBranchFilterForRead(session, undefined);
    const branches = scopedBranchCode
      ? allBranches.filter(
          b => b.code.toUpperCase() === scopedBranchCode.toUpperCase() || b.id === scopedBranchCode
        )
      : allBranches;

    const allDepartments = dbQueries.getDepartments();
    const scopedDeptId = enforceDepartmentFilterForRead(session, undefined);
    const departments = scopedDeptId
      ? allDepartments.filter(d => d.id === scopedDeptId)
      : allDepartments;

    const indicators = dbQueries.getIndicators(scopedDeptId);
    const equipment = dbQueries.getEquipmentCatalog();

    // Only expose user directory to roles with `users:read` permission
    const canReadUsers = hasPermission(session.role, 'users:read');
    const users = canReadUsers ? dbQueries.getUsers().map(toSafeUser) : [];

    // Only expose templates to roles with `templates:read` permission
    const canReadTemplates = hasPermission(session.role, 'templates:read');
    const allTemplates = canReadTemplates ? dbQueries.getTemplates() : [];
    const templates = scopedDeptId
      ? allTemplates.filter(t => t.department_id === scopedDeptId)
      : allTemplates;

    // Only expose sensitive system/database/integration configs to roles with `system_params:read`
    const canReadSystemParams = hasPermission(session.role, 'system_params:read');
    const gsheetsConfig = canReadSystemParams ? dbQueries.getGoogleSheetsConfig() : null;
    const dbConfig = canReadSystemParams ? toSafeDbConfig(dbQueries.getDbConfig()) : null;
    const credentials = canReadSystemParams
      ? toSafeIntegrationCredentials(dbQueries.getIntegrationCredentials())
      : null;

    // Non-sensitive session timeout/theme preferences needed by authenticated UI shell
    const rawSystemParams = dbQueries.getSystemParameters();
    const systemParams = {
      session_timeout_minutes: rawSystemParams.session_timeout_minutes,
      auto_logout_idle: rawSystemParams.auto_logout_idle,
      warning_before_minutes: rawSystemParams.warning_before_minutes,
      default_theme: rawSystemParams.default_theme,
    };

    return NextResponse.json({
      success: true,
      branches,
      departments,
      indicators,
      equipment,
      users,
      templates,
      gsheetsConfig,
      systemParams,
      dbConfig,
      credentials,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat master data.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
