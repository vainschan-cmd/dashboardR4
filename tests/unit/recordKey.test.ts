import { describe, it, expect } from 'vitest';
import { buildRecordKey, isDeterministicRecordId, hasValueChanged } from '@/lib/recordKey';

describe('buildRecordKey', () => {
  it('menghasilkan kunci stabil tanpa timestamp', () => {
    const key = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R01',
      indicatorCode: 'FIN-01',
    });
    expect(key).toBe('rec_imp_2026_09_r01_fin-01');
  });

  it('deterministik: pemanggilan berulang menghasilkan id sama', () => {
    const input = { year: 2026, month: 9, branchCode: 'R01', indicatorCode: 'FIN-01' };
    const first = buildRecordKey(input);
    const second = buildRecordKey(input);
    const third = buildRecordKey({ ...input });
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('tidak bergantung pada huruf besar/kecil dan spasi di ujung', () => {
    const canonical = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R01',
      indicatorCode: 'FIN-01',
    });
    // Kode disimpan kanonik (R01 / FIN-01); yang penting variasi kapitalisasi dan
    // spasi di ujung menghasilkan kunci yang sama persis.
    expect(
      buildRecordKey({ year: 2026, month: 9, branchCode: ' r01 ', indicatorCode: 'fin-01' })
    ).toBe(canonical);
    expect(
      buildRecordKey({ year: 2026, month: 9, branchCode: 'R01', indicatorCode: 'FIN 01' })
    ).toBe(canonical);
  });

  it('menormalkan pemisah yang berbeda secara konsisten', () => {
    // Kode yang mengandung spasi/pemisah dipetakan ke bentuk yang sama, sehingga
    // input "R 01" dan "R-01" tidak menghasilkan dua baris berbeda.
    const withSpace = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R 01',
      indicatorCode: 'FIN 01',
    });
    const withDash = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R-01',
      indicatorCode: 'FIN-01',
    });
    expect(withSpace).toBe(withDash);
  });

  it('membedakan bulan dan tahun', () => {
    const base = { branchCode: 'R01', indicatorCode: 'FIN-01' };
    const ids = new Set([
      buildRecordKey({ ...base, year: 2026, month: 8 }),
      buildRecordKey({ ...base, year: 2026, month: 9 }),
      buildRecordKey({ ...base, year: 2025, month: 9 }),
    ]);
    expect(ids.size).toBe(3);
  });

  it('membedakan cabang dan indikator', () => {
    const base = { year: 2026, month: 9 };
    const ids = new Set([
      buildRecordKey({ ...base, branchCode: 'R01', indicatorCode: 'FIN-01' }),
      buildRecordKey({ ...base, branchCode: 'R02', indicatorCode: 'FIN-01' }),
      buildRecordKey({ ...base, branchCode: 'R01', indicatorCode: 'FIN-02' }),
    ]);
    expect(ids.size).toBe(3);
  });

  it('memberi padding bulan dua digit agar urutannya konsisten', () => {
    expect(buildRecordKey({ year: 2026, month: 1, branchCode: 'R01', indicatorCode: 'X' })).toContain(
      '_2026_01_'
    );
    expect(buildRecordKey({ year: 2026, month: 12, branchCode: 'R01', indicatorCode: 'X' })).toContain(
      '_2026_12_'
    );
  });

  it('menangani nilai yang tidak valid tanpa membuat id kosong', () => {
    const key = buildRecordKey({
      year: Number.NaN,
      month: Number.NaN,
      branchCode: '',
      indicatorCode: '',
    });
    expect(key.startsWith('rec_imp_')).toBe(true);
    expect(key.length).toBeGreaterThan('rec_imp_'.length);
  });

  it('tidak mengandung karakter yang merepotkan di URL atau SQL', () => {
    const key = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R/01;DROP',
      indicatorCode: 'FIN 01',
    });
    expect(key).toMatch(/^[a-z0-9_-]+$/);
    expect(key).not.toContain('/');
    expect(key).not.toContain(';');
    expect(key).not.toContain(' ');
  });
});

describe('isDeterministicRecordId', () => {
  it('mengenali id hasil buildRecordKey', () => {
    expect(isDeterministicRecordId('rec_imp_2026_09_r01_fin-01')).toBe(true);
  });

  it('menolak id lama yang membawa timestamp', () => {
    // Bentuk lama: rec_imp_2026_9_r01_fin-01_1731200000000_4
    expect(isDeterministicRecordId('rec_imp_2026_9_r01_fin-01_1731200000000_4')).toBe(false);
  });

  it('menolak id manual dan nilai kosong', () => {
    expect(isDeterministicRecordId('')).toBe(false);
    expect(isDeterministicRecordId('rec_manual_1')).toBe(false);
    expect(isDeterministicRecordId(undefined as unknown as string)).toBe(false);
  });
});

describe('hasValueChanged', () => {
  const base = { target: 100, realization: 90, unit: 'Rp' };

  it('menganggap identik sebagai tidak berubah', () => {
    expect(hasValueChanged({ ...base }, { ...base })).toBe(false);
  });

  it('mengabaikan selisih floating point sangat kecil', () => {
    expect(hasValueChanged({ ...base, realization: 90.0000000001 }, base)).toBe(false);
  });

  it('mendeteksi perubahan realisasi', () => {
    expect(hasValueChanged({ ...base, realization: 91 }, base)).toBe(true);
  });

  it('mendeteksi perubahan target', () => {
    expect(hasValueChanged({ ...base, target: 101 }, base)).toBe(true);
  });

  it('mendeteksi perubahan satuan', () => {
    expect(hasValueChanged({ ...base, unit: 'USD' }, base)).toBe(true);
  });

  it('memperlakukan spasi berlebih pada satuan sebagai sama', () => {
    expect(hasValueChanged({ ...base, unit: ' Rp ' }, base)).toBe(false);
  });

  it('memperlakukan satuan kosong dan null sebagai sama', () => {
    expect(hasValueChanged({ ...base, unit: '' }, { ...base, unit: null })).toBe(false);
    expect(hasValueChanged({ ...base, unit: undefined }, { ...base, unit: null })).toBe(false);
  });

  it('memperlakukan NaN/undefined sebagai nol', () => {
    expect(
      hasValueChanged(
        { target: Number.NaN, realization: 0, unit: 'Rp' },
        { target: 0, realization: 0, unit: 'Rp' }
      )
    ).toBe(false);
  });
});

describe('skenario impor ulang', () => {
  it('impor file yang sama dua kali menyentuh kunci yang sama', () => {
    const rows = [
      { year: 2026, month: 9, branchCode: 'R01', indicatorCode: 'FIN-01' },
      { year: 2026, month: 9, branchCode: 'R02', indicatorCode: 'FIN-01' },
    ];
    const firstImport = rows.map(buildRecordKey);
    const secondImport = rows.map(buildRecordKey);
    expect(secondImport).toEqual(firstImport);
  });

  it('impor periode berbeda menghasilkan kunci berbeda', () => {
    const sept = buildRecordKey({
      year: 2026,
      month: 9,
      branchCode: 'R01',
      indicatorCode: 'FIN-01',
    });
    const okt = buildRecordKey({
      year: 2026,
      month: 10,
      branchCode: 'R01',
      indicatorCode: 'FIN-01',
    });
    expect(sept).not.toBe(okt);
  });
});
