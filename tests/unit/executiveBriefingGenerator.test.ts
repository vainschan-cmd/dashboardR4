import { describe, it, expect } from 'vitest';
import { generateExecutiveBriefingHtml } from '@/lib/executiveBriefingGenerator';
import { MonthlyRecord, Branch } from '@/lib/types';

describe('Executive BOD Briefing & PDF Exporter (FEAT-06)', () => {
  it('generates a complete HTML executive briefing document with Pelindo BOD branding', () => {
    const mockBranches: Branch[] = [
      {
        id: 'branch_makassar',
        code: 'R01',
        name: 'Pelabuhan Makassar',
        region: 'Regional 4',
        address: 'Jl. Nusantara No. 1 Makassar',
        phone: '0411-123456',
        email: 'makassar@pelindo.co.id',
        active: true,
        facilities: {},
      },
    ];

    const mockRecords: MonthlyRecord[] = [
      {
        id: 'rec_1',
        branch_id: 'branch_makassar',
        branch_code: 'R01',
        branch_name: 'Pelabuhan Makassar',
        department_id: 'dept_keu',
        department_name: 'Keuangan',
        indicator_id: 'kpi_rev',
        indicator_code: 'KEU-REV',
        indicator_name: 'Pendapatan Usaha',
        year: 2026,
        month: 9,
        target: 2000,
        realization: 2100,
        unit: 'Miliar Rp',
        direction: 'higher_is_better',
        verification_status: 'verified',
        created_at: '2026-09-30',
        updated_at: '2026-09-30',
      },
      {
        id: 'rec_2',
        branch_id: 'branch_makassar',
        branch_code: 'R01',
        branch_name: 'Pelabuhan Makassar',
        department_id: 'dept_keu',
        department_name: 'Keuangan',
        indicator_id: 'kpi_cost',
        indicator_code: 'KEU-COST',
        indicator_name: 'Beban Usaha',
        year: 2026,
        month: 9,
        target: 1400,
        realization: 1350,
        unit: 'Miliar Rp',
        direction: 'lower_is_better',
        verification_status: 'verified',
        created_at: '2026-09-30',
        updated_at: '2026-09-30',
      },
    ];

    const html = generateExecutiveBriefingHtml({
      records: mockRecords,
      branches: mockBranches,
      month: 9,
      year: 2026,
      generatedBy: 'Direktur Utama',
    });

    expect(html).toContain('EXECUTIVE BRIEFING REPORT');
    expect(html).toContain('Bulan 9 Tahun 2026');
    expect(html).toContain('Direktur Utama');
    expect(html).toContain('Pelabuhan Makassar');
    expect(html).not.toContain('onclick=');
    expect(html).toContain('@media print');
  });
});
