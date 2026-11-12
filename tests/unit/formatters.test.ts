import { describe, it, expect } from 'vitest';
import {
  MONTH_NAMES_ID,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNominalFull,
  formatNumber,
  formatPercent,
  formatPercentDelta,
  formatRupiahCompact,
  formatRupiahFull,
} from '@/lib/formatters';
import { GLOSSARY, glossaryTooltip, lookupGlossary } from '@/lib/glossary';

/**
 * `COPY-03` and `COPY-02`.
 *
 * The bug this pins down: the same screen showed `99.01` (from `toFixed`) next to
 * `99,01` (from `toLocaleString('id-ID')`). A formatter is only useful if the
 * decimal separator is guaranteed, so every helper is asserted on that.
 */

describe('formatNumber', () => {
  it('memakai titik sebagai pemisah ribuan dan koma sebagai desimal', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatNumber(1234.5, 1)).toBe('1.234,5');
    expect(formatNumber(99.0149, 2)).toBe('99,01');
  });

  it('tidak pernah menghasilkan titik desimal ala toFixed', () => {
    for (const value of [1.5, 99.01, 1234.56, -7.25]) {
      const formatted = formatNumber(value, 2);
      expect(formatted, `${value}`).not.toMatch(/\.\d{1,2}$/);
    }
  });

  it('mengembalikan "0" untuk nilai yang tidak dapat dipakai', () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      expect(formatNumber(value)).toBe('0');
    }
  });
});

describe('formatPercent', () => {
  it('menambahkan tanda persen dan koma desimal', () => {
    expect(formatPercent(99.0149, 2)).toBe('99,01%');
    expect(formatPercent(92, 1)).toBe('92,0%');
  });

  it('memakai em dash untuk data yang belum ada, bukan 0%', () => {
    // "0%" and "belum dilaporkan" are different statements; conflating them is how
    // a missing figure gets read as a catastrophic performance result.
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatPercent(null, 2, { missing: 'Belum Lapor' })).toBe('Belum Lapor');
  });

  it('hanya menambahkan tanda plus bila diminta dan nilainya positif', () => {
    expect(formatPercent(5, 1, { withSign: true })).toBe('+5,0%');
    expect(formatPercent(-5, 1, { withSign: true })).toBe('-5,0%');
    expect(formatPercent(0, 1, { withSign: true })).toBe('0,0%');
    expect(formatPercent(5, 1)).toBe('5,0%');
  });
});

describe('formatPercentDelta', () => {
  it('menghitung selisih terhadap indeks 100', () => {
    expect(formatPercentDelta(99)).toBe('-1,0%');
    expect(formatPercentDelta(105.4)).toBe('+5,4%');
    expect(formatPercentDelta(100)).toBe('0,0%');
  });

  it('menolak nilai kosong dengan em dash', () => {
    expect(formatPercentDelta(null)).toBe('—');
  });
});

describe('formatRupiah', () => {
  it('meringkas ke T / M / Jt', () => {
    expect(formatRupiahCompact(3_190_000_000_000)).toBe('Rp 3,19 T');
    expect(formatRupiahCompact(751_820_000_000)).toBe('Rp 751,82 M');
    expect(formatRupiahCompact(12_500_000)).toBe('Rp 12,5 Jt');
  });

  it('menjaga tanda negatif di depan angka', () => {
    expect(formatRupiahCompact(-2_420_000_000_000)).toBe('Rp -2,42 T');
    expect(formatRupiahFull(-1500)).toBe('Rp -1.500');
  });

  it('menampilkan nominal penuh dengan pemisah ribuan', () => {
    expect(formatRupiahFull(6794956407643)).toBe('Rp 6.794.956.407.643');
    expect(formatNominalFull(1234567)).toBe('1.234.567');
  });

  it('menangani nilai kosong tanpa melempar', () => {
    expect(formatRupiahFull(null)).toBe('Rp 0');
    expect(formatRupiahCompact(NaN)).toBe('Rp 0');
    expect(formatNominalFull(undefined)).toBe('0');
  });
});

describe('format tanggal', () => {
  it('memakai nama bulan Indonesia, bukan format angka', () => {
    expect(formatMonthYear(2026, 9)).toBe('September 2026');
    expect(formatMonthYear(2026, 1)).toBe('Januari 2026');
    expect(formatMonthYear(2026, 12)).toBe('Desember 2026');
  });

  it('menolak bulan di luar 1–12', () => {
    expect(formatMonthYear(2026, 0)).toBe('—');
    expect(formatMonthYear(2026, 13)).toBe('—');
  });

  it('memformat tanggal tanpa MM/DD/YYYY', () => {
    expect(formatDate('2026-09-12T10:00:00Z')).toMatch(/^12 September 2026$/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('bukan tanggal')).toBe('—');
  });

  it('memakai titik pada jam, sesuai kebiasaan Indonesia', () => {
    const formatted = formatDateTime('2026-09-12T08:30:00');
    expect(formatted).toBe('12 September 2026, 08.30');
  });

  it('menyediakan dua belas nama bulan', () => {
    expect(MONTH_NAMES_ID).toHaveLength(12);
    expect(MONTH_NAMES_ID[7]).toBe('Agustus');
  });
});

describe('glosarium (COPY-02)', () => {
  it('mendefinisikan setiap istilah yang muncul tanpa penjelasan di UI', () => {
    for (const term of ['BOPO', 'RKA', 'YoY', 'BOR', 'YOR', 'SOR', 'WTP', 'ET:BT']) {
      const entry = lookupGlossary(term);
      expect(entry, `${term} belum ada di glosarium`).not.toBeNull();
      expect(entry?.expansion.length ?? 0).toBeGreaterThan(3);
      expect(entry?.definition.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('tidak membedakan huruf besar/kecil dan spasi di sekitarnya', () => {
    expect(lookupGlossary('  bopo ')?.term).toBe('BOPO');
    expect(lookupGlossary('bor')?.term).toBe('BOR');
  });

  it('mengembalikan null untuk istilah yang tidak dikenal', () => {
    expect(lookupGlossary('XYZ')).toBeNull();
    expect(glossaryTooltip('XYZ')).toBeNull();
  });

  it('menyusun tooltip yang memuat singkatan, kepanjangan, dan definisi', () => {
    const tooltip = glossaryTooltip('BOR');
    expect(tooltip).toContain('BOR');
    expect(tooltip).toContain('Berth Occupancy Ratio');
    expect(tooltip).toContain('dermaga');
  });

  it('setiap kunci cocok dengan istilahnya sendiri', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term.toUpperCase()).toBe(key.toUpperCase());
    }
  });
});
