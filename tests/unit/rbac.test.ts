import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isExecutiveViewer,
  canManageUsersRole,
  canVerifyDataRole,
  isPicCabangRole,
  ROLE_PERMISSIONS,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
  enforceVerificationFilterForRead,
  enforceVerificationStatusFilterForRead,
  validateBranchWriteAccess,
  validateDepartmentWriteAccess,
  resolveServerAssignedUserScope,
  resolveDepartmentFromText,
  type Permission,
} from '@/lib/rbac';
import type { UserRole } from '@/lib/types';

/** Minimal session shape accepted by the row-level helpers. */
function session(role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    sub: 'usr_1',
    nipp: '10000',
    username: '10000',
    name: 'Uji',
    role,
    branch_id: role === 'pic_cabang' ? 'R01' : 'R99',
    department_id: role === 'pic_dept_regional' ? 'dept_keu' : null,
    token_version: 0,
    iat: 0,
    exp: 0,
    jti: 'jti-1',
    type: 'access' as const,
    ...overrides,
  };
}

const ALL_ROLES: UserRole[] = [
  'super_admin',
  'admin_regional',
  'pic_dept_regional',
  'pic_cabang',
  'viewer',
];

describe('matriks permission per role', () => {
  it('super_admin memiliki seluruh permission yang terdaftar', () => {
    const everyPermission = new Set<Permission>(
      Object.values(ROLE_PERMISSIONS).flatMap((list) => [...list])
    );
    for (const permission of everyPermission) {
      expect(hasPermission('super_admin', permission), permission).toBe(true);
    }
  });

  it('viewer hanya boleh membaca — tidak boleh menulis apa pun', () => {
    const writePermissions: Permission[] = [
      'manual_input:write',
      'import:write',
      'verification:approve',
      'templates:manage',
      'users:manage',
      'master_data:manage',
      'system_params:manage',
    ];
    for (const permission of writePermissions) {
      expect(hasPermission('viewer', permission), permission).toBe(false);
    }
    expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
    expect(hasPermission('viewer', 'records:read')).toBe(true);
  });

  it('hanya super_admin dan admin_regional yang dapat mengelola pengguna', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'super_admin' || role === 'admin_regional';
      expect(canManageUsersRole(role), role).toBe(expected);
    }
  });

  it('hanya super_admin dan admin_regional yang dapat menyetujui verifikasi', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'super_admin' || role === 'admin_regional';
      expect(canVerifyDataRole(role), role).toBe(expected);
    }
  });

  it('hanya super_admin yang dapat mengubah parameter sistem', () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, 'system_params:manage'), role).toBe(role === 'super_admin');
    }
  });

  it('audit log hanya untuk super_admin dan admin_regional', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'super_admin' || role === 'admin_regional';
      expect(hasPermission(role, 'audit_logs:read'), role).toBe(expected);
    }
  });

  it('PIC cabang dan PIC dept regional tidak dapat mengelola master maupun pengguna', () => {
    for (const role of ['pic_cabang', 'pic_dept_regional'] as UserRole[]) {
      expect(hasPermission(role, 'users:manage'), role).toBe(false);
      expect(hasPermission(role, 'master_data:manage'), role).toBe(false);
      expect(hasPermission(role, 'templates:manage'), role).toBe(false);
      expect(hasPermission(role, 'verification:approve'), role).toBe(false);
    }
  });

  it('menolak role yang tidak dikenal maupun nilai kosong', () => {
    expect(hasPermission('superuser' as UserRole, 'dashboard:read')).toBe(false);
    expect(hasPermission(null, 'dashboard:read')).toBe(false);
    expect(hasPermission(undefined, 'dashboard:read')).toBe(false);
    expect(hasPermission('', 'dashboard:read')).toBe(false);
  });

  it('menerima objek pengguna maupun session, bukan hanya string role', () => {
    expect(hasPermission(session('admin_regional'), 'users:manage')).toBe(true);
    expect(hasPermission({ ...session('viewer') }, 'users:manage')).toBe(false);
  });

  it('isExecutiveViewer hanya benar untuk viewer', () => {
    for (const role of ALL_ROLES) {
      expect(isExecutiveViewer(role), role).toBe(role === 'viewer');
    }
  });

  it('isPicCabangRole hanya benar untuk pic_cabang', () => {
    for (const role of ALL_ROLES) {
      expect(isPicCabangRole(role), role).toBe(role === 'pic_cabang');
    }
  });
});

describe('enforceBranchFilterForRead', () => {
  it('memaksa PIC cabang ke cabangnya sendiri', () => {
    const sesi = session('pic_cabang', { branch_id: 'R01' });
    expect(enforceBranchFilterForRead(sesi, 'R04')).toBe('R01');
    expect(enforceBranchFilterForRead(sesi, undefined)).toBe('R01');
  });

  it('tidak membatasi role pusat (R99)', () => {
    const sesi = session('admin_regional', { branch_id: 'R99' });
    expect(enforceBranchFilterForRead(sesi, 'R04')).toBe('R04');
  });

  it('meneruskan permintaan apa adanya ketika sesi tidak ada', () => {
    expect(enforceBranchFilterForRead(null, 'R04')).toBe('R04');
    expect(enforceBranchFilterForRead(null, undefined)).toBeUndefined();
  });

  it('mengembalikan kode kanonik, bukan nama cabang', () => {
    // Session menyimpan id internal; hasil harus berupa kode (Rxx).
    const sesi = session('pic_cabang', { branch_id: 'term_makassar' });
    const result = enforceBranchFilterForRead(sesi, 'R04');
    expect(result).toBe('R01');
  });
});

describe('enforceDepartmentFilterForRead', () => {
  it('memaksa PIC dept regional ke departemennya', () => {
    const sesi = session('pic_dept_regional', { department_id: 'dept_keu' });
    expect(enforceDepartmentFilterForRead(sesi, 'dept_ops')).toBe('dept_keu');
  });

  it('meneruskan departemen yang diminta untuk role lain', () => {
    const sesi = session('admin_regional');
    expect(enforceDepartmentFilterForRead(sesi, 'dept_ops')).toBe('dept_ops');
  });
});

describe('enforceVerificationFilterForRead', () => {
  it('memaksa viewer ke verifiedOnly tanpa peduli parameter', () => {
    const viewer = session('viewer');
    expect(enforceVerificationFilterForRead(viewer, false)).toBe(true);
    expect(enforceVerificationFilterForRead(viewer, 'false')).toBe(true);
    expect(enforceVerificationFilterForRead(viewer, undefined)).toBe(true);
  });

  it('menghormati parameter untuk role lain', () => {
    const admin = session('admin_regional');
    expect(enforceVerificationFilterForRead(admin, true)).toBe(true);
    expect(enforceVerificationFilterForRead(admin, false)).toBe(false);
    expect(enforceVerificationFilterForRead(admin, 'true')).toBe(true);
    expect(enforceVerificationFilterForRead(admin, undefined)).toBe(false);
  });

  it('memaksa status "verified" untuk viewer', () => {
    const viewer = session('viewer');
    expect(enforceVerificationStatusFilterForRead(viewer, 'pending_verification')).toBe('verified');
    expect(enforceVerificationStatusFilterForRead(viewer, undefined)).toBe('verified');
  });
});

describe('validateBranchWriteAccess', () => {
  it('menolak viewer untuk menulis', () => {
    const result = validateBranchWriteAccess(session('viewer'), 'R01');
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/Viewer/i);
  });

  it('mengizinkan PIC cabang menulis ke cabangnya sendiri', () => {
    const result = validateBranchWriteAccess(session('pic_cabang', { branch_id: 'R01' }), 'R01');
    expect(result.allowed).toBe(true);
    expect(result.canonicalCode).toBe('R01');
  });

  it('menolak PIC cabang menulis ke cabang lain', () => {
    const result = validateBranchWriteAccess(session('pic_cabang', { branch_id: 'R01' }), 'R04');
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('R04');
  });

  it('mengisi cabang PIC ketika target tidak disebutkan', () => {
    const result = validateBranchWriteAccess(session('pic_cabang', { branch_id: 'R01' }), null);
    expect(result.allowed).toBe(true);
    expect(result.canonicalCode).toBe('R01');
  });

  it('mengizinkan admin menulis ke cabang mana pun', () => {
    const result = validateBranchWriteAccess(session('admin_regional'), 'R04');
    expect(result.allowed).toBe(true);
    expect(result.canonicalCode).toBe('R04');
  });

  it('mengizinkan super_admin lintas cabang', () => {
    expect(validateBranchWriteAccess(session('super_admin'), 'R12').allowed).toBe(true);
  });
});

describe('validateDepartmentWriteAccess', () => {
  it('menolak PIC dept menulis ke departemen lain', () => {
    const sesi = session('pic_dept_regional', { department_id: 'dept_keu' });
    const result = validateDepartmentWriteAccess(sesi, 'dept_ops');
    expect(result.allowed).toBe(false);
    expect(result.effectiveDepartmentId).toBe('dept_keu');
  });

  it('mengizinkan PIC dept menulis ke departemennya', () => {
    const sesi = session('pic_dept_regional', { department_id: 'dept_keu' });
    expect(validateDepartmentWriteAccess(sesi, 'dept_keu').allowed).toBe(true);
  });

  it('mengisi departemen PIC ketika target kosong', () => {
    const sesi = session('pic_dept_regional', { department_id: 'dept_keu' });
    const result = validateDepartmentWriteAccess(sesi, null);
    expect(result.allowed).toBe(true);
    expect(result.effectiveDepartmentId).toBe('dept_keu');
  });

  it('meneruskan departemen untuk role pusat', () => {
    const result = validateDepartmentWriteAccess(session('admin_regional'), 'dept_ops');
    expect(result.allowed).toBe(true);
    expect(result.effectiveDepartmentId).toBe('dept_ops');
  });
});

describe('resolveServerAssignedUserScope', () => {
  it('pendaftaran publik tidak pernah mendapat role tinggi', () => {
    for (const role of ALL_ROLES) {
      const scope = resolveServerAssignedUserScope({
        role,
        isPublicSelfRegistration: true,
        branch_id: 'R01',
      });
      expect(scope.role, role).toBe('pic_cabang');
    }
  });

  it('viewer selalu dipetakan ke pusat tanpa departemen', () => {
    const scope = resolveServerAssignedUserScope({
      role: 'viewer',
      branch_id: 'R05',
      divisi: 'Operasi',
      departemen: 'Terminal',
    });
    expect(scope).toEqual({ role: 'viewer', branch_id: 'R99', department_id: null });
  });

  it('admin dan super admin dipetakan ke pusat', () => {
    for (const role of ['super_admin', 'admin_regional'] as UserRole[]) {
      const scope = resolveServerAssignedUserScope({ role, branch_id: 'R05' });
      expect(scope.branch_id, role).toBe('R99');
      expect(scope.role, role).toBe(role);
    }
  });

  it('PIC dept regional tidak pernah mendapat cabang tertentu', () => {
    const scope = resolveServerAssignedUserScope({
      role: 'pic_dept_regional',
      branch_id: 'R05',
      divisi: 'Keuangan',
    });
    expect(scope.branch_id).toBe('R99');
    expect(scope.department_id).toBe('dept_keu');
  });

  it('PIC cabang memakai kode cabang yang diberikan', () => {
    const scope = resolveServerAssignedUserScope({ role: 'pic_cabang', branch_id: 'R04' });
    expect(scope.branch_id).toBe('R04');
  });

  it('PIC cabang menebak cabang dari teks departemen bila perlu', () => {
    const scope = resolveServerAssignedUserScope({
      role: 'pic_cabang',
      departemen: 'Cabang Makassar',
    });
    expect(scope.branch_id).toMatch(/^R\d{2}$/);
  });

  it('default role adalah pic_cabang, bukan role tinggi', () => {
    const scope = resolveServerAssignedUserScope({});
    expect(scope.role).toBe('pic_cabang');
  });
});

describe('resolveDepartmentFromText', () => {
  it('menerima id departemen yang sah apa adanya', () => {
    for (const id of ['dept_ops', 'dept_keu', 'dept_sdm', 'dept_tek', 'dept_kom']) {
      expect(resolveDepartmentFromText(id)).toBe(id);
    }
  });

  it('menebak departemen dari teks Indonesia', () => {
    expect(resolveDepartmentFromText(null, 'Divisi Keuangan', '')).toBe('dept_keu');
    expect(resolveDepartmentFromText(null, 'SDM & Umum', '')).toBe('dept_sdm');
    expect(resolveDepartmentFromText(null, 'Teknik', '')).toBe('dept_tek');
    expect(resolveDepartmentFromText(null, 'Komersial', '')).toBe('dept_kom');
    expect(resolveDepartmentFromText(null, 'Operasi', '')).toBe('dept_ops');
  });

  it('menebak dari kata "terminal" dan "kapal" sebagai operasi', () => {
    expect(resolveDepartmentFromText(null, 'Terminal Petikemas', '')).toBe('dept_ops');
    expect(resolveDepartmentFromText(null, 'Pelayanan Kapal', '')).toBe('dept_ops');
  });

  it('tidak salah memetakan kata yang hanya mengandung "ti" ke departemen teknik', () => {
    // Regresi: pencocokan substring membuat "peTIkemas", "kualiTas", dan
    // "informasi akTIvitas" dianggap Divisi TI.
    for (const text of [
      'Terminal Petikemas',
      'Kualitas Pelayanan',
      'Informasi Aktivitas Operasi',
    ]) {
      expect(resolveDepartmentFromText(null, text, ''), text).not.toBe('dept_tek');
    }
  });

  it('tetap mengenali Divisi TI sebagai departemen teknik', () => {
    expect(resolveDepartmentFromText(null, 'Divisi TI', '')).toBe('dept_tek');
    expect(resolveDepartmentFromText(null, 'Teknologi Informasi', '')).toBe('dept_tek');
    expect(resolveDepartmentFromText(null, 'Divisi Teknik', '')).toBe('dept_tek');
  });

  it('jatuh ke dept_ops ketika tidak ada petunjuk', () => {
    expect(resolveDepartmentFromText(null, 'Entah', 'Apa')).toBe('dept_ops');
  });
});
