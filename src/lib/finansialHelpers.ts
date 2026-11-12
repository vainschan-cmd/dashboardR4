import type { FinansialEntitas, FinansialRecord, FinansialRekening } from './types';

export const FINANSIAL_REKENING_LIST: readonly FinansialRekening[] = [
  'Pendapatan',
  'Beban',
  'Laba Usaha',
  'Laba Bersih',
] as const;

export const FINANSIAL_ENTITAS_LIST: readonly FinansialEntitas[] = [
  'CABANG',
  'PMT',
  'PTP',
  'PSL',
  'PJM',
  'ELIMINASI',
] as const;

export const ENTITAS_SEMUA = 'SEMUA' as const;

const BULAN_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function getMonthNameId(bulan: number): string {
  return BULAN_NAMES_ID[bulan - 1] || `Bulan ${bulan}`;
}

/**
 * Memetakan label REKENING ke 4 kategori standar.
 */
export function canonicalRekening(raw?: unknown): FinansialRekening {
  const lower = String(raw ?? '').trim().toLowerCase();
  if (lower.includes('beban') || lower.includes('biaya') || lower.includes('expense')) {
    return 'Beban';
  }
  if (lower.includes('bersih')) {
    return 'Laba Bersih';
  }
  if (lower.includes('laba')) {
    return 'Laba Usaha';
  }
  return 'Pendapatan';
}

export function slugKey(str: unknown): string {
  return (
    String(str ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'item'
  );
}

export function getFinansialRowId(
  tahun: number,
  bulan: number,
  kodeCbg: string,
  rekening: string,
  entitas: string
): string {
  return `mod_fin_${tahun}_${bulan}_${kodeCbg}_${slugKey(rekening)}_${slugKey(entitas)}`;
}

export function getFinansialMonthlyRecordId(
  tahun: number,
  bulan: number,
  kodeCbg: string,
  rekening: string
): string {
  const rek = canonicalRekening(rekening);
  let indId = 'kpi_rev';
  if (rek === 'Beban') indId = 'kpi_cost';
  else if (rek === 'Laba Bersih') indId = 'kpi_net_profit';
  else if (rek === 'Laba Usaha') indId = 'kpi_profit';
  return `rec_fin_${tahun}_${bulan}_${kodeCbg}_${indId}`;
}

export function getIndicatorIdForRekening(rekening: string): string {
  const rek = canonicalRekening(rekening);
  if (rek === 'Beban') return 'kpi_cost';
  if (rek === 'Laba Bersih') return 'kpi_net_profit';
  if (rek === 'Laba Usaha') return 'kpi_profit';
  return 'kpi_rev';
}

/**
 * Parser aman untuk REALISASI nominal Rupiah (mendukung angka negatif untuk Beban & ELIMINASI).
 */
export function parseRealisasi(val: unknown): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (val === null || val === undefined) return 0;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return 0;
  const cleaned = trimmed.replace(/\s+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parser aman untuk kolom RKA / YOY. Mengembalikan null jika nilai '-', kosong, atau tidak valid (mencegah NaN).
 */
export function parseMetricPercent(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '—' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'nan' ||
    trimmed.toLowerCase() === 'n/a'
  ) {
    return null;
  }
  const normalized = trimmed.replace(/%/g, '').replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * Normalisasi nilai RKA atau YOY menjadi angka atau literal '-' sesuai skema standar.
 */
export function normalizeRkaYoyValue(val: unknown, realisasi?: number): number | '-' {
  const parsed = parseMetricPercent(val);
  if (parsed === null) return '-';
  if (realisasi === 0 && String(val ?? '').trim() === '-') return '-';
  return parsed;
}

/**
 * Format RKA atau YOY menjadi 2 angka desimal dengan '%', atau '-' jika tidak tersedia / strip.
 */
export function formatPercentOrDash(val: unknown): string {
  const parsed = parseMetricPercent(val);
  if (parsed === null) return '-';
  return `${parsed.toFixed(2)}%`;
}

/**
 * Hitung rata-rata hanya dari nilai RKA/YOY numerik yang valid (mengabaikan '-').
 * Mengembalikan '-' bila tidak ada nilai valid agar tidak memunculkan NaN atau 0 palsu.
 */
export function averageValidMetric(values: Array<number | string | null | undefined>): number | '-' {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    const parsed = parseMetricPercent(v);
    if (parsed !== null) {
      sum += parsed;
      count++;
    }
  }
  if (count === 0) return '-';
  return Number((sum / count).toFixed(2));
}

export interface RekeningAggregation {
  realisasi: number;
  rka: number | '-';
  yoy: number | '-';
  rowCount: number;
  activeRowCount: number;
}

/**
 * Agregasi metrik finansial per REKENING.
 * Pada mode konsolidasi (ENTITAS === 'SEMUA' / 'ALL'), menjumlahkan REALISASI dari seluruh entitas TERMASUK baris ELIMINASI.
 */
export function aggregateFinansialByRekening(
  rows: FinansialRecord[],
  selectedEntitas: string = ENTITAS_SEMUA
): Record<FinansialRekening, RekeningAggregation> {
  const isConsolidation =
    !selectedEntitas ||
    selectedEntitas.toUpperCase() === ENTITAS_SEMUA ||
    selectedEntitas.toUpperCase() === 'ALL';

  const scopedRows = isConsolidation
    ? rows
    : rows.filter(r => String(r.ENTITAS || '').trim().toUpperCase() === selectedEntitas.toUpperCase());

  const result: Record<FinansialRekening, RekeningAggregation> = {
    Pendapatan: { realisasi: 0, rka: '-', yoy: '-', rowCount: 0, activeRowCount: 0 },
    Beban: { realisasi: 0, rka: '-', yoy: '-', rowCount: 0, activeRowCount: 0 },
    'Laba Usaha': { realisasi: 0, rka: '-', yoy: '-', rowCount: 0, activeRowCount: 0 },
    'Laba Bersih': { realisasi: 0, rka: '-', yoy: '-', rowCount: 0, activeRowCount: 0 },
  };

  for (const rek of FINANSIAL_REKENING_LIST) {
    const matching = scopedRows.filter(r => canonicalRekening(r.REKENING) === rek);
    const totalRealisasi = matching.reduce((sum, r) => sum + parseRealisasi(r.REALISASI), 0);
    // Hanya hitung RKA/YOY rata-rata dari baris aktif (non-strip & idealnya realisasi !== 0)
    const activeRows = matching.filter(r => parseRealisasi(r.REALISASI) !== 0);
    const metricSource = activeRows.length > 0 ? activeRows : matching;

    result[rek] = {
      realisasi: totalRealisasi,
      rka: averageValidMetric(metricSource.map(r => r.RKA)),
      yoy: averageValidMetric(metricSource.map(r => r.YOY)),
      rowCount: matching.length,
      activeRowCount: activeRows.length,
    };
  }

  return result;
}

