import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_NAV_ITEMS,
  getVisibleGovernanceNavItems,
  isAnomalyDeviation,
  escapeCsvCell,
} from '@/lib/governanceNav';

describe('Arsitektur Navigasi & Utilitas Tata Kelola', () => {
  it('menyusun menu Tata Kelola mengikuti siklus kerja data lalu administrasi', () => {
    expect(GOVERNANCE_NAV_ITEMS.map((item) => item.id)).toEqual([
      'import_center',
      'verification',
      'data_records',
      'master_data',
      'templates',
      'audit_trail',
    ]);
    expect(GOVERNANCE_NAV_ITEMS.slice(0, 3).every((i) => i.group === 'data_cycle')).toBe(true);
    expect(GOVERNANCE_NAV_ITEMS.slice(3).every((i) => i.group === 'administration')).toBe(true);
  });

  it('menampilkan seluruh 6 menu Tata Kelola untuk Super Admin dan Admin Regional', () => {
    expect(getVisibleGovernanceNavItems('super_admin', true)).toHaveLength(6);
    expect(getVisibleGovernanceNavItems('admin_regional', true)).toHaveLength(6);
  });

  it('menyembunyikan menu administrasi dari PIC Cabang & PIC Dept Regional', () => {
    const picCabangIds = getVisibleGovernanceNavItems('pic_cabang', false).map((i) => i.id);
    expect(picCabangIds).toEqual(['import_center', 'verification', 'data_records']);

    const picDeptIds = getVisibleGovernanceNavItems('pic_dept_regional', false).map((i) => i.id);
    expect(picDeptIds).toEqual(['import_center', 'verification', 'data_records']);
  });

  it('menyembunyikan seluruh menu Tata Kelola dari BOD Viewer', () => {
    expect(getVisibleGovernanceNavItems('viewer', false)).toEqual([]);
  });

  it('mendeteksi deviasi anomali pada antrean verifikasi', () => {
    expect(isAnomalyDeviation(102, 100, 102).flagged).toBe(false);
    expect(isAnomalyDeviation(85, 100, 85).flagged).toBe(false);
    expect(isAnomalyDeviation(0, 100, 0).flagged).toBe(true);
    expect(isAnomalyDeviation(165, 100, 165).flagged).toBe(true);
    expect(isAnomalyDeviation(54, 100, 54).flagged).toBe(true);
  });

  it('mengamankan sel CSV dari formula injection dan tanda kutip', () => {
    expect(escapeCsvCell('=SUM(A1:A5)')).toBe("'=SUM(A1:A5)");
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('-cmd')).toBe("'-cmd");
    expect(escapeCsvCell('@eval')).toBe("'@eval");
    expect(escapeCsvCell('Makassar, R01')).toBe('"Makassar, R01"');
    expect(escapeCsvCell('Nilai "Tinggi"')).toBe('"Nilai ""Tinggi"""');
    expect(escapeCsvCell(null)).toBe('');
  });
});
