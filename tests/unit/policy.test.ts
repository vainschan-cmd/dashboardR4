import { describe, it, expect } from 'vitest';
import {
  authorize,
  can,
  resolveReadBranchScope,
  resolveVerifiedOnly,
  type PolicyAction,
  type PolicyActor,
} from '@/lib/policy';
import type { UserRole } from '@/lib/types';

function actor(role: UserRole, overrides: Partial<PolicyActor> = {}): PolicyActor {
  return {
    sub: 'usr_actor',
    role,
    branch_id: role === 'pic_cabang' ? 'R01' : 'R99',
    department_id: role === 'pic_dept_regional' ? 'dept_keu' : null,
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

describe('authorize — identitas & role', () => {
  it('menolak tanpa sesi dengan kode no_actor', () => {
    const decision = authorize(null, 'data:read');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('no_actor');
    expect(decision.reason).toMatch(/login/i);
  });

  it('menolak role yang tidak dikenal dengan kode unknown_role', () => {
    const decision = authorize({ role: 'root' }, 'data:read');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('unknown_role');
  });

  it('mengembalikan kode ok dan alasan kosong saat diizinkan', () => {
    const decision = authorize(actor('super_admin'), 'data:read');
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe('ok');
    expect(decision.reason).toBe('');
  });
});

describe('authorize — matriks role × action', () => {
  /** Expected outcome per role for each action, derived from the documented RBAC matrix. */
  const MATRIX: Array<{ action: PolicyAction; allowed: UserRole[] }> = [
    { action: 'data:read', allowed: ALL_ROLES },
    { action: 'data:export', allowed: ALL_ROLES },
    { action: 'data:write', allowed: ['super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang'] },
    { action: 'data:import', allowed: ['super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang'] },
    { action: 'data:verify', allowed: ['super_admin', 'admin_regional'] },
    { action: 'user:read', allowed: ['super_admin', 'admin_regional'] },
    { action: 'user:create', allowed: ['super_admin', 'admin_regional'] },
    { action: 'user:update', allowed: ['super_admin', 'admin_regional'] },
    { action: 'user:delete', allowed: ['super_admin', 'admin_regional'] },
    { action: 'user:reset_password', allowed: ['super_admin', 'admin_regional'] },
    { action: 'config:read', allowed: ['super_admin', 'admin_regional'] },
    // `system_params:manage` is held by Super Admin only (admin_regional has
    // read access), so configuration *writes* are Super Admin only today.
    { action: 'config:update', allowed: ['super_admin'] },
    { action: 'config:update_database', allowed: ['super_admin'] },
    { action: 'audit:read', allowed: ['super_admin', 'admin_regional'] },
  ];

  for (const row of MATRIX) {
    it(`${row.action}: hanya ${row.allowed.join(', ')}`, () => {
      for (const role of ALL_ROLES) {
        const expected = row.allowed.includes(role);
        const decision = authorize(actor(role), row.action);
        expect(decision.allowed, `${role} → ${row.action}`).toBe(expected);
        if (!expected) expect(decision.reason.length).toBeGreaterThan(0);
      }
    });
  }

  it('viewer tidak pernah dapat melakukan aksi tulis', () => {
    const writeActions: PolicyAction[] = [
      'data:write',
      'data:verify',
      'data:import',
      'user:create',
      'user:update',
      'user:delete',
      'user:reset_password',
      'config:update',
      'config:update_database',
    ];
    for (const action of writeActions) {
      const decision = authorize(actor('viewer'), action);
      expect(decision.allowed, action).toBe(false);
      expect(decision.code, action).toBe('viewer_read_only');
    }
  });
});

describe('authorize — perlindungan akun Super Admin', () => {
  it('admin_regional tidak dapat mengubah akun Super Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:update', {
      targetUser: { id: 'usr_x', role: 'super_admin' },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('super_admin_only');
  });

  it('admin_regional tidak dapat menghapus akun Super Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:delete', {
      targetUser: { id: 'usr_x', role: 'super_admin' },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('super_admin_only');
  });

  it('admin_regional tidak dapat mereset kata sandi Super Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:reset_password', {
      targetUser: { id: 'usr_x', role: 'super_admin' },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('super_admin_only');
  });

  it('super_admin dapat mengelola akun Super Admin lain', () => {
    const decision = authorize(actor('super_admin'), 'user:update', {
      targetUser: { id: 'usr_x', role: 'super_admin' },
    });
    expect(decision.allowed).toBe(true);
  });

  it('admin_regional dapat mengubah akun non-Super-Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:update', {
      targetUser: { id: 'usr_x', role: 'pic_cabang' },
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('authorize — eskalasi privilege', () => {
  it('admin_regional tidak dapat membuat akun Super Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:create', {
      targetUser: { role: 'super_admin' },
      isPrivilegeSensitive: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('super_admin_only');
  });

  it('admin_regional tidak dapat mempromosikan akun menjadi Super Admin', () => {
    const decision = authorize(actor('admin_regional'), 'user:update', {
      targetUser: { role: 'super_admin' },
      isPrivilegeSensitive: true,
    });
    expect(decision.allowed).toBe(false);
  });

  it('super_admin dapat membuat akun Super Admin', () => {
    const decision = authorize(actor('super_admin'), 'user:create', {
      targetUser: { role: 'super_admin' },
      isPrivilegeSensitive: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it('PIC (tanpa users:manage) tetap ditolak sebelum aturan eskalasi dinilai', () => {
    const decision = authorize(actor('pic_cabang'), 'user:update', {
      targetUser: { role: 'pic_cabang' },
      isPrivilegeSensitive: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('role_not_permitted');
  });
});

describe('authorize — reset kata sandi akun sendiri', () => {
  it('menolak reset kata sandi sendiri lewat jalur admin', () => {
    const decision = authorize(actor('super_admin', { sub: 'usr_me' }), 'user:reset_password', {
      targetUser: { id: 'usr_me', role: 'super_admin' },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('cannot_target_self');
  });

  it('mengizinkan reset kata sandi akun lain', () => {
    const decision = authorize(actor('super_admin', { sub: 'usr_me' }), 'user:reset_password', {
      targetUser: { id: 'usr_other', role: 'pic_cabang' },
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('authorize — scope cabang', () => {
  it('menolak PIC cabang menulis ke cabang lain', () => {
    const decision = authorize(actor('pic_cabang', { branch_id: 'R01' }), 'data:write', {
      targetBranch: 'R04',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('branch_out_of_scope');
    expect(decision.reason).toContain('R04');
  });

  it('mengizinkan PIC cabang menulis ke cabangnya sendiri', () => {
    const decision = authorize(actor('pic_cabang', { branch_id: 'R01' }), 'data:write', {
      targetBranch: 'R01',
    });
    expect(decision.allowed).toBe(true);
  });

  it('menerima kode cabang dalam huruf kecil (case-insensitive)', () => {
    const decision = authorize(actor('pic_cabang', { branch_id: 'R01' }), 'data:write', {
      targetBranch: 'r01',
    });
    expect(decision.allowed).toBe(true);
  });

  it('tidak membatasi role pusat (R99)', () => {
    const decision = authorize(actor('admin_regional', { branch_id: 'R99' }), 'data:write', {
      targetBranch: 'R04',
    });
    expect(decision.allowed).toBe(true);
  });

  it('role pusat tanpa branch_id tidak dibatasi', () => {
    const decision = authorize(actor('admin_regional', { branch_id: null }), 'data:write', {
      targetBranch: 'R04',
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('authorize — scope departemen', () => {
  it('menolak PIC dept menulis ke departemen lain', () => {
    const decision = authorize(
      actor('pic_dept_regional', { department_id: 'dept_keu' }),
      'data:write',
      { targetDepartment: 'dept_ops' }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('department_out_of_scope');
  });

  it('mengizinkan PIC dept menulis ke departemennya', () => {
    const decision = authorize(
      actor('pic_dept_regional', { department_id: 'dept_keu' }),
      'data:write',
      { targetDepartment: 'dept_keu' }
    );
    expect(decision.allowed).toBe(true);
  });

  it('role lain tidak dibatasi departemen', () => {
    const decision = authorize(actor('admin_regional'), 'data:write', {
      targetDepartment: 'dept_ops',
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('can', () => {
  it('membungkus authorize untuk pemakaian sederhana', () => {
    expect(can(actor('super_admin'), 'config:update_database')).toBe(true);
    expect(can(actor('admin_regional'), 'config:update_database')).toBe(false);
    expect(can(null, 'data:read')).toBe(false);
  });
});

describe('resolveReadBranchScope', () => {
  it('memaku PIC cabang ke cabangnya sendiri', () => {
    expect(resolveReadBranchScope(actor('pic_cabang', { branch_id: 'R01' }), 'R04')).toBe('R01');
    expect(resolveReadBranchScope(actor('pic_cabang', { branch_id: 'r01' }), undefined)).toBe('R01');
  });

  it('membiarkan role pusat memilih cabang', () => {
    expect(resolveReadBranchScope(actor('admin_regional'), 'R04')).toBe('R04');
  });

  it('membiarkan PIC cabang pusat (R99) memilih cabang', () => {
    expect(resolveReadBranchScope(actor('pic_cabang', { branch_id: 'R99' }), 'R04')).toBe('R04');
  });

  it('menormalkan input menjadi huruf besar', () => {
    expect(resolveReadBranchScope(actor('admin_regional'), ' r04 ')).toBe('R04');
  });

  it('mengembalikan undefined ketika tidak ada permintaan dan tidak ada batasan', () => {
    expect(resolveReadBranchScope(actor('admin_regional'), null)).toBeUndefined();
    expect(resolveReadBranchScope(null, null)).toBeUndefined();
  });
});

describe('resolveVerifiedOnly', () => {
  it('memaksa viewer ke true apa pun inputnya', () => {
    expect(resolveVerifiedOnly(actor('viewer'), false)).toBe(true);
    expect(resolveVerifiedOnly(actor('viewer'), 'false')).toBe(true);
    expect(resolveVerifiedOnly(actor('viewer'), undefined)).toBe(true);
  });

  it('menghormati input untuk role lain', () => {
    expect(resolveVerifiedOnly(actor('admin_regional'), true)).toBe(true);
    expect(resolveVerifiedOnly(actor('admin_regional'), false)).toBe(false);
    expect(resolveVerifiedOnly(actor('admin_regional'), 'true')).toBe(true);
    expect(resolveVerifiedOnly(actor('admin_regional'), undefined)).toBe(false);
  });
});
