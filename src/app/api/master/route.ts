import { NextRequest, NextResponse } from 'next/server';
import { toSafeDbConfig, toSafeIntegrationCredentials, toSafeUser } from '@/lib/db';
import { masterRepository } from '@/lib/repositories/master';
import { usersRepository } from '@/lib/repositories/users';
import { settingsRepository } from '@/lib/repositories/settings';
import {
  requireAuth,
  hasPermission,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
} from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'master_data:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { session } = auth;
    const allBranches = await masterRepository.getBranches();
    const scopedBranchCode = enforceBranchFilterForRead(session, undefined);
    const branches = scopedBranchCode
      ? allBranches.filter(
          b => b.code.toUpperCase() === scopedBranchCode.toUpperCase() || b.id === scopedBranchCode
        )
      : allBranches;

    const allDepartments = await masterRepository.getDepartments();
    const scopedDeptId = enforceDepartmentFilterForRead(session, undefined);
    const departments = scopedDeptId
      ? allDepartments.filter(d => d.id === scopedDeptId)
      : allDepartments;

    const indicators = await masterRepository.getIndicators(scopedDeptId);
    const equipment = await masterRepository.getEquipmentCatalog();

    // Only expose user directory to roles with `users:read` permission
    const canReadUsers = hasPermission(session.role, 'users:read');
    const users = canReadUsers ? (await usersRepository.getUsers()).map(toSafeUser) : [];

    // Only expose templates to roles with `templates:read` permission
    const canReadTemplates = hasPermission(session.role, 'templates:read');
    const allTemplates = canReadTemplates ? await masterRepository.getTemplates() : [];
    const templates = scopedDeptId
      ? allTemplates.filter(t => t.department_id === scopedDeptId)
      : allTemplates;

    // Only expose sensitive system/database/integration configs to roles with `system_params:read`
    const canReadSystemParams = hasPermission(session.role, 'system_params:read');
    const gsheetsConfig = canReadSystemParams ? await settingsRepository.getGoogleSheetsConfig() : null;
    const dbConfig = canReadSystemParams ? toSafeDbConfig(settingsRepository.getDbConfig()) : null;
    const credentials = canReadSystemParams
      ? await toSafeIntegrationCredentials(await settingsRepository.getIntegrationCredentials())
      : null;

    // Non-sensitive session timeout/theme preferences needed by authenticated UI shell
    const rawSystemParams = await settingsRepository.getSystemParameters();
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
