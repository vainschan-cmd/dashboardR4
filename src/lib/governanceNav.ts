import type { Permission, UserRole } from './types';
import { CANONICAL_ROLES_METADATA } from './roleDefinitions';

export type GovernanceGroupId = 'data_cycle' | 'administration';

export interface GovernanceNavItem {
  id: 'import_center' | 'verification' | 'data_records' | 'master_data' | 'templates' | 'audit_trail';
  label: string;
  shortLabel: string;
  group: GovernanceGroupId;
  requiredPermission: Permission;
  adminOnly?: boolean;
}

/**
 * Single source of truth for the "Tata Kelola" navigation items.
 * Ordered chronologically by operational workflow:
 * 1. Siklus Data: Input -> Verifikasi -> Rekaman Data
 * 2. Administrasi: Master Data & Akses -> Pemetaan Template -> Jejak Audit Sistem
 */
export const GOVERNANCE_NAV_ITEMS: readonly GovernanceNavItem[] = [
  {
    id: 'import_center',
    label: 'Penginputan Data',
    shortLabel: 'Input Data',
    group: 'data_cycle',
    requiredPermission: 'import:write',
  },
  {
    id: 'verification',
    label: 'Verifikasi & Monitoring',
    shortLabel: 'Verifikasi',
    group: 'data_cycle',
    requiredPermission: 'verification:read',
  },
  {
    id: 'data_records',
    label: 'Rekaman Data Kinerja',
    shortLabel: 'Rekaman Data',
    group: 'data_cycle',
    requiredPermission: 'records:read',
  },
  {
    id: 'master_data',
    label: 'Master Data & Akses',
    shortLabel: 'Master Data',
    group: 'administration',
    requiredPermission: 'users:manage',
    adminOnly: true,
  },
  {
    id: 'templates',
    label: 'Pemetaan Template',
    shortLabel: 'Template',
    group: 'administration',
    requiredPermission: 'templates:manage',
    adminOnly: true,
  },
  {
    id: 'audit_trail',
    label: 'Jejak Audit Sistem',
    shortLabel: 'Jejak Audit',
    group: 'administration',
    requiredPermission: 'audit_logs:read',
    adminOnly: true,
  },
] as const;

function roleHasCanonicalPermission(role: UserRole | string, permission: Permission): boolean {
  const canonical = CANONICAL_ROLES_METADATA.find((r) => r.id === role);
  if (canonical) {
    return canonical.permissions.includes(permission);
  }
  // Custom non-viewer roles default to operational read/write cycle; admin-only views stay gated by canManageUsers.
  return permission === 'records:read' || permission === 'verification:read' || permission === 'import:write';
}

export function getVisibleGovernanceNavItems(
  userRole: UserRole | string,
  canManageUsers: boolean
): GovernanceNavItem[] {
  if (userRole === 'viewer') return [];
  return GOVERNANCE_NAV_ITEMS.filter((item) => {
    if (item.adminOnly) {
      return canManageUsers || roleHasCanonicalPermission(userRole, item.requiredPermission);
    }
    return roleHasCanonicalPermission(userRole, item.requiredPermission);
  });
}

/**
 * Flags KPI rows whose realization strongly deviates from RKAP target so
 * verifiers can double-check potential typos before publishing.
 */
export function isAnomalyDeviation(
  achievementPct: number | null | undefined,
  target: number | null | undefined,
  realization: number | null | undefined
): { flagged: boolean; reason?: string } {
  const pct = Number(achievementPct ?? 0);
  const tgt = Number(target ?? 0);
  const real = Number(realization ?? 0);

  if (tgt > 0 && real === 0) {
    return { flagged: true, reason: 'Realisasi 0 pada target aktif' };
  }
  if (pct > 130) {
    return { flagged: true, reason: `Capaian tinggi (${pct}%) — cek satuan/nol` };
  }
  if (tgt > 0 && pct < 70) {
    return { flagged: true, reason: `Deviasi rendah (${pct}%) di bawah 70% RKAP` };
  }
  return { flagged: false };
}

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) and quotes RFC-4180 CSV cells.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const trimmedLeading = raw.replace(/^[\t\r\n]+/, '');
  const safe = /^[=+\-@]/.test(trimmedLeading) ? `'${raw}` : raw;
  const escaped = safe.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function downloadCsvFile(filename: string, headers: string[], rows: unknown[][]): void {
  if (typeof window === 'undefined') return;
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  // UTF-8 BOM ensures Indonesian characters open cleanly in Microsoft Excel
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
