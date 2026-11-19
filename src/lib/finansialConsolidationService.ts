import { query } from '@/lib/db/sqliteQuery';
import { getCanonicalBranchCode } from '@/lib/constants';
import {
  ENTITAS_SEMUA,
  FINANSIAL_ENTITAS_LIST,
  canonicalRekening,
  formatPercentOrDash,
  getMonthNameId,
  parseMetricPercent,
  parseRealisasi,
} from '@/lib/finansialHelpers';
import { formatBerandaSummaryRupiah, formatIdPercent2 } from '@/lib/berandaSummary';
import { formatBebanTriliun, formatRupiahFull } from '@/lib/formatters';
import type { FinansialRecord, FinansialRekening } from '@/lib/types';
import type {
  FinansialConsolidatedKpis,
  FinansialEntityBreakdownPoint,
  FinansialModuleBranchOption,
  FinansialModuleSummaryResponse,
  FinansialPeriodTrendPoint,
  FinansialTopBranchPoint,
} from '@/lib/finansialSummaryTypes';

export interface FinansialKpiQueryOptions {
  verifiedOnly: boolean;
  year: number | null;
  month: number | null;
  nmCbgList: string[] | null;
  branchCodes: string[] | null;
  rbacBranchCodes: string[] | null;
  /** NULL = Konsolidasi seluruh entitas TERMASUK ELIMINASI */
  entitas: string | null;
}

export interface FinansialModuleSummaryInput {
  /** undefined -> default 2026; null -> 'ALL' */
  tahun?: number | null;
  /** undefined -> default 8 (Agustus); null -> 'ALL' */
  bulan?: number | null;
  entitas?: string | null;
  nmCbg?: string | null;
  branchCodes?: string[];
  rekening?: string | null;
  search?: string | null;
  verifiedOnly: boolean;
  isPicCabang: boolean;
  picBranchCode: string | null;
}

export const FINANSIAL_EFF_COLUMNS_SQL = `
  CASE
    WHEN $1::boolean AND verification_status <> 'verified' AND verified_snapshot_json IS NOT NULL
    THEN COALESCE(
      NULLIF(verified_snapshot_json->>'realisasi', '')::double precision,
      CASE UPPER(TRIM(entitas))
        WHEN 'CABANG' THEN NULLIF(verified_snapshot_json->>'cabang_rp', '')::double precision
        WHEN 'PJM' THEN NULLIF(verified_snapshot_json->>'pjm_rp', '')::double precision
        WHEN 'PMT' THEN NULLIF(verified_snapshot_json->>'pmt_rp', '')::double precision
        WHEN 'PSL' THEN NULLIF(verified_snapshot_json->>'psl_rp', '')::double precision
        WHEN 'PTP' THEN NULLIF(verified_snapshot_json->>'ptp_rp', '')::double precision
        WHEN 'ELIMINASI' THEN NULLIF(verified_snapshot_json->>'eliminasi_rp', '')::double precision
        ELSE NULL
      END,
      0::double precision
    )
    ELSE realisasi
  END AS eff_realisasi,
  CASE
    WHEN $1::boolean AND verification_status <> 'verified' AND verified_snapshot_json IS NOT NULL
    THEN NULLIF(NULLIF(verified_snapshot_json->>'rka', ''), '-')::double precision
    ELSE rka
  END AS eff_rka,
  CASE
    WHEN $1::boolean AND verification_status <> 'verified' AND verified_snapshot_json IS NOT NULL
    THEN NULLIF(NULLIF(verified_snapshot_json->>'yoy', ''), '-')::double precision
    ELSE yoy
  END AS eff_yoy
`;

/**
 * CTE Single Source of Truth untuk seluruh query agregasi & detail module_finansial.
 * Tidak pernah membuang baris realisasi >= 0 sehingga baris ELIMINASI (yang bernilai positif
 * untuk Beban dan negatif untuk Pendapatan) selalu ikut dihitung saat mode Konsolidasi.
 */
export const FINANSIAL_CONSOLIDATION_CTE_SQL = `
  WITH filtered_fin AS (
    SELECT
      id,
      monthly_record_id,
      year,
      month,
      branch_code,
      branch_name,
      rekening,
      entitas,
      verification_status,
      uploaded_by,
      uploaded_at,
      verified_snapshot_json,
      ${FINANSIAL_EFF_COLUMNS_SQL}
    FROM v_module_finansial_entitas
    WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
      AND ($2::int IS NULL OR year = $2::int)
      AND ($3::int IS NULL OR month = $3::int)
      AND ($4::text[] IS NULL OR branch_name = ANY($4::text[]))
      AND ($5::text[] IS NULL OR branch_code = ANY($5::text[]))
      AND ($6::text[] IS NULL OR branch_code = ANY($6::text[]))
      AND ($7::text IS NULL OR UPPER(TRIM(entitas)) = UPPER(TRIM($7::text)))
  )
`;

export async function ensureModuleFinansialPopulated(): Promise<void> {
  const res = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM v_module_finansial_entitas');
  if (Number(res.rows[0]?.count || 0) === 0) {
    console.warn('[finansialConsolidation] v_module_finansial_entitas kosong di database PostgreSQL ed_dashboard.');
  }
}

export function normalizeEntitasFilter(raw?: string | null): string | null {
  const clean = String(raw ?? '').trim().toUpperCase();
  if (!clean || clean === ENTITAS_SEMUA || clean === 'ALL') {
    return null;
  }
  return clean;
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

interface RawConsolidatedKpiRow {
  pendapatan_total: number;
  pendapatan_target_rka: number | null;
  pendapatan_rka_avg: number | null;
  pendapatan_cnt: number;
  beban_total: number;
  beban_target_rka: number | null;
  beban_rka_avg: number | null;
  beban_cnt: number;
  laba_usaha_total: number;
  laba_usaha_target_rka: number | null;
  laba_usaha_rka_avg: number | null;
  laba_usaha_cnt: number;
  laba_bersih_total: number;
  laba_bersih_target_rka: number | null;
  laba_bersih_rka_avg: number | null;
  laba_bersih_cnt: number;
}

interface RawPriorConsolidatedKpiRow {
  pendapatan_total_prior: number;
  pendapatan_cnt_prior: number;
  beban_total_prior: number;
  beban_cnt_prior: number;
  laba_usaha_total_prior: number;
  laba_usaha_cnt_prior: number;
  laba_bersih_total_prior: number;
  laba_bersih_cnt_prior: number;
}

/**
 * Menghitung capaian RKA secara dinamis berdasarkan total realisasi dibagi total target anggaran.
 * Jika target tidak tersedia (null / 0), fallback ke rata-rata RKA row-level.
 */
function computeDynamicRka(
  realisasi: number,
  targetRka: number | null,
  fallbackAvg: number | null
): number | null {
  if (targetRka !== null && Number.isFinite(targetRka) && targetRka !== 0) {
    if ((realisasi > 0 && targetRka < 0) || (realisasi < 0 && targetRka > 0)) {
      return fallbackAvg !== null && Number.isFinite(fallbackAvg)
        ? Math.round(fallbackAvg * 100) / 100
        : null;
    }
    const val = (realisasi / targetRka) * 100;
    return Number.isFinite(val) ? Math.round(val * 100) / 100 : null;
  }
  return fallbackAvg !== null && Number.isFinite(fallbackAvg)
    ? Math.round(fallbackAvg * 100) / 100
    : null;
}

/**
 * Menghitung capaian YoY secara dinamis: Realisasi Periode Berjalan / Realisasi Periode Tahun Lalu * 100.
 * Menggunakan filter cakupan cabang, entitas, dan status verifikasi yang identik.
 * Mengembalikan null jika data tahun lalu tidak tersedia atau tanda berbalik arah (contoh rugi ke laba).
 */
function computeDynamicYoy(
  currentReal: number,
  priorReal: number | null,
  priorCnt: number
): number | null {
  if (!priorCnt || priorReal === null || !Number.isFinite(priorReal) || priorReal === 0) {
    return null;
  }
  if ((currentReal > 0 && priorReal < 0) || (currentReal < 0 && priorReal > 0)) {
    return null;
  }
  const ratio = (currentReal / priorReal) * 100;
  return Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null;
}

/**
 * SINGLE SOURCE OF TRUTH PostgreSQL query untuk menghitung seluruh KPI finansial:
 * - Pendapatan (TRIM(LOWER(rekening)) = 'pendapatan')
 * - Beban (TRIM(LOWER(rekening)) = 'beban') -> mempertahankan tanda negatif, dan saat
 *   entitas = NULL (Konsolidasi) menjumlahkan seluruh entitas TERMASUK ELIMINASI.
 * - Laba Usaha & Laba Bersih
 * - BOPO = ABS(total_beban) / total_pendapatan * 100
 * - Capaian RKA dihitung secara dinamis dari Realisasi / Target RKA
 * - Pertumbuhan YoY dihitung secara dinamis dari Realisasi Berjalan / Realisasi Tahun Lalu
 */
export async function queryFinansialConsolidatedKpis(
  opts: FinansialKpiQueryOptions
): Promise<FinansialConsolidatedKpis> {
  const normalizedEntitas = normalizeEntitasFilter(opts.entitas);
  const cteParams = [
    opts.verifiedOnly,
    opts.year,
    opts.month,
    opts.nmCbgList,
    opts.branchCodes,
    opts.rbacBranchCodes,
    normalizedEntitas,
  ];

  const priorYear =
    typeof opts.year === 'number' && Number.isFinite(opts.year) && opts.year > 2000
      ? opts.year - 1
      : null;

  const priorCteParams =
    priorYear !== null
      ? [
          opts.verifiedOnly,
          priorYear,
          opts.month,
          opts.nmCbgList,
          opts.branchCodes,
          opts.rbacBranchCodes,
          normalizedEntitas,
        ]
      : null;

  const priorKpiPromise = priorCteParams
    ? query<RawPriorConsolidatedKpiRow>(
        `${FINANSIAL_CONSOLIDATION_CTE_SQL}
         SELECT
           COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan_total_prior,
           COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan')::int AS pendapatan_cnt_prior,

           COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban'), 0)::double precision AS beban_total_prior,
           COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban')::int AS beban_cnt_prior,

           COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha'), 0)::double precision AS laba_usaha_total_prior,
           COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha')::int AS laba_usaha_cnt_prior,

           COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih'), 0)::double precision AS laba_bersih_total_prior,
           COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih')::int AS laba_bersih_cnt_prior
         FROM filtered_fin`,
        priorCteParams
      )
    : Promise.resolve({ rows: [] as RawPriorConsolidatedKpiRow[] });

  const [kpiRes, priorRes, verificationRes] = await Promise.all([
    query<RawConsolidatedKpiRow>(
      `${FINANSIAL_CONSOLIDATION_CTE_SQL}
       SELECT
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan_total,
         SUM(CASE WHEN TRIM(LOWER(rekening)) = 'pendapatan' AND eff_rka IS NOT NULL AND eff_rka <> 0 THEN eff_realisasi / (eff_rka / 100.0) ELSE NULL END)::double precision AS pendapatan_target_rka,
         AVG(eff_rka) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan' AND eff_rka IS NOT NULL)::double precision AS pendapatan_rka_avg,
         COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan')::int AS pendapatan_cnt,

         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban'), 0)::double precision AS beban_total,
         SUM(CASE WHEN TRIM(LOWER(rekening)) = 'beban' AND eff_rka IS NOT NULL AND eff_rka <> 0 THEN eff_realisasi / (eff_rka / 100.0) ELSE NULL END)::double precision AS beban_target_rka,
         AVG(eff_rka) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban' AND eff_rka IS NOT NULL)::double precision AS beban_rka_avg,
         COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban')::int AS beban_cnt,

         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha'), 0)::double precision AS laba_usaha_total,
         SUM(CASE WHEN TRIM(LOWER(rekening)) = 'laba usaha' AND eff_rka IS NOT NULL AND eff_rka <> 0 THEN eff_realisasi / (eff_rka / 100.0) ELSE NULL END)::double precision AS laba_usaha_target_rka,
         AVG(eff_rka) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha' AND eff_rka IS NOT NULL)::double precision AS laba_usaha_rka_avg,
         COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha')::int AS laba_usaha_cnt,

         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih'), 0)::double precision AS laba_bersih_total,
         SUM(CASE WHEN TRIM(LOWER(rekening)) = 'laba bersih' AND eff_rka IS NOT NULL AND eff_rka <> 0 THEN eff_realisasi / (eff_rka / 100.0) ELSE NULL END)::double precision AS laba_bersih_target_rka,
         AVG(eff_rka) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih' AND eff_rka IS NOT NULL)::double precision AS laba_bersih_rka_avg,
         COUNT(*) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih')::int AS laba_bersih_cnt
       FROM filtered_fin`,
      cteParams
    ),
    priorKpiPromise,
    query<{ verified_count: number; pending_count: number; revision_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified_count,
         COUNT(*) FILTER (WHERE verification_status = 'pending_verification')::int AS pending_count,
         COUNT(*) FILTER (WHERE verification_status = 'revision_needed')::int AS revision_count
       FROM v_module_finansial_entitas
       WHERE ($1::int IS NULL OR year = $1::int)
         AND ($2::int IS NULL OR month = $2::int)
         AND ($3::text[] IS NULL OR branch_name = ANY($3::text[]))
         AND ($4::text[] IS NULL OR branch_code = ANY($4::text[]))
         AND ($5::text[] IS NULL OR branch_code = ANY($5::text[]))
         AND ($6::text IS NULL OR UPPER(TRIM(entitas)) = UPPER(TRIM($6::text)))`,
      [
        opts.year,
        opts.month,
        opts.nmCbgList,
        opts.branchCodes,
        opts.rbacBranchCodes,
        normalizedEntitas,
      ]
    ),
  ]);

  const row = kpiRes.rows[0];
  const priorRow = priorRes.rows[0];
  const vRow = verificationRes.rows[0];

  const pendapatanVal = Number(row?.pendapatan_total || 0);
  const bebanVal = Number(row?.beban_total || 0);
  const labaUsahaVal = Number(row?.laba_usaha_total || 0);
  const labaBersihVal = Number(row?.laba_bersih_total || 0);
  const bopoVal =
    pendapatanVal !== 0 ? (Math.abs(bebanVal) / Math.abs(pendapatanVal)) * 100 : 0;

  const pendapatanDynamicRka = computeDynamicRka(
    pendapatanVal,
    toNullableNumber(row?.pendapatan_target_rka),
    toNullableNumber(row?.pendapatan_rka_avg)
  );
  const pendapatanDynamicYoy = computeDynamicYoy(
    pendapatanVal,
    toNullableNumber(priorRow?.pendapatan_total_prior),
    Number(priorRow?.pendapatan_cnt_prior || 0)
  );

  const bebanDynamicRka = computeDynamicRka(
    bebanVal,
    toNullableNumber(row?.beban_target_rka),
    toNullableNumber(row?.beban_rka_avg)
  );
  const bebanDynamicYoy = computeDynamicYoy(
    bebanVal,
    toNullableNumber(priorRow?.beban_total_prior),
    Number(priorRow?.beban_cnt_prior || 0)
  );

  const labaUsahaDynamicRka = computeDynamicRka(
    labaUsahaVal,
    toNullableNumber(row?.laba_usaha_target_rka),
    toNullableNumber(row?.laba_usaha_rka_avg)
  );
  const labaUsahaDynamicYoy = computeDynamicYoy(
    labaUsahaVal,
    toNullableNumber(priorRow?.laba_usaha_total_prior),
    Number(priorRow?.laba_usaha_cnt_prior || 0)
  );

  const labaBersihDynamicRka = computeDynamicRka(
    labaBersihVal,
    toNullableNumber(row?.laba_bersih_target_rka),
    toNullableNumber(row?.laba_bersih_rka_avg)
  );
  const labaBersihDynamicYoy = computeDynamicYoy(
    labaBersihVal,
    toNullableNumber(priorRow?.laba_bersih_total_prior),
    Number(priorRow?.laba_bersih_cnt_prior || 0)
  );

  return {
    pendapatan: {
      realisasi: pendapatanVal,
      formatted: formatBerandaSummaryRupiah(pendapatanVal),
      formattedFull: formatRupiahFull(pendapatanVal),
      rka: pendapatanDynamicRka,
      yoy: pendapatanDynamicYoy,
      rowCount: Number(row?.pendapatan_cnt || 0),
    },
    beban: {
      realisasi: bebanVal,
      formatted: formatBebanTriliun(bebanVal),
      formattedFull: formatRupiahFull(bebanVal),
      rka: bebanDynamicRka,
      yoy: bebanDynamicYoy,
      rowCount: Number(row?.beban_cnt || 0),
    },
    labaUsaha: {
      realisasi: labaUsahaVal,
      formatted: formatBerandaSummaryRupiah(labaUsahaVal),
      formattedFull: formatRupiahFull(labaUsahaVal),
      rka: labaUsahaDynamicRka,
      yoy: labaUsahaDynamicYoy,
      rowCount: Number(row?.laba_usaha_cnt || 0),
    },
    labaBersih: {
      realisasi: labaBersihVal,
      formatted: formatBerandaSummaryRupiah(labaBersihVal),
      formattedFull: formatRupiahFull(labaBersihVal),
      rka: labaBersihDynamicRka,
      yoy: labaBersihDynamicYoy,
      rowCount: Number(row?.laba_bersih_cnt || 0),
    },
    bopo: {
      value: bopoVal,
      formatted: formatIdPercent2(bopoVal),
    },
    isConsolidation: normalizedEntitas === null,
    verificationSummary: {
      verified: Number(vRow?.verified_count || 0),
      pending: Number(vRow?.pending_count || 0),
      revision: Number(vRow?.revision_count || 0),
    },
  };
}

/**
 * Mengambil seluruh data untuk menu Finansial menggunakan Single Source of Truth PostgreSQL
 * yang sama dengan menu Beranda. Default periode diselaraskan ke Tahun 2026 Bulan 8.
 */
export async function getFinansialModuleSummary(
  input: FinansialModuleSummaryInput
): Promise<FinansialModuleSummaryResponse> {
  await ensureModuleFinansialPopulated();

  const rbacBranchCodes =
    input.isPicCabang && input.picBranchCode
      ? [getCanonicalBranchCode(input.picBranchCode)]
      : null;

  const headerBranchCodes =
    !rbacBranchCodes && input.branchCodes && input.branchCodes.length > 0
      ? input.branchCodes.map((c) => getCanonicalBranchCode(c)).filter(Boolean)
      : null;

  // 1. Metadata dropdown filters
  const [metaCountsRes, yearsRes, entitasRes, branchesRes] = await Promise.all([
    query<{ total_rows: number }>(
      `SELECT COUNT(*)::int AS total_rows
       FROM v_module_finansial_entitas
       WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
         AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))`,
      [input.verifiedOnly, rbacBranchCodes]
    ),
    query<{ year: number }>(
      `SELECT DISTINCT year::int AS year
       FROM v_module_finansial_entitas
       WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
         AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))
       ORDER BY year DESC`,
      [input.verifiedOnly, rbacBranchCodes]
    ),
    query<{ entitas: string }>(
      `SELECT DISTINCT UPPER(TRIM(entitas)) AS entitas
       FROM v_module_finansial_entitas
       WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
         AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))`,
      [input.verifiedOnly, rbacBranchCodes]
    ),
    query<{ kode: string; nama: string }>(
      `SELECT branch_code AS kode, MIN(branch_name) AS nama
       FROM v_module_finansial_entitas
       WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
         AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))
       GROUP BY branch_code
       ORDER BY branch_code ASC`,
      [input.verifiedOnly, rbacBranchCodes]
    ),
  ]);

  const availableYears = yearsRes.rows.map((r) => Number(r.year)).filter(Number.isFinite);

  let activeYear: number | null;
  if (input.tahun === null) {
    activeYear = null; // explicitly ALL
  } else if (typeof input.tahun === 'number' && availableYears.includes(input.tahun)) {
    activeYear = input.tahun;
  } else {
    activeYear = availableYears.includes(2026) ? 2026 : (availableYears[0] ?? 2026);
  }

  const monthsRes = await query<{ month: number }>(
    `SELECT DISTINCT month::int AS month
     FROM v_module_finansial_entitas
     WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($2::int IS NULL OR year = $2::int)
       AND ($3::text[] IS NULL OR branch_code = ANY($3::text[]))
     ORDER BY month ASC`,
    [input.verifiedOnly, activeYear, rbacBranchCodes]
  );
  const availableMonths = monthsRes.rows.map((r) => Number(r.month)).filter(Number.isFinite);

  let activeMonth: number | null;
  if (input.bulan === null) {
    activeMonth = null; // explicitly ALL
  } else if (typeof input.bulan === 'number' && availableMonths.includes(input.bulan)) {
    activeMonth = input.bulan;
  } else {
    // Selaraskan default awal menu Finansial dengan Beranda: bulan 8 (Agustus)
    activeMonth = availableMonths.includes(8) ? 8 : (availableMonths[0] ?? 8);
  }

  const orderedEntitas = [...FINANSIAL_ENTITAS_LIST] as string[];
  const extraEntitas = entitasRes.rows
    .map((r) => String(r.entitas || '').trim().toUpperCase())
    .filter((e) => e && !orderedEntitas.includes(e));
  const availableEntitas = [...orderedEntitas, ...extraEntitas];

  const availableBranches: FinansialModuleBranchOption[] = branchesRes.rows.map((r) => ({
    kode: String(r.kode || ''),
    nama: String(r.nama || ''),
  }));

  const normalizedEntitas = normalizeEntitasFilter(input.entitas);
  const activeEntitasLabel = normalizedEntitas ?? ENTITAS_SEMUA;

  const cleanNmCbg =
    !rbacBranchCodes && input.nmCbg && input.nmCbg !== 'ALL' && input.nmCbg !== 'SEMUA'
      ? input.nmCbg.trim()
      : null;
  const activeNmCbgList = cleanNmCbg ? [cleanNmCbg] : null;
  const activeNmCbgLabel = rbacBranchCodes
    ? (availableBranches[0]?.nama ?? 'ALL')
    : (cleanNmCbg ?? 'ALL');

  const activeRekeningRaw = String(input.rekening ?? 'ALL').trim();
  const activeRekening: FinansialRekening | 'ALL' =
    !activeRekeningRaw || activeRekeningRaw.toUpperCase() === 'ALL'
      ? 'ALL'
      : canonicalRekening(activeRekeningRaw);

  const searchPattern = input.search?.trim() ? `%${input.search.trim()}%` : null;

  // 2. Hitung KPI lewat fungsi Single Source of Truth yang sama dengan Beranda
  const kpisPromise = queryFinansialConsolidatedKpis({
    verifiedOnly: input.verifiedOnly,
    year: activeYear,
    month: activeMonth,
    nmCbgList: activeNmCbgList,
    branchCodes: headerBranchCodes,
    rbacBranchCodes,
    entitas: normalizedEntitas,
  });

  // Params untuk trend antar periode (year=null, month=null)
  const trendParams = [
    input.verifiedOnly,
    null,
    null,
    activeNmCbgList,
    headerBranchCodes,
    rbacBranchCodes,
    normalizedEntitas,
  ];

  // Params untuk entity breakdown (entitas=null agar semua 6 entitas + KONSOLIDASI tampil)
  const entityParams = [
    input.verifiedOnly,
    activeYear,
    activeMonth,
    activeNmCbgList,
    headerBranchCodes,
    rbacBranchCodes,
    null,
  ];

  // Params untuk top branches & rows
  const activeScopeParams = [
    input.verifiedOnly,
    activeYear,
    activeMonth,
    activeNmCbgList,
    headerBranchCodes,
    rbacBranchCodes,
    normalizedEntitas,
  ];

  const [kpis, trendRes, entityRes, topBranchesRes, detailRowsRes] = await Promise.all([
    kpisPromise,
    query<{
      year: number;
      month: number;
      pendapatan: number;
      beban: number;
      laba_usaha: number;
      laba_bersih: number;
    }>(
      `${FINANSIAL_CONSOLIDATION_CTE_SQL}
       SELECT
         year::int AS year,
         month::int AS month,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban'), 0)::double precision AS beban,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha'), 0)::double precision AS laba_usaha,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba bersih'), 0)::double precision AS laba_bersih
       FROM filtered_fin
       GROUP BY year, month
       ORDER BY year ASC, month ASC`,
      trendParams
    ),
    query<{
      entitas: string;
      pendapatan: number;
      beban: number;
      laba_usaha: number;
    }>(
      `${FINANSIAL_CONSOLIDATION_CTE_SQL}
       SELECT
         UPPER(TRIM(entitas)) AS entitas,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'beban'), 0)::double precision AS beban,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha'), 0)::double precision AS laba_usaha
       FROM filtered_fin
       GROUP BY UPPER(TRIM(entitas))`,
      entityParams
    ),
    query<{
      kode: string;
      nama: string;
      pendapatan: number;
      laba_usaha: number;
      rka: number | null;
      yoy: number | null;
    }>(
      `${FINANSIAL_CONSOLIDATION_CTE_SQL}
       SELECT
         branch_code AS kode,
         MIN(branch_name) AS nama,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'laba usaha'), 0)::double precision AS laba_usaha,
         COALESCE(
           (
             SUM(eff_realisasi) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan') /
             NULLIF(SUM(CASE WHEN TRIM(LOWER(rekening)) = 'pendapatan' AND eff_rka IS NOT NULL AND eff_rka <> 0 THEN eff_realisasi / (eff_rka / 100.0) END), 0)
           ) * 100,
           AVG(eff_rka) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan' AND eff_rka IS NOT NULL)
         )::double precision AS rka,
         AVG(eff_yoy) FILTER (WHERE TRIM(LOWER(rekening)) = 'pendapatan' AND eff_yoy IS NOT NULL)::double precision AS yoy
       FROM filtered_fin
       GROUP BY branch_code
       ORDER BY pendapatan DESC, branch_code ASC
       LIMIT 8`,
      activeScopeParams
    ),
    query<{
      id: string;
      monthly_record_id: string | null;
      year: number;
      month: number;
      branch_code: string;
      branch_name: string;
      rekening: string;
      entitas: string;
      eff_realisasi: number;
      eff_rka: number | null;
      eff_yoy: number | null;
      verification_status: string;
      verified_snapshot_json: unknown;
      uploaded_by: string | null;
      uploaded_at: string | null;
    }>(
      `${FINANSIAL_CONSOLIDATION_CTE_SQL}
       SELECT
         id,
         monthly_record_id,
         year::int AS year,
         month::int AS month,
         branch_code,
         branch_name,
         rekening,
         entitas,
         eff_realisasi,
         eff_rka,
         eff_yoy,
         verification_status,
         verified_snapshot_json,
         uploaded_by,
         uploaded_at
       FROM filtered_fin
       WHERE ($8::text IS NULL OR TRIM(LOWER(rekening)) = TRIM(LOWER($8::text)))
         AND (
           $9::text IS NULL
           OR branch_code ILIKE $9::text
           OR branch_name ILIKE $9::text
           OR rekening ILIKE $9::text
           OR entitas ILIKE $9::text
           OR year::text ILIKE $9::text
           OR month::text ILIKE $9::text
         )
       ORDER BY year DESC, month DESC, branch_code ASC, rekening ASC, entitas ASC`,
      [
        ...activeScopeParams,
        activeRekening === 'ALL' ? null : activeRekening,
        searchPattern,
      ]
    ),
  ]);

  const periodTrend: FinansialPeriodTrendPoint[] = trendRes.rows.map((r) => {
    const pend = Number(r.pendapatan || 0);
    const beb = Number(r.beban || 0);
    const lu = Number(r.laba_usaha || 0);
    const lb = Number(r.laba_bersih || 0);
    return {
      periode: `${getMonthNameId(Number(r.month)).slice(0, 3)} ${r.year}`,
      PendapatanM: Number((pend / 1e9).toFixed(2)),
      BebanM: Number((beb / 1e9).toFixed(2)),
      LabaUsahaM: Number((lu / 1e9).toFixed(2)),
      LabaBersihM: Number((lb / 1e9).toFixed(2)),
      pendapatanRp: pend,
      bebanRp: beb,
      labaUsahaRp: lu,
      labaBersihRp: lb,
    };
  });

  const entityMap = new Map<string, { pendapatan: number; beban: number; labaUsaha: number }>();
  for (const r of entityRes.rows) {
    const key = String(r.entitas || '').toUpperCase();
    entityMap.set(key, {
      pendapatan: Number(r.pendapatan || 0),
      beban: Number(r.beban || 0),
      labaUsaha: Number(r.laba_usaha || 0),
    });
  }

  let consPendapatan = 0;
  let consBeban = 0;
  let consLabaUsaha = 0;
  const entityBreakdown: FinansialEntityBreakdownPoint[] = availableEntitas.map((ent) => {
    const entry = entityMap.get(ent) ?? { pendapatan: 0, beban: 0, labaUsaha: 0 };
    consPendapatan += entry.pendapatan;
    consBeban += entry.beban;
    consLabaUsaha += entry.labaUsaha;
    return {
      entitas: ent,
      PendapatanM: Number((entry.pendapatan / 1e9).toFixed(2)),
      BebanM: Number((entry.beban / 1e9).toFixed(2)),
      LabaUsahaM: Number((entry.labaUsaha / 1e9).toFixed(2)),
      pendapatanRp: entry.pendapatan,
      bebanRp: entry.beban,
      labaUsahaRp: entry.labaUsaha,
    };
  });

  entityBreakdown.push({
    entitas: 'KONSOLIDASI',
    PendapatanM: Number((consPendapatan / 1e9).toFixed(2)),
    BebanM: Number((consBeban / 1e9).toFixed(2)),
    LabaUsahaM: Number((consLabaUsaha / 1e9).toFixed(2)),
    pendapatanRp: consPendapatan,
    bebanRp: consBeban,
    labaUsahaRp: consLabaUsaha,
  });

  const topBranches: FinansialTopBranchPoint[] = topBranchesRes.rows.map((r) => {
    const nama = String(r.nama || r.kode || '');
    const pend = Number(r.pendapatan || 0);
    const lu = Number(r.laba_usaha || 0);
    return {
      kode: String(r.kode || ''),
      name: nama.length > 13 ? `${nama.slice(0, 11)}..` : nama,
      fullName: `[${r.kode}] ${nama}`,
      PendapatanM: Number((pend / 1e9).toFixed(2)),
      LabaUsahaM: Number((lu / 1e9).toFixed(2)),
      pendapatanRp: pend,
      labaUsahaRp: lu,
      rkaLabel: formatPercentOrDash(toNullableNumber(r.rka)),
      yoyLabel: formatPercentOrDash(toNullableNumber(r.yoy)),
    };
  });

  const rows: FinansialRecord[] = detailRowsRes.rows.map((r) => {
    const rkaParsed = parseMetricPercent(r.eff_rka);
    const yoyParsed = parseMetricPercent(r.eff_yoy);
    const vStatus = String(r.verification_status || 'verified');
    return {
      id: r.id,
      monthlyRecordId: r.monthly_record_id || undefined,
      TAHUN: Number(r.year),
      BULAN: Number(r.month),
      KODE_CBG: String(r.branch_code || '').trim(),
      NM_CBG: String(r.branch_name || '').trim(),
      REKENING: canonicalRekening(r.rekening),
      ENTITAS: String(r.entitas || '').trim().toUpperCase(),
      REALISASI: parseRealisasi(r.eff_realisasi),
      RKA: rkaParsed === null ? '-' : rkaParsed,
      YOY: yoyParsed === null ? '-' : yoyParsed,
      verificationStatus: vStatus as FinansialRecord['verificationStatus'],
      hasPendingUpdate: !input.verifiedOnly && vStatus === 'pending_verification',
      uploadedBy: r.uploaded_by || undefined,
      uploadedAt: r.uploaded_at || undefined,
    };
  });

  return {
    success: true,
    filters: {
      tahun: activeYear ?? 'ALL',
      bulan: activeMonth ?? 'ALL',
      entitas: activeEntitasLabel,
      nmCbg: activeNmCbgLabel,
      rekening: activeRekening,
      availableYears,
      availableMonths,
      availableEntitas,
      availableBranches,
      verifiedOnly: input.verifiedOnly,
      isPicCabang: input.isPicCabang,
      assignedBranchName: input.isPicCabang ? (availableBranches[0]?.nama ?? null) : null,
      totalDatasetRows: Number(metaCountsRes.rows[0]?.total_rows || 0),
    },
    kpis,
    charts: {
      periodTrend,
      entityBreakdown,
      topBranches,
    },
    rows,
  };
}

