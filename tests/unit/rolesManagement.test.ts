import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ROLES_METADATA,
  PERMISSION_GROUPS,
  rolesRepository,
} from '@/lib/repositories/roles';
import {
  PERMISSION_RISK_MAP,
  ROLE_PRESETS,
  TOTAL_SYSTEM_PERMISSIONS,
  applyPermissionWithDependencies,
} from '@/lib/roleDefinitions';
import { evaluatePasswordStrength } from '@/lib/passwordPolicy';
import {
  isAllowedRoleKey,
  registerCustomRoleKey,
  unregisterCustomRoleKey,
} from '@/lib/validation';
import type { Permission } from '@/lib/types';

describe('Manajemen Peran & Hak Akses (RBAC)', () => {
  it('menyediakan 5 peran sistem inti dengan metadata lengkap', () => {
    expect(CANONICAL_ROLES_METADATA).toHaveLength(5);
    const ids = CANONICAL_ROLES_METADATA.map((r) => r.id);
    expect(ids).toContain('super_admin');
    expect(ids).toContain('admin_regional');
    expect(ids).toContain('pic_dept_regional');
    expect(ids).toContain('pic_cabang');
    expect(ids).toContain('viewer');

    for (const role of CANONICAL_ROLES_METADATA) {
      expect(role.category).toBe('system');
      expect(role.is_deletable).toBe(false);
      expect(role.permissions.length).toBeGreaterThan(0);
      expect(role.name.length).toBeGreaterThan(3);
    }
  });

  it('mengelompokkan seluruh 16 hak akses ke dalam 7 kelompok modul', () => {
    expect(PERMISSION_GROUPS).toHaveLength(7);
    const allKeys = new Set<Permission>();
    for (const group of PERMISSION_GROUPS) {
      expect(group.permissions.length).toBeGreaterThan(0);
      for (const p of group.permissions) {
        expect(p.key).toBeTruthy();
        expect(p.label).toBeTruthy();
        allKeys.add(p.key);
      }
    }
    expect(allKeys.size).toBe(16);
  });

  it('super_admin memiliki seluruh 16 hak akses', () => {
    const superAdmin = CANONICAL_ROLES_METADATA.find((r) => r.id === 'super_admin');
    expect(superAdmin).toBeDefined();
    expect(superAdmin!.permissions).toHaveLength(16);
  });

  it('viewer hanya memiliki 4 hak akses baca dan tidak boleh memiliki hak akses tulis', () => {
    const viewer = CANONICAL_ROLES_METADATA.find((r) => r.id === 'viewer');
    expect(viewer).toBeDefined();
    expect(viewer!.permissions).toHaveLength(4);
    expect(viewer!.permissions).toContain('dashboard:read');
    expect(viewer!.permissions).toContain('records:read');
    expect(viewer!.permissions).toContain('reports:export');
    expect(viewer!.permissions).toContain('master_data:read');
    expect(viewer!.permissions).not.toContain('manual_input:write');
    expect(viewer!.permissions).not.toContain('users:manage');
  });

  it('isAllowedRoleKey memvalidasi peran kanonis dan menolak peran tidak terdaftar', () => {
    expect(isAllowedRoleKey('super_admin')).toBe(true);
    expect(isAllowedRoleKey('admin_regional')).toBe(true);
    expect(isAllowedRoleKey('pic_dept_regional')).toBe(true);
    expect(isAllowedRoleKey('pic_cabang')).toBe(true);
    expect(isAllowedRoleKey('viewer')).toBe(true);

    expect(isAllowedRoleKey('superuser')).toBe(false);
    expect(isAllowedRoleKey('root')).toBe(false);
    expect(isAllowedRoleKey('')).toBe(false);
    expect(isAllowedRoleKey(null)).toBe(false);
  });

  it('mendukung pendaftaran peran kustom dinamis', () => {
    const customKey = 'auditor_regional_khusus';
    expect(isAllowedRoleKey(customKey)).toBe(false);

    registerCustomRoleKey(customKey);
    expect(isAllowedRoleKey(customKey)).toBe(true);

    unregisterCustomRoleKey(customKey);
    expect(isAllowedRoleKey(customKey)).toBe(false);
  });

  it('menolak penghapusan peran sistem inti', async () => {
    await expect(rolesRepository.deleteCustomRole('super_admin')).rejects.toThrow(
      /peran sistem inti dilindungi/i
    );
    await expect(rolesRepository.deleteCustomRole('viewer')).rejects.toThrow(
      /peran sistem inti dilindungi/i
    );
  });

  it('menolak pembuatan peran kustom dengan ID peran sistem inti', async () => {
    await expect(
      rolesRepository.saveCustomRole({
        id: 'super_admin',
        name: 'Super Admin Tiruan',
        description: 'Testing',
        scope: 'global',
        permissions: ['dashboard:read'],
      })
    ).rejects.toThrow(/peran sistem inti/i);
  });

  it('memetakan tingkat risiko untuk seluruh 16 izin sistem', () => {
    expect(TOTAL_SYSTEM_PERMISSIONS).toBe(16);
    expect(Object.keys(PERMISSION_RISK_MAP)).toHaveLength(16);
    expect(PERMISSION_RISK_MAP['users:manage']).toBe('sensitive');
    expect(PERMISSION_RISK_MAP['system_params:manage']).toBe('sensitive');
    expect(PERMISSION_RISK_MAP['verification:approve']).toBe('sensitive');
    expect(PERMISSION_RISK_MAP['manual_input:write']).toBe('write');
    expect(PERMISSION_RISK_MAP['dashboard:read']).toBe('read');
  });

  it('mengaktifkan izin prasyarat secara otomatis saat izin tulis/approval dinyalakan', () => {
    const res = applyPermissionWithDependencies([], 'verification:approve');
    expect(res.next).toContain('verification:approve');
    expect(res.next).toContain('verification:read');
    expect(res.next).toContain('records:read');
    expect(res.next).toContain('dashboard:read');
    expect(res.autoAdded).toEqual(['verification:read', 'records:read', 'dashboard:read']);

    const off = applyPermissionWithDependencies(res.next, 'verification:approve');
    expect(off.next).not.toContain('verification:approve');
    expect(off.autoAdded).toEqual([]);
  });

  it('menyediakan preset peran dengan daftar izin valid', () => {
    expect(ROLE_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of ROLE_PRESETS) {
      expect(preset.permissions.length).toBeGreaterThan(0);
      for (const p of preset.permissions) {
        expect(PERMISSION_RISK_MAP[p]).toBeDefined();
      }
    }
  });

  it('mengevaluasi kekuatan kata sandi selaras dengan kebijakan minimum 12 karakter', () => {
    const empty = evaluatePasswordStrength('');
    expect(empty.score).toBe(0);
    expect(empty.valid).toBe(false);

    const weak = evaluatePasswordStrength('abc');
    expect(weak.score).toBe(1);
    expect(weak.valid).toBe(false);
    expect(weak.criteria.minLength).toBe(false);

    const strong = evaluatePasswordStrength('Pelindo!R4#2026X');
    expect(strong.score).toBe(4);
    expect(strong.valid).toBe(true);
    expect(strong.criteria.minLength).toBe(true);
    expect(strong.criteria.distinctChars).toBe(true);
    expect(strong.criteria.mixedVariety).toBe(true);
    expect(strong.criteria.noEdgeSpaces).toBe(true);
  });
});
