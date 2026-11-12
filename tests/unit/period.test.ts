import { describe, it, expect } from 'vitest';
import { resolvePeriodRange, toSinglePeriodQuery, toRangeQuery } from '@/lib/period';

const FALLBACK = new Date('2026-11-11T00:00:00Z');

describe('resolvePeriodRange', () => {
  it('menafsirkan label YTD sebagai Januari sampai bulan tersebut', () => {
    const range = resolvePeriodRange('YTD Sep 2026', FALLBACK);
    expect(range).toMatchObject({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 9,
    });
  });

  it('menafsirkan FY sebagai setahun penuh', () => {
    expect(resolvePeriodRange('FY 2025', FALLBACK)).toMatchObject({
      startYear: 2025,
      startMonth: 1,
      endYear: 2025,
      endMonth: 12,
    });
  });

  it('menerima variasi penulisan tahun penuh', () => {
    for (const label of ['Full Year 2025', 'Tahun 2025', '2025']) {
      expect(resolvePeriodRange(label, FALLBACK)).toMatchObject({
        startYear: 2025,
        startMonth: 1,
        endYear: 2025,
        endMonth: 12,
      });
    }
  });

  it('menafsirkan kuartal menjadi tiga bulan', () => {
    expect(resolvePeriodRange('Q3 2026', FALLBACK)).toMatchObject({ startMonth: 7, endMonth: 9 });
    expect(resolvePeriodRange('Q1 2026', FALLBACK)).toMatchObject({ startMonth: 1, endMonth: 3 });
    expect(resolvePeriodRange('Q4 2026', FALLBACK)).toMatchObject({ startMonth: 10, endMonth: 12 });
  });

  it('menafsirkan bulan tunggal tanpa YTD sebagai satu bulan', () => {
    expect(resolvePeriodRange('Sep 2026', FALLBACK)).toMatchObject({
      startMonth: 9,
      endMonth: 9,
    });
  });

  it('mendukung nama bulan berbahasa Indonesia', () => {
    expect(resolvePeriodRange('Des 2025', FALLBACK)).toMatchObject({ startMonth: 12, endMonth: 12 });
    expect(resolvePeriodRange('Agustus 2025', FALLBACK)).toMatchObject({ startMonth: 8, endMonth: 8 });
    expect(resolvePeriodRange('Mei 2025', FALLBACK)).toMatchObject({ startMonth: 5, endMonth: 5 });
  });

  it('mendukung format ISO tahun-bulan', () => {
    expect(resolvePeriodRange('2026-09', FALLBACK)).toMatchObject({
      startYear: 2026,
      startMonth: 9,
      endYear: 2026,
      endMonth: 9,
    });
  });

  it('membatasi bulan ISO yang tidak valid ke rentang 1..12', () => {
    expect(resolvePeriodRange('2026-00', FALLBACK).endMonth).toBe(1);
    expect(resolvePeriodRange('2026-99', FALLBACK).endMonth).toBe(12);
  });

  it('memakai fallback YTD ketika label kosong atau tidak dikenali', () => {
    for (const label of ['', null, undefined, 'entah apa ini']) {
      const range = resolvePeriodRange(label as string | null | undefined, FALLBACK);
      expect(range.startYear).toBe(2026);
      expect(range.startMonth).toBe(1);
      expect(range.endYear).toBe(2026);
      expect(range.endMonth).toBe(11);
    }
  });

  it('tidak pernah memakai tahun hardcode untuk label tak dikenal', () => {
    const range = resolvePeriodRange('periode aneh', new Date('2031-03-15T00:00:00Z'));
    expect(range.endYear).toBe(2031);
    expect(range.endMonth).toBe(3);
  });
});

describe('query helpers', () => {
  it('toSinglePeriodQuery memakai akhir periode', () => {
    const range = resolvePeriodRange('YTD Sep 2026', FALLBACK);
    expect(toSinglePeriodQuery(range)).toEqual({ year: '2026', month: '9' });
  });

  it('toRangeQuery mengembalikan batas awal dan akhir', () => {
    const range = resolvePeriodRange('Q3 2026', FALLBACK);
    expect(toRangeQuery(range)).toEqual({
      startYear: '2026',
      startMonth: '7',
      endYear: '2026',
      endMonth: '9',
    });
  });
});
