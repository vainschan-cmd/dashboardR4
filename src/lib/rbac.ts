import { NextRequest, NextResponse } from 'next/server';
import type { User, UserRole } from './types';
import { getSessionFromRequest, type JwtSessionPayload } from './auth';
import {
  getCanonicalBranchCode,
  getBranchByCode,
  getBranchById,
} from './constants';

export type Permission =
  | 'dashboard:read'
  | 'records:read'
  | 'reports:export'
  | 'manual_input:write'
  | 'import:write'
  | 'verification:read'
  | 'verification:approve'
  | 'templates:read'
  | 'templates:manage'
  | 'users:read'
  | 'users:manage'
  | 'master_data:read'
  | 'master_data:manage'
  | 'system_params:read'
  | 'system_params:manage'
  | 'audit_logs:read';

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: [
    'dashboard:read',
    'records:read',
    'reports:export',
    'manual_input:write',
    'import:write',
    'verification:read',
    'verification:approve',
    'templates:read',
    'templates:manage',
    'users:read',
    'users:manage',
    'master_data:read',
    'master_data:manage',
    'system_params:read',
    'system_params:manage',
    'audit_logs:read',
  ],
  admin_regional: [
    'dashboard:read',
    'records:read',
    'reports:export',
    'manual_input:write',
    'import:write',
    'verification:read',
    'verification:approve',
    'templates:read',
    'templates:manage',
    'users:read',
    'users:manage',
    'master_data:read',
    'master_data:manage',
    'system_params:read',
    'audit_logs:read',
  ],
  pic_dept_regional: [
    'dashboard:read',
    'records:read',
    'reports:export',
    'manual_input:write',
    'import:write',
    'verification:read',
    'templates:read',
    'master_data:read',
  ],
  pic_cabang: [
    'dashboard:read',
    'records:read',
    'reports:export',
    'manual_input:write',
    'import:write',
    'verification:read',
    'templates:read',
    'master_data:read',
  ],
  viewer: [
    'dashboard:read',
    'records:read',
    'reports:export',
    'master_data:read',
  ],
};

function extractRole(userOrRole?: User | JwtSessionPayload | UserRole | string | null): UserRole | null {
  if (!userOrRole) return null;
  const rawRole = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  if (
    rawRole === 'super_admin' ||
    rawRole === 'admin_regional' ||
    rawRole === 'pic_dept_regional' ||
    rawRole === 'pic_cabang' ||
    rawRole === 'viewer'
  ) {
    return rawRole;
  }
  return null;
}

export function hasPermission(
  userOrRole: User | JwtSessionPayload | UserRole | string | null | undefined,
  permission: Permission
): boolean {
  const role = extractRole(userOrRole);
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Pure role-based check for BOD / Executive Viewer (replaces string matching on name or NIPP).
 */
export function isExecutiveViewer(
  userOrRole?: User | JwtSessionPayload | UserRole | string | null
): boolean {
  return extractRole(userOrRole) === 'viewer';
}

export function canManageUsersRole(
  userOrRole?: User | JwtSessionPayload | UserRole | string | null
): boolean {
  return hasPermission(userOrRole, 'users:manage');
}

export function canVerifyDataRole(
  userOrRole?: User | JwtSessionPayload | UserRole | string | null
): boolean {
  return hasPermission(userOrRole, 'verification:approve');
}

export function isPicCabangRole(
  userOrRole?: User | JwtSessionPayload | UserRole | string | null
): boolean {
  return extractRole(userOrRole) === 'pic_cabang';
}

/**
 * Resolve any branch identifier (code 'R01', id 'term_makassar', or name 'Makassar') into both canonical code & DB id.
 */
export function resolveBranchIdentity(rawBranch?: string | null): { code: string; id: string; name: string } | null {
  if (!rawBranch) return null;
  const trimmed = String(rawBranch).trim();
  if (!trimmed || trimmed.toUpperCase() === 'ALL' || trimmed.toUpperCase() === 'NONE') {
    return null;
  }

  const byId = getBranchById(trimmed);
  if (byId) {
    return { code: byId.code, id: byId.id, name: byId.name };
  }

  const byCode = getBranchByCode(trimmed);
  if (byCode) {
    return { code: byCode.code, id: byCode.id, name: byCode.name };
  }

  const canonical = getCanonicalBranchCode(trimmed, trimmed);
  if (canonical) {
    const found = getBranchByCode(canonical);
    if (found) {
      return { code: found.code, id: found.id, name: found.name };
    }
  }

  return null;
}

/**
 * Extract active JWT session from request (checking both access token and refresh token fallback).
 */
/**
 * Extract the active ACCESS session from a request.
 *
 * Refresh tokens are deliberately NOT accepted here: a refresh token may only be
 * exchanged at `/api/users/me`. Accepting it for general API access would defeat
 * the short access-token lifetime and make revocation ambiguous.
 */
export async function resolveRequestSession(req: NextRequest): Promise<JwtSessionPayload | null> {
  return getSessionFromRequest(req);
}

/**
 * Guard helper for Next.js Route Handlers.
 * Verifies JWT authentication and checks allowedRoles / requiredPermission.
 */
export async function requireAuth(
  req: NextRequest,
  options?: {
    allowedRoles?: UserRole[];
    requiredPermission?: Permission;
  }
): Promise<
  | { authorized: true; session: JwtSessionPayload }
  | { authorized: false; response: NextResponse }
> {
  const session = await resolveRequestSession(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login kembali.',
          message: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login kembali.',
        },
        { status: 401 }
      ),
    };
  }

  if (options?.allowedRoles && !options.allowedRoles.includes(session.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: Role "${session.role}" tidak memiliki otorisasi untuk operasi ini.`,
          message: `Akses ditolak: Role "${session.role}" tidak memiliki otorisasi untuk operasi ini.`,
        },
        { status: 403 }
      ),
    };
  }

  if (options?.requiredPermission && !hasPermission(session.role, options.requiredPermission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: Anda tidak memiliki izin "${options.requiredPermission}".`,
          message: `Akses ditolak: Anda tidak memiliki izin "${options.requiredPermission}".`,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}

/**
 * Row-Level Security (ABAC) for READ endpoints:
 * If the user is a `pic_cabang` assigned to a specific branch (not R99), force the branch filter to their assigned branch.
 */
export function enforceBranchFilterForRead(
  session: JwtSessionPayload | null,
  requestedBranch?: string | null
): string | undefined {
  if (session && session.role === 'pic_cabang' && session.branch_id && session.branch_id !== 'R99') {
    const resolved = resolveBranchIdentity(session.branch_id);
    return resolved ? resolved.code : session.branch_id;
  }
  return requestedBranch || undefined;
}

/**
 * Row-Level Security (ABAC) for Department-scoped READ endpoints:
 * If the user is a `pic_dept_regional` assigned to a specific department, force the department filter to their assigned department.
 */
export function enforceDepartmentFilterForRead(
  session: JwtSessionPayload | null,
  requestedDepartmentId?: string | null
): string | undefined {
  if (session && session.role === 'pic_dept_regional' && session.department_id) {
    return session.department_id;
  }
  return requestedDepartmentId || undefined;
}

/**
 * Row-Level Security (ABAC) for Verification status on READ endpoints:
 * If the user is a `viewer` (BOD / Executive Viewer), strictly force `verifiedOnly = true` even if query params are manipulated.
 */
export function enforceVerificationFilterForRead(
  session: JwtSessionPayload | null,
  requestedVerifiedOnly?: boolean | string | null
): boolean {
  if (session && session.role === 'viewer') {
    return true;
  }
  if (typeof requestedVerifiedOnly === 'boolean') {
    return requestedVerifiedOnly;
  }
  return requestedVerifiedOnly === 'true';
}

/**
 * Row-Level Security (ABAC) for verification_status string filter on READ endpoints:
 * If the user is a `viewer`, force status to `'verified'`.
 */
export function enforceVerificationStatusFilterForRead(
  session: JwtSessionPayload | null,
  requestedStatus?: string | null
): string | undefined {
  if (session && session.role === 'viewer') {
    return 'verified';
  }
  return requestedStatus || undefined;
}

const VALID_DEPARTMENT_IDS = new Set(['dept_ops', 'dept_keu', 'dept_sdm', 'dept_tek', 'dept_kom']);

/**
 * Match a whole word inside free text.
 *
 * Substring matching on short tokens is actively wrong in Indonesian: `"ti"`
 * appears inside "peTIkemas", "informasi aktivitas", "kualiTas", etc., so a
 * substring check routed terminal-operations users to the engineering
 * department. Word boundaries keep `"Divisi TI"` working without swallowing
 * unrelated words.
 */
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function hasAnyWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => hasWord(text, word));
}

export function resolveDepartmentFromText(
  rawDeptId?: string | null,
  divisi?: string | null,
  departemen?: string | null
): string | null {
  if (rawDeptId && VALID_DEPARTMENT_IDS.has(rawDeptId.trim())) {
    return rawDeptId.trim();
  }
  const combined = `${divisi || ''} ${departemen || ''}`.toLowerCase();

  if (hasAnyWord(combined, ['keuangan', 'akuntansi', 'finansial', 'finance'])) {
    return 'dept_keu';
  }
  if (hasAnyWord(combined, ['sdm', 'umum', 'hr', 'personalia']) || combined.includes('sumber daya')) {
    return 'dept_sdm';
  }
  // Operations is checked before engineering: "Terminal Petikemas" belongs to
  // operations even though it reads like equipment work.
  if (hasAnyWord(combined, ['operasi', 'terminal', 'kapal', 'pelayanan'])) {
    return 'dept_ops';
  }
  if (
    hasAnyWord(combined, ['teknik', 'teknologi', 'peralatan', 'fasilitas', 'ti', 'it', 'engineering']) ||
    combined.includes('teknologi informasi')
  ) {
    return 'dept_tek';
  }
  if (hasAnyWord(combined, ['komersial', 'pemasaran', 'pengembangan', 'commercial'])) {
    return 'dept_kom';
  }
  return rawDeptId && VALID_DEPARTMENT_IDS.has(rawDeptId) ? rawDeptId : 'dept_ops';
}

/**
 * Server-side rule enforcement for user role, branch_id, and department_id assignment.
 */
export function resolveServerAssignedUserScope(input: {
  role?: UserRole;
  branch_id?: string | null;
  department_id?: string | null;
  divisi?: string | null;
  departemen?: string | null;
  isPublicSelfRegistration?: boolean;
}): { role: UserRole; branch_id: string; department_id: string | null } {
  // Public self-registration (when enabled) can never self-assign elevated roles
  const effectiveRole: UserRole = input.isPublicSelfRegistration
    ? 'pic_cabang'
    : input.role || 'pic_cabang';

  const resolvedDept = resolveDepartmentFromText(input.department_id, input.divisi, input.departemen);

  if (effectiveRole === 'viewer') {
    return { role: 'viewer', branch_id: 'R99', department_id: null };
  }

  if (effectiveRole === 'super_admin' || effectiveRole === 'admin_regional') {
    return { role: effectiveRole, branch_id: 'R99', department_id: resolvedDept };
  }

  if (effectiveRole === 'pic_dept_regional') {
    return { role: 'pic_dept_regional', branch_id: 'R99', department_id: resolvedDept || 'dept_ops' };
  }

  // pic_cabang: resolve branch against official branches or infer from departemen/divisi text
  const directBranch = resolveBranchIdentity(input.branch_id);
  if (directBranch) {
    return { role: 'pic_cabang', branch_id: directBranch.code, department_id: resolvedDept };
  }
  const inferredBranch = resolveBranchIdentity(`${input.departemen || ''} ${input.divisi || ''}`);
  return {
    role: 'pic_cabang',
    branch_id: inferredBranch ? inferredBranch.code : 'R01',
    department_id: resolvedDept,
  };
}

/**
 * Row-Level Security (ABAC) for WRITE endpoints (Manual Input & Spreadsheet Commit):
 * Verify that `pic_cabang` only writes to their assigned `branch_id`.
 */
export function validateBranchWriteAccess(
  session: JwtSessionPayload,
  targetBranchRaw?: string | null
): { allowed: boolean; canonicalCode: string; branchId: string; error?: string } {
  if (session.role === 'viewer') {
    return {
      allowed: false,
      canonicalCode: '',
      branchId: '',
      error: 'Akses ditolak: Role Viewer (BOD) hanya memiliki akses baca.',
    };
  }

  const targetResolved = resolveBranchIdentity(targetBranchRaw);

  if (session.role === 'pic_cabang' && session.branch_id && session.branch_id !== 'R99') {
    const assignedResolved = resolveBranchIdentity(session.branch_id);
    const assignedCode = assignedResolved ? assignedResolved.code : session.branch_id.toUpperCase();
    const assignedId = assignedResolved ? assignedResolved.id : session.branch_id;

    if (!targetResolved) {
      return {
        allowed: true,
        canonicalCode: assignedCode,
        branchId: assignedId,
      };
    }

    if (targetResolved.code !== assignedCode && targetResolved.id !== assignedId) {
      return {
        allowed: false,
        canonicalCode: assignedCode,
        branchId: assignedId,
        error: `Akses ditolak: Sebagai PIC Cabang [${assignedCode}], Anda tidak diizinkan mengubah data cabang [${targetResolved.code}] ${targetResolved.name}.`,
      };
    }

    return {
      allowed: true,
      canonicalCode: assignedCode,
      branchId: assignedId,
    };
  }

  return {
    allowed: true,
    canonicalCode: targetResolved?.code || String(targetBranchRaw || 'R01').toUpperCase(),
    branchId: targetResolved?.id || String(targetBranchRaw || 'term_makassar'),
  };
}

/**
 * Row-Level Security (ABAC) for Department-scoped WRITE endpoints:
 * Verify that `pic_dept_regional` only writes to their assigned `department_id` when a department is specified.
 */
export function validateDepartmentWriteAccess(
  session: JwtSessionPayload,
  targetDepartmentId?: string | null
): { allowed: boolean; effectiveDepartmentId: string | null; error?: string } {
  if (session.role === 'pic_dept_regional' && session.department_id) {
    if (targetDepartmentId && targetDepartmentId !== session.department_id) {
      return {
        allowed: false,
        effectiveDepartmentId: session.department_id,
        error: `Akses ditolak: Sebagai PIC Departemen (${session.department_id}), Anda tidak diizinkan mengirim data untuk departemen (${targetDepartmentId}).`,
      };
    }
    return {
      allowed: true,
      effectiveDepartmentId: session.department_id,
    };
  }

  return {
    allowed: true,
    effectiveDepartmentId: targetDepartmentId || session.department_id || null,
  };
}

