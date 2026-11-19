import { ENTITY_CHART_COLORS } from './chartPalette';
import { getCanonicalBranchCode } from './constants';
import type {
  PeralatanGrupEntitas,
  PeralatanKondisi,
  PeralatanRecord,
} from './types';

export const PERALATAN_ENTITAS_LIST: PeralatanGrupEntitas[] = ['R4', 'PMT', 'MTI', 'PTP'];

export const PERALATAN_ENTITAS_COLORS: Record<PeralatanGrupEntitas, string> = {
  R4: ENTITY_CHART_COLORS.CABANG,   // '#2563eb' (Biru) - Cabang Regional 4 (sesuai Summary CABANG)
  PMT: ENTITY_CHART_COLORS.PMT,     // '#94a3b8' (Abu-abu) - Pelindo Multi Terminal
  MTI: ENTITY_CHART_COLORS.PSL,     // '#ca8a04' (Kuning tua / Emas) - Pelindo Solusi Logistik / MTI
  PTP: ENTITY_CHART_COLORS.PTP,     // '#f97316' (Orange) - Pelindo Terminal Petikemas
};

export const PERALATAN_KATEGORI_LIST = ['Alat CY', 'Alat Dermaga', 'Alat Bantu'] as const;

export const PERALATAN_KONDISI_LIST: PeralatanKondisi[] = [
  'READY',
  'READY DENGAN CATATAN',
  'BREAKDOWN',
  'USUL/PROSES PENGHAPUSAN',
];

export const PERALATAN_JENIS_ALAT_LIST = [
  'Quay Container Crane',
  'Rubber Tyred Gantry Crane',
  'Reach Stacker',
  'Head Truck',
  'Terminal Tractor',
  'Chassis',
  'Forklift',
  'Mobile Crane',
  'Side Loader',
  'Tronton',
  'EXCAVATOR',
  'CRAWLER CRANE',
  'FIXED CRANE',
  'Grab',
  'Hopper',
  'Lowbad',
  'Ramp Door',
  'Trailer',
  'Truk',
] as const;

const PERALATAN_BRANCH_CODE_OVERRIDES: Record<string, string> = {
  tpkambon: 'R07',
  ambon: 'R07',
  mtibitung: 'R05',
  terminalpetikemasbitung: 'R06',
  tpkbitung: 'R06',
  bitung: 'R05',
  tpkjayapura: 'R09',
  jayapura: 'R09',
  tpkkendari: 'R13',
  kendari: 'R13',
  tpkmerauke: 'R16',
  merauke: 'R16',
  tpkpantoloan: 'R11',
  pantoloan: 'R11',
  tpksorong: 'R08',
  sorong: 'R08',
  tpktarakan: 'R10',
  tarakan: 'R10',
  tpkternate: 'R12',
  ternate: 'R12',
  terminalpetikemasmakassar: 'R02',
  tpkmakassar: 'R02',
  mtimakassar: 'R01',
  pmtmakassar: 'R01',
  makassarnewport: 'R24',
  mnp: 'R24',
  kkt: 'R26',
  tgredeb: 'R19',
  tanjungredeb: 'R19',
};

/**
 * Resolves a branch code (R01..R26) from Nama Cabang for RBAC scoping and Beranda matching
 * while preserving the exact Nama Cabang label from dataset.
 */
export function resolvePeralatanBranchCode(namaCabang: string, fallbackCode?: string): string {
  const cleaned = String(namaCabang || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (cleaned && PERALATAN_BRANCH_CODE_OVERRIDES[cleaned]) {
    return PERALATAN_BRANCH_CODE_OVERRIDES[cleaned];
  }
  const canonicalFromName = getCanonicalBranchCode(undefined, namaCabang);
  if (canonicalFromName) return canonicalFromName;
  const canonicalFromFallback = getCanonicalBranchCode(fallbackCode);
  if (canonicalFromFallback) return canonicalFromFallback;
  return String(fallbackCode || '').trim().toUpperCase() || 'R99';
}

/**
 * Converts Excel date serial numbers, Date objects, YYYY-MM-DD, or DD/MM/YYYY into 'YYYY-MM-DD'.
 */
export function normalizeTanggalISO(val: unknown): string {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' && Number.isFinite(val) && val > 20000) {
    // Convert Excel 1900-epoch serial number safely in UTC
    const utcMs = Math.round((val - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  const raw = String(val ?? '').trim();
  if (!raw) return '';

  // Pure numeric string representing Excel serial
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    return normalizeTanggalISO(Number(raw));
  }

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

export function formatTanggalID(isoDate: string): string {
  const normalized = normalizeTanggalISO(isoDate);
  if (!normalized) return isoDate || '-';
  const [y, m, d] = normalized.split('-');
  return `${d}/${m}/${y}`;
}

export function normalizeGrupEntitas(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes condition string strictly into the 4 standard values:
 * READY, READY DENGAN CATATAN, BREAKDOWN, USUL/PROSES PENGHAPUSAN.
 */
export function normalizeKondisi(val: unknown): PeralatanKondisi | string {
  const cleaned = String(val ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  if (!cleaned) return 'READY';
  if (cleaned === 'READY') return 'READY';
  if (cleaned.includes('CATATAN')) return 'READY DENGAN CATATAN';
  if (cleaned.includes('BREAKDOWN') || cleaned.includes('RUSAK')) return 'BREAKDOWN';
  if (cleaned.includes('USUL') || cleaned.includes('PENGHAPUSAN')) {
    return 'USUL/PROSES PENGHAPUSAN';
  }
  return cleaned;
}

/**
 * Normalizes Kerusakan / Tindak Lanjut: treats '-', '—', whitespace, or empty string as null.
 */
export function normalizeNullableText(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const text = String(val).replace(/\r\n/g, '\n').trim();
  if (
    !text ||
    text === '-' ||
    text === '—' ||
    text === '--' ||
    text.toLowerCase() === 'null' ||
    text.toLowerCase() === 'undefined'
  ) {
    return null;
  }
  return text;
}

export function displayNullableText(val: string | null | undefined): string {
  if (!val) return '-';
  const trimmed = String(val).trim();
  return trimmed && trimmed !== '-' ? trimmed : '-';
}

/**
 * RFC-4180 compliant CSV parser handling quoted fields ("..."), escaped quotes (""),
 * and embedded newlines inside quoted cells, while ignoring leading blank rows (e.g., `,,,,,,,,`).
 */
export function parsePeralatanCsvRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (i + 1 < cleanText.length && cleanText[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

export interface PeralatanKpiSummary {
  total: number;
  ready: number;
  readyDenganCatatan: number;
  usulPenghapusan: number;
  breakdown: number;
  rfuPct: number;
}

export function aggregatePeralatanKpis(rows: PeralatanRecord[]): PeralatanKpiSummary {
  let total = 0;
  let ready = 0;
  let readyDenganCatatan = 0;
  let usulPenghapusan = 0;
  let breakdown = 0;

  for (const r of rows) {
    total++;
    const kondisi = normalizeKondisi(r.kondisi);
    if (kondisi === 'READY') ready++;
    else if (kondisi === 'READY DENGAN CATATAN') readyDenganCatatan++;
    else if (kondisi === 'USUL/PROSES PENGHAPUSAN') usulPenghapusan++;
    else if (kondisi === 'BREAKDOWN') breakdown++;
  }

  const rfuPct = total > 0 ? Number((((ready + readyDenganCatatan) / total) * 100).toFixed(1)) : 0;

  return {
    total,
    ready,
    readyDenganCatatan,
    usulPenghapusan,
    breakdown,
    rfuPct,
  };
}

export interface BreakdownJenisChartRow {
  jenis_alat: string;
  MTI: number;
  PMT: number;
  PTP: number;
  R4: number;
  total: number;
}

/**
 * Builds stacked horizontal bar data grouped by `jenis_alat` and stacked by `grup_entitas`
 * (MTI, PMT, PTP, R4) strictly for BREAKDOWN records, sorted descending by total breakdown count.
 */
export function buildBreakdownByJenisChart(rows: PeralatanRecord[]): BreakdownJenisChartRow[] {
  const byJenis = new Map<string, BreakdownJenisChartRow>();

  for (const r of rows) {
    if (normalizeKondisi(r.kondisi) !== 'BREAKDOWN') continue;
    const jenis = String(r.jenis_alat || 'Lainnya').trim() || 'Lainnya';
    const entitas = normalizeGrupEntitas(r.grup_entitas);

    let entry = byJenis.get(jenis);
    if (!entry) {
      entry = {
        jenis_alat: jenis,
        MTI: 0,
        PMT: 0,
        PTP: 0,
        R4: 0,
        total: 0,
      };
      byJenis.set(jenis, entry);
    }

    if (entitas === 'MTI') entry.MTI++;
    else if (entitas === 'PMT') entry.PMT++;
    else if (entitas === 'PTP') entry.PTP++;
    else if (entitas === 'R4') entry.R4++;
    entry.total++;
  }

  return Array.from(byJenis.values()).sort(
    (a, b) => b.total - a.total || a.jenis_alat.localeCompare(b.jenis_alat)
  );
}

export interface BreakdownBranchChartRow {
  nama_cabang: string;
  breakdown: number;
  ready: number;
  total: number;
  readinessPct: number;
}

/**
 * Builds top branches with highest BREAKDOWN units, sorted descending by breakdown count.
 */
export function buildBreakdownByBranchChart(
  rows: PeralatanRecord[],
  limit = 10
): BreakdownBranchChartRow[] {
  const byBranch = new Map<string, { breakdown: number; ready: number; total: number }>();

  for (const r of rows) {
    const branch = String(r.nama_cabang || 'Lainnya').trim() || 'Lainnya';
    let entry = byBranch.get(branch);
    if (!entry) {
      entry = { breakdown: 0, ready: 0, total: 0 };
      byBranch.set(branch, entry);
    }
    entry.total++;
    const kondisi = normalizeKondisi(r.kondisi);
    if (kondisi === 'BREAKDOWN') entry.breakdown++;
    else if (kondisi === 'READY' || kondisi === 'READY DENGAN CATATAN') entry.ready++;
  }

  return Array.from(byBranch.entries())
    .map(([nama_cabang, stat]) => ({
      nama_cabang,
      breakdown: stat.breakdown,
      ready: stat.ready,
      total: stat.total,
      readinessPct: stat.total > 0 ? Math.round((stat.ready / stat.total) * 100) : 0,
    }))
    .filter((r) => r.breakdown > 0)
    .sort((a, b) => b.breakdown - a.breakdown || a.nama_cabang.localeCompare(b.nama_cabang))
    .slice(0, limit);
}


