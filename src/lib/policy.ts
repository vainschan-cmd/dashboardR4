import type { UserRole } from './types';
import { hasPermission, type Permission } from './rbac';

/**
 * Centralised authorization policy (RBAC-05).
 *
 * Why this module exists
 * ----------------------
 * Permission checks used to live in three places: `ROLE_PERMISSIONS` (coarse
 * role→permission), the proxy's route table, and ad-hoc `role === 'super_admin'`
 * comparisons sprinkled through individual route handlers. The duplicated
 * comparisons were the dangerous part: five copies of "only a Super Admin may
 * touch a Super Admin" meant five chances to forget the rule in a new endpoint.
 *
 * Every handler that needs a decision more specific than "does this role hold
 * permission X" calls `authorize()` here instead of comparing roles inline. The
 * result carries a machine-readable `code` (for logging/tests) and a
 * user-facing `reason` (Indonesian, ready to return in an API error body).
 *
 * This module is pure: it takes a session-like object and returns a decision.
 * No database access, no request access, so it is exhaustively unit-testable.
 */

/** Session shape needed for policy decisions (subset of `JwtSessionPayload`). */
export interface PolicyActor {
  sub?: string;
  role: UserRole | string;
  branch_id?: string | null;
  department_id?: string | null;
  nipp?: string;
}

/** The account being acted upon, when the action targets a specific user. */
export interface PolicyTarget {
  id?: string;
  role?: UserRole | string | null;
  branch_id?: string | null;
}

export interface PolicyContext {
  /** Account being modified, for actions that target a user. */
  targetUser?: PolicyTarget | null;
  /** Branch the request wants to read or write. */
  targetBranch?: string | null;
  /** Department the request wants to read or write. */
  targetDepartment?: string | null;
  /**
   * Whether the request changes something that grants privilege or moves data
   * between security boundaries (DB path, credentials, role assignment).
   */
  isPrivilegeSensitive?: boolean;
}

export type PolicyCode =
  | 'ok'
  | 'no_actor'
  | 'unknown_role'
  | 'role_not_permitted'
  | 'super_admin_only'
  | 'cannot_target_self'
  | 'branch_out_of_scope'
  | 'department_out_of_scope'
  | 'viewer_read_only';

export interface PolicyDecision {
  allowed: boolean;
  code: PolicyCode;
  /** Indonesian message ready for an API response body. */
  reason: string;
}

/** Actions the application can authorize. Explicit list keeps call sites honest. */
export type PolicyAction =
  // Data access
  | 'data:read'
  | 'data:write'
  | 'data:verify'
  | 'data:import'
  | 'data:export'
  // Account administration
  | 'user:read'
  | 'user:create'
  | 'user:update'
  | 'user:delete'
  | 'user:reset_password'
  // Configuration
  | 'config:read'
  | 'config:update'
  | 'config:update_database'
  // Audit
  | 'audit:read';

/**
 * Minimum permission required for each action. `config:update_database` is
 * intentionally absent: it needs a dedicated rule (see below) because holding
 * `system_params:manage` is not sufficient to repoint the database.
 */
const ACTION_PERMISSION: Record<Exclude<PolicyAction, 'config:update_database'>, Permission> = {
  'data:read': 'dashboard:read',
  'data:write': 'manual_input:write',
  'data:verify': 'verification:approve',
  'data:import': 'import:write',
  'data:export': 'reports:export',
  'user:read': 'users:read',
  'user:create': 'users:manage',
  'user:update': 'users:manage',
  'user:delete': 'users:manage',
  'user:reset_password': 'users:manage',
  'config:read': 'system_params:read',
  'config:update': 'system_params:manage',
  'audit:read': 'audit_logs:read',
};

const ALLOW: PolicyDecision = { allowed: true, code: 'ok', reason: '' };

function deny(code: PolicyCode, reason: string): PolicyDecision {
  return { allowed: false, code, reason };
}

function isValidRole(role: unknown): role is UserRole {
  return (
    role === 'super_admin' ||
    role === 'admin_regional' ||
    role === 'pic_dept_regional' ||
    role === 'pic_cabang' ||
    role === 'viewer'
  );
}

/** Normalise a branch reference to its canonical upper-case code. */
function normaliseBranch(branch?: string | null): string | null {
  const value = String(branch || '').trim().toUpperCase();
  return value || null;
}

/**
 * The single decision point.
 *
 * Order matters: identity → role validity → base permission → resource rules.
 * Returning the first failure keeps the reason precise instead of a generic
 * "denied".
 */
export function authorize(
  actor: PolicyActor | null | undefined,
  action: PolicyAction,
  context: PolicyContext = {}
): PolicyDecision {
  if (!actor) {
    return deny('no_actor', 'Sesi autentikasi tidak ditemukan. Silakan login terlebih dahulu.');
  }

  if (!isValidRole(actor.role)) {
    return deny('unknown_role', 'Role pengguna tidak dikenali sehingga akses ditolak.');
  }

  const role = actor.role;

  // --- Viewer is read-only everywhere ---------------------------------------
  // Checked before the generic permission gate so the user sees "you only have
  // read access" instead of the internal permission name for a write attempt.
  if (
    role === 'viewer' &&
    (action === 'data:write' ||
      action === 'data:verify' ||
      action === 'data:import' ||
      action === 'user:create' ||
      action === 'user:update' ||
      action === 'user:delete' ||
      action === 'user:reset_password' ||
      action === 'config:update' ||
      action === 'config:update_database')
  ) {
    return deny(
      'viewer_read_only',
      'Akses ditolak: Role Viewer (BOD) hanya memiliki akses baca.'
    );
  }

  // --- Base permission ------------------------------------------------------
  if (action === 'config:update_database') {
    // Repointing the database can bootstrap a fresh install with fresh accounts,
    // so it is Super Admin only — not merely "anyone who may edit settings".
    if (role !== 'super_admin') {
      return deny(
        'super_admin_only',
        'Akses ditolak: hanya Super Admin yang dapat mengubah lokasi basis data.'
      );
    }
  } else {
    const required = ACTION_PERMISSION[action];
    if (!hasPermission(role, required)) {
      return deny(
        'role_not_permitted',
        `Akses ditolak: Role "${role}" tidak memiliki izin (${required}) untuk tindakan ini.`
      );
    }
  }

  // --- Rules that depend on the target account ------------------------------
  const target = context.targetUser;

  if (target) {
    const targetRole = target.role;

    // A Super Admin account is protected: only another Super Admin may read,
    // modify, reset, or delete it. This is the rule that used to be copy-pasted
    // into every handler.
    if (targetRole === 'super_admin' && role !== 'super_admin') {
      return deny(
        'super_admin_only',
        'Akses ditolak: hanya Super Admin yang dapat mengelola akun Super Admin.'
      );
    }

    // Nobody may escalate an account to Super Admin unless they are one.
    if (action === 'user:create' || action === 'user:update') {
      const requestedRole = context.targetUser?.role;
      if (requestedRole === 'super_admin' && role !== 'super_admin') {
        return deny(
          'super_admin_only',
          'Akses ditolak: hanya Super Admin yang dapat menetapkan role Super Admin.'
        );
      }
    }

    // Changing your own password requires proving the current password, so it
    // must not travel through the administrative reset path.
    if (
      action === 'user:reset_password' &&
      actor.sub &&
      target.id &&
      actor.sub === target.id
    ) {
      return deny(
        'cannot_target_self',
        'Gunakan formulir ubah kata sandi pribadi untuk akun Anda sendiri.'
      );
    }
  }

  // --- Branch scoping for writes -------------------------------------------
  const targetBranch = normaliseBranch(context.targetBranch);
  const actorBranch = normaliseBranch(actor.branch_id);
  const isBranchScopedRole = role === 'pic_cabang';
  const actorIsCentral = !actorBranch || actorBranch === 'R99';

  if (targetBranch && isBranchScopedRole && !actorIsCentral && targetBranch !== actorBranch) {
    return deny(
      'branch_out_of_scope',
      `Akses ditolak: sebagai PIC Cabang [${actorBranch}], Anda tidak diizinkan mengubah data cabang [${targetBranch}].`
    );
  }

  // --- Department scoping for writes ---------------------------------------
  if (
    role === 'pic_dept_regional' &&
    context.targetDepartment &&
    actor.department_id &&
    context.targetDepartment !== actor.department_id
  ) {
    return deny(
      'department_out_of_scope',
      `Akses ditolak: sebagai PIC Departemen (${actor.department_id}), Anda tidak diizinkan mengirim data untuk departemen (${context.targetDepartment}).`
    );
  }

  // --- Cross-boundary data moves need more than "may write" ----------------
  if (context.isPrivilegeSensitive) {
    if (action === 'user:update' || action === 'user:create') {
      // Role/scope changes are privilege-sensitive; only central admins may do it.
      if (role !== 'super_admin' && role !== 'admin_regional') {
        return deny(
          'role_not_permitted',
          'Akses ditolak: hanya Admin Regional atau Super Admin yang dapat mengubah peran dan cakupan pengguna.'
        );
      }
    }
  }

  return ALLOW;
}

/** Convenience wrapper for the common case: "may this actor do X at all?". */
export function can(actor: PolicyActor | null | undefined, action: PolicyAction): boolean {
  return authorize(actor, action).allowed;
}

/**
 * Effective read scope for a data request.
 *
 * A PIC Cabang is pinned to their own branch no matter what the query string
 * says; everyone else keeps the requested scope. Kept here so the rule lives
 * beside the rest of the policy rather than inside a route handler.
 */
export function resolveReadBranchScope(
  actor: PolicyActor | null | undefined,
  requestedBranch?: string | null
): string | undefined {
  const requested = normaliseBranch(requestedBranch) || undefined;
  if (!actor) return requested;

  const actorBranch = normaliseBranch(actor.branch_id);
  if (actor.role === 'pic_cabang' && actorBranch && actorBranch !== 'R99') {
    return actorBranch;
  }
  return requested;
}

/**
 * Whether the actor sees only verified data. Executive viewers are forced into
 * verified-only mode regardless of the query string.
 */
export function resolveVerifiedOnly(
  actor: PolicyActor | null | undefined,
  requested?: boolean | string | null
): boolean {
  if (actor?.role === 'viewer') return true;
  if (typeof requested === 'boolean') return requested;
  return requested === 'true';
}
