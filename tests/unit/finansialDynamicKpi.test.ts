import { describe, it, expect } from 'vitest';
import { queryFinansialConsolidatedKpis } from '@/lib/finansialConsolidationService';

describe('Finansial Dynamic KPI Calculations (YoY & RKA)', () => {
  it('calculates dynamic YoY and RKA for 2026-09 based on Realisasi', async () => {
    const kpis = await queryFinansialConsolidatedKpis({
      verifiedOnly: false,
      year: 2026,
      month: 9,
      nmCbgList: null,
      branchCodes: null,
      rbacBranchCodes: null,
      entitas: null,
    });

    // Realisasi 2026-09: ~3.29T vs 2025-09: ~3.39T -> YoY ~97.09% (NOT static 103%)
    expect(kpis.pendapatan.realisasi).toBeGreaterThan(3e12);
    expect(kpis.pendapatan.yoy).toBeCloseTo(97.09, 1);
    expect(kpis.pendapatan.rka).toBeCloseTo(99.01, 1);

    // Beban 2026-09: ~ -2.49T vs 2025-09: ~ -2.57T -> YoY ~97.00%
    expect(kpis.beban.realisasi).toBeLessThan(-2e12);
    expect(kpis.beban.yoy).toBeCloseTo(97.00, 1);
    expect(kpis.beban.rka).toBeCloseTo(99.01, 1);

    // Laba Bersih 2026-09: ~775M vs 2025-09: ~799M -> YoY ~97.00%
    expect(kpis.labaBersih.realisasi).toBeGreaterThan(7e11);
    expect(kpis.labaBersih.yoy).toBeCloseTo(97.00, 1);
    expect(kpis.labaBersih.rka).toBeCloseTo(99.01, 1);

    // BOPO: Beban / Pendapatan * 100
    expect(kpis.bopo.value).toBeCloseTo(75.77, 1);
  });

  it('handles YoY as null when prior year data does not exist (2025-09)', async () => {
    const kpis = await queryFinansialConsolidatedKpis({
      verifiedOnly: false,
      year: 2025,
      month: 9,
      nmCbgList: null,
      branchCodes: null,
      rbacBranchCodes: null,
      entitas: null,
    });

    // In 2025, 2024 data does not exist, so YoY should be null
    expect(kpis.pendapatan.yoy).toBeNull();
    expect(kpis.beban.yoy).toBeNull();
    expect(kpis.labaBersih.yoy).toBeNull();

    // RKA in 2025 was budgeted at 105.26%
    expect(kpis.pendapatan.rka).toBeCloseTo(105.26, 1);
  });

  it('dynamically computes YoY and RKA for a single filtered branch (Makassar)', async () => {
    const kpis = await queryFinansialConsolidatedKpis({
      verifiedOnly: false,
      year: 2026,
      month: 9,
      nmCbgList: ['Makassar'],
      branchCodes: null,
      rbacBranchCodes: null,
      entitas: null,
    });

    // Makassar Pendapatan 2026 (~269.56M) vs 2025 (~277.90M) -> YoY 97.00%
    expect(kpis.pendapatan.realisasi).toBeGreaterThan(2e11);
    expect(kpis.pendapatan.yoy).toBeCloseTo(97.00, 1);
    expect(kpis.pendapatan.rka).toBeCloseTo(99.01, 1);
  });
});
