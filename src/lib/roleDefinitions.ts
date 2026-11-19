import type { Permission } from './types';

export interface RoleMetadata {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'custom';
  scope: 'global' | 'regional' | 'cabang';
  permissions: Permission[];
  user_count?: number;
  is_deletable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const CANONICAL_ROLES_METADATA: RoleMetadata[] = [
  {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Akses penuh tanpa batas ke seluruh modul, manajemen pengguna, konfigurasi master data, parameter keamanan, dan jejak audit.',
    category: 'system',
    scope: 'global',
    permissions: [
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
    is_deletable: false,
  },
  {
    id: 'admin_regional',
    name: 'Administrator Regional 4',
    description: 'Pengelola operasional tingkat regional, verifikator utama laporan cabang, pengelola master data dan akun pengguna regional.',
    category: 'system',
    scope: 'regional',
    permissions: [
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
    is_deletable: false,
  },
  {
    id: 'pic_dept_regional',
    name: 'PIC Departemen Regional',
    description: 'Penanggung jawab data departemen di kantor regional. Berwenang menginput, membaca data bulanan, dan ekspor laporan.',
    category: 'system',
    scope: 'regional',
    permissions: [
      'dashboard:read',
      'records:read',
      'reports:export',
      'manual_input:write',
      'import:write',
      'verification:read',
      'templates:read',
      'master_data:read',
    ],
    is_deletable: false,
  },
  {
    id: 'pic_cabang',
    name: 'PIC Cabang / Terminal',
    description: 'Person in Charge tingkat pelabuhan/terminal. Berwenang menginput data bulanan dan mengunggah berkas khusus cabang terdaftar.',
    category: 'system',
    scope: 'cabang',
    permissions: [
      'dashboard:read',
      'records:read',
      'reports:export',
      'manual_input:write',
      'import:write',
      'verification:read',
      'templates:read',
      'master_data:read',
    ],
    is_deletable: false,
  },
  {
    id: 'viewer',
    name: 'BOD Regional 4 (Viewer)',
    description: 'Direksi dan manajemen eksekutif. Akses pantauan menyeluruh ke seluruh 28 cabang, indikator kinerja, dan ekspor ringkasan eksekutif.',
    category: 'system',
    scope: 'global',
    permissions: [
      'dashboard:read',
      'records:read',
      'reports:export',
      'master_data:read',
    ],
    is_deletable: false,
  },
];

export interface PermissionGroup {
  name: string;
  description: string;
  permissions: {
    key: Permission;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Dashboard & Eksekutif',
    description: 'Akses visualisasi data, ringkasan BOD, dan ekspor dokumen',
    permissions: [
      { key: 'dashboard:read', label: 'Lihat Dashboard & Grafik', description: 'Melihat ringkasan eksekutif, grafik tren, dan KPI' },
      { key: 'reports:export', label: 'Ekspor Laporan (Excel/PDF)', description: 'Mengunduh laporan berkala dan berkas Excel' },
    ],
  },
  {
    name: 'Operasional & Catatan Data',
    description: 'Akses membaca, input manual, dan unggah berkas data',
    permissions: [
      { key: 'records:read', label: 'Baca Data Catatan Kinerja', description: 'Melihat data detail operasional bulanan cabang' },
      { key: 'manual_input:write', label: 'Input Manual Bulanan', description: 'Memasukkan data realisasi bulanan langsung di form' },
      { key: 'import:write', label: 'Unggah Berkas Masal (Excel)', description: 'Mengimpor data menggunakan berkas template' },
    ],
  },
  {
    name: 'Verifikasi & Approval',
    description: 'Proses validasi dan persetujuan data operasional',
    permissions: [
      { key: 'verification:read', label: 'Lihat Antrean Verifikasi', description: 'Melihat daftar data yang diajukan oleh PIC' },
      { key: 'verification:approve', label: 'Verifikasi & Setujui Data', description: 'Menyetujui atau meminta revisi catatan operasional' },
    ],
  },
  {
    name: 'Template & Konfigurasi Kolom',
    description: 'Pengaturan kolom dan rumus impor',
    permissions: [
      { key: 'templates:read', label: 'Lihat Template Impor', description: 'Melihat format template dan kolom yang dibutuhkan' },
      { key: 'templates:manage', label: 'Kelola Template Impor', description: 'Menambah atau mengubah struktur kolom template' },
    ],
  },
  {
    name: 'Manajemen Pengguna & PIC',
    description: 'Pengelolaan akun, sandi, dan hak akses',
    permissions: [
      { key: 'users:read', label: 'Lihat Daftar Pengguna & PIC', description: 'Melihat direktori pegawai dan PIC terdaftar' },
      { key: 'users:manage', label: 'Kelola Akun & Reset Sandi', description: 'Menambah, mengedit akun PIC, dan reset kata sandi' },
    ],
  },
  {
    name: 'Master Data Pelabuhan',
    description: 'Katalog cabang, departemen, peralatan, dan KPI',
    permissions: [
      { key: 'master_data:read', label: 'Baca Master Data', description: 'Melihat master cabang, departemen, KPI, dan alat' },
      { key: 'master_data:manage', label: 'Kelola Master Data', description: 'Menambah dan memperbarui data master sistem' },
    ],
  },
  {
    name: 'Parameter Sistem & Keamanan',
    description: 'Pengaturan sesi, integrasi, dan pemantauan audit',
    permissions: [
      { key: 'system_params:read', label: 'Lihat Parameter Sistem', description: 'Melihat status koneksi DB dan sesi' },
      { key: 'system_params:manage', label: 'Ubah Parameter Sistem', description: 'Mengubah timeout sesi dan integrasi server' },
      { key: 'audit_logs:read', label: 'Lihat Jejak Audit (Audit Trail)', description: 'Melihat riwayat log perubahan dan keamanan sistem' },
    ],
  },
];

export type PermissionRiskLevel = 'read' | 'write' | 'sensitive';

export const PERMISSION_RISK_MAP: Record<Permission, PermissionRiskLevel> = {
  'dashboard:read': 'read',
  'records:read': 'read',
  'reports:export': 'write',
  'manual_input:write': 'write',
  'import:write': 'write',
  'verification:read': 'read',
  'verification:approve': 'sensitive',
  'templates:read': 'read',
  'templates:manage': 'sensitive',
  'users:read': 'read',
  'users:manage': 'sensitive',
  'master_data:read': 'read',
  'master_data:manage': 'sensitive',
  'system_params:read': 'read',
  'system_params:manage': 'sensitive',
  'audit_logs:read': 'read',
};

/**
 * Prasyarat izin otomatis (Smart Dependency Guard).
 * Mencegah terbentuknya peran yang memiliki izin tulis/approval tanpa izin baca modulnya.
 */
export const PERMISSION_DEPENDENCIES: Partial<Record<Permission, Permission[]>> = {
  'reports:export': ['dashboard:read'],
  'manual_input:write': ['records:read', 'dashboard:read'],
  'import:write': ['records:read', 'dashboard:read'],
  'verification:approve': ['verification:read', 'records:read', 'dashboard:read'],
  'templates:manage': ['templates:read'],
  'users:manage': ['users:read'],
  'master_data:manage': ['master_data:read'],
  'system_params:manage': ['system_params:read'],
};

export const PERMISSION_LABEL_MAP: Record<Permission, string> = PERMISSION_GROUPS.reduce(
  (acc, group) => {
    for (const perm of group.permissions) {
      acc[perm.key] = perm.label;
    }
    return acc;
  },
  {} as Record<Permission, string>
);

export const TOTAL_SYSTEM_PERMISSIONS = PERMISSION_GROUPS.reduce(
  (acc, group) => acc + group.permissions.length,
  0
);

export function applyPermissionWithDependencies(
  current: Permission[],
  toggled: Permission
): { next: Permission[]; autoAdded: Permission[] } {
  const exists = current.includes(toggled);
  if (exists) {
    return {
      next: current.filter((p) => p !== toggled),
      autoAdded: [],
    };
  }

  const required = PERMISSION_DEPENDENCIES[toggled] ?? [];
  const autoAdded = required.filter((dep) => !current.includes(dep));
  const next = Array.from(new Set<Permission>([...current, toggled, ...autoAdded]));
  return { next, autoAdded };
}

export interface RolePreset {
  id: 'auditor' | 'operator' | 'verifikator';
  label: string;
  scope: 'global' | 'regional' | 'cabang';
  description: string;
  permissions: Permission[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'auditor',
    label: 'Auditor',
    scope: 'global',
    description: 'Pantau dashboard, ekspor laporan, dan audit jejak aktivitas (Read-Only).',
    permissions: ['dashboard:read', 'records:read', 'reports:export', 'audit_logs:read'],
  },
  {
    id: 'operator',
    label: 'Operator Input',
    scope: 'cabang',
    description: 'Input realisasi bulanan, unggah berkas Excel, dan lihat template impor.',
    permissions: [
      'dashboard:read',
      'records:read',
      'reports:export',
      'manual_input:write',
      'import:write',
      'templates:read',
    ],
  },
  {
    id: 'verifikator',
    label: 'Verifikator',
    scope: 'regional',
    description: 'Tinjau antrean verifikasi, setujui/revisi data, dan baca master data.',
    permissions: [
      'dashboard:read',
      'records:read',
      'reports:export',
      'verification:read',
      'verification:approve',
      'master_data:read',
    ],
  },
];
