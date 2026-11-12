import { describe, it, expect } from 'vitest';
import {
  ROLE_RANK,
  canGrantRole,
  describeAllowedRoles,
  normaliseToken,
  parseRoleStrict,
} from '@/lib/roleMapping';

/**
 * `FEAT-10` — no path may create a Super Admin from a file.
 *
 * The parser this replaced matched substrings, so any cell containing "super"
 * became `super_admin`. At a port company "Supervisor" and "Superintendent" are
 * ordinary job titles, which means a staff spreadsheet silently promoted people.
 * The same loose matching also promoted a "PIC Dept Regional 4" to
 * `admin_regional`, because the cell contains "regional 4".
 *
 * These cases are pinned individually because each one is a real escalation, not
 * a formatting preference.
 */

describe('parseRoleStrict — eskalasi yang harus ditolak', () => {
  it('tidak menganggap jabatan "Supervisor"/"Superintendent" sebagai Super Admin', () => {
    for (const value of [
      'Supervisor Operasi',
      'SUPERINTENDENT',
      'Supervisor Bongkar Muat',
      'supervisi teknis',
      'Supervisor',
    ]) {
      expect(parseRoleStrict(value), value).toBeNull();
    }
  });

  it('tidak menaikkan PIC Dept menjadi Admin Regional hanya karena ada "regional 4"', () => {
    // The old parser ran the "regional 4" rule before the PIC-Dept rule.
    expect(parseRoleStrict('PIC Dept Regional 4')).toBe('pic_dept_regional');
    expect(parseRoleStrict('PIC Departemen Regional 4')).toBe('pic_dept_regional');
  });

  it('memetakan "BOD Regional 4" ke viewer, bukan ke peran administratif', () => {
    // The label in the UI is "BOD Regional 4 (Viewer)"; anything else would give
    // the board member write access.
    for (const value of ['BOD Regional 4', 'BOD', 'Viewer (BOD)', 'bod regional 4']) {
      expect(parseRoleStrict(value), value).toBe('viewer');
    }
  });

  it('menolak nilai yang tidak dikenal alih-alih memberi default', () => {
    for (const value of ['', '   ', null, undefined, 'tidak diketahui', 'admin', 'root', 'guest', 42]) {
      expect(parseRoleStrict(value), String(value)).toBeNull();
    }
  });
});

describe('parseRoleStrict — nilai sah tetap diterima', () => {
  it('menerima nama kanonis', () => {
    expect(parseRoleStrict('super_admin')).toBe('super_admin');
    expect(parseRoleStrict('admin_regional')).toBe('admin_regional');
    expect(parseRoleStrict('pic_dept_regional')).toBe('pic_dept_regional');
    expect(parseRoleStrict('pic_cabang')).toBe('pic_cabang');
    expect(parseRoleStrict('viewer')).toBe('viewer');
  });

  it('menerima sinonim yang lazim di spreadsheet', () => {
    expect(parseRoleStrict('Super Admin')).toBe('super_admin');
    expect(parseRoleStrict('SUPERADMIN')).toBe('super_admin');
    expect(parseRoleStrict('Administrator Regional')).toBe('admin_regional');
    expect(parseRoleStrict('Admin Regional 4')).toBe('admin_regional');
    expect(parseRoleStrict('PIC Cabang Pelabuhan')).toBe('pic_cabang');
    expect(parseRoleStrict('PIC Terminal')).toBe('pic_cabang');
  });

  it('tidak terpengaruh spasi, huruf besar/kecil, dan tanda baca', () => {
    for (const value of ['  Super   Admin ', 'super-admin', 'super.admin', 'SUPER_ADMIN', '(super admin)']) {
      expect(parseRoleStrict(value), value).toBe('super_admin');
    }
  });
});

describe('normaliseToken', () => {
  it('menurunkan huruf, merapatkan spasi, dan membuang tanda baca', () => {
    expect(normaliseToken('  PIC  Cabang  ')).toBe('pic cabang');
    expect(normaliseToken('PIC_Dept-Regional.4')).toBe('pic dept regional 4');
    expect(normaliseToken('BOD (Viewer)')).toBe('bod viewer');
    expect(normaliseToken(null)).toBe('');
  });
});

describe('canGrantRole', () => {
  it('hanya Super Admin yang boleh memberikan role Super Admin', () => {
    expect(canGrantRole('super_admin', 'super_admin')).toBe(true);
    for (const actor of ['admin_regional', 'pic_dept_regional', 'pic_cabang', 'viewer'] as const) {
      expect(canGrantRole(actor, 'super_admin'), actor).toBe(false);
    }
  });

  it('tidak ada aktor yang dapat memberi role setingkat atau lebih tinggi dari dirinya', () => {
    expect(canGrantRole('admin_regional', 'admin_regional')).toBe(false);
    expect(canGrantRole('admin_regional', 'super_admin')).toBe(false);
    expect(canGrantRole('pic_dept_regional', 'admin_regional')).toBe(false);
    expect(canGrantRole('viewer', 'viewer')).toBe(false);
  });

  it('mengizinkan pemberian role di bawah kewenangan aktor', () => {
    expect(canGrantRole('admin_regional', 'pic_dept_regional')).toBe(true);
    expect(canGrantRole('admin_regional', 'pic_cabang')).toBe(true);
    expect(canGrantRole('admin_regional', 'viewer')).toBe(true);
  });

  it('menolak pemberian role setingkat meski berbeda jenis', () => {
    // `pic_dept_regional` and `pic_cabang` share a rank: both are branch- or
    // department-scoped contributors. Letting one mint the other would let a
    // department PIC create accounts outside its department, so lateral grants
    // are refused rather than allowed "because it is not an escalation".
    expect(canGrantRole('pic_dept_regional', 'pic_cabang')).toBe(false);
    expect(canGrantRole('pic_cabang', 'pic_dept_regional')).toBe(false);
    // Only strictly lower roles remain available to them.
    expect(canGrantRole('pic_dept_regional', 'viewer')).toBe(true);
  });

  it('menolak aktor tanpa role (impor anonim)', () => {
    expect(canGrantRole(undefined, 'viewer')).toBe(false);
    expect(canGrantRole(null, 'pic_cabang')).toBe(false);
  });

  it('setiap peran kecuali super_admin hanya dapat memberi peringkat lebih rendah', () => {
    const roles = Object.keys(ROLE_RANK) as Array<keyof typeof ROLE_RANK>;
    for (const actor of roles) {
      for (const target of roles) {
        if (actor === 'super_admin') continue;
        const allowed = canGrantRole(actor, target);
        const shouldAllow = ROLE_RANK[target] < ROLE_RANK[actor] && target !== 'super_admin';
        expect(allowed, `${actor} → ${target}`).toBe(shouldAllow);
      }
    }
  });
});

describe('pesan bantuan', () => {
  it('menyebut setiap role yang diterima agar operator dapat memperbaiki berkasnya', () => {
    const text = describeAllowedRoles();
    for (const role of ['super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang', 'viewer']) {
      expect(text).toContain(role);
    }
  });
});
