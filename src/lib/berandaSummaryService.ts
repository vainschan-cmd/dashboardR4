import { query } from '@/lib/db';
import { ingestInputData } from '@/lib/ingestInputData';
import { getCanonicalBranchCode } from '@/lib/constants';
import {
  BERANDA_ENTITAS_ORDER,
  formatBerandaSummaryRupiah,
  formatIdPercent2,
  type BerandaBopoBranchRow,
  type BerandaBranchOption,
  type BerandaEntityShareRow,
  type BerandaPjmBottomRow,
  type BerandaStackedBranchRow,
  type BerandaSummaryResponse,
} from '@/lib/berandaSummary';

export interface BerandaSummaryQueryInput {
  tahun?: number | null;
  bulan?: number | null;
  nmCbgList?: string[];
  branchCodes?: string[];
  verifiedOnly: boolean;
  isPicCabang: boolean;
  picBranchCode: string | null;
}

const BASE_CTE_SQL = `
  WITH base_rows AS (
    SELECT
      branch_code,
      branch_name,
      rekening,
      entitas,
      verification_status,
      CASE
        WHEN $1::boolean AND verification_status <> 'verified' AND verified_snapshot_json IS NOT NULL
        THEN COALESCE(NULLIF(verified_snapshot_json->>'realisasi', '')::double precision, realisasi)
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
    FROM module_finansial
    WHERE year = $2::int
      AND month = $3::int
      AND ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
      AND ($4::text[] IS NULL OR branch_name = ANY($4::text[]))
      AND ($5::text[] IS NULL OR branch_code = ANY($5::text[]))
  )
`;

async function ensureModuleFinansialPopulated() {
  const res = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM module_finansial');
  if (Number(res.rows[0]?.count || 0) === 0) {
    await ingestInputData();
  }
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function mapStackedRows(
  rows: Array<{
    nm_cbg: string;
    branch_code: string;
    cabang_val: number;
    pjm_val: number;
    pmt_val: number;
    psl_val: number;
    ptp_val: number;
    total_val: number;
  }>
): BerandaStackedBranchRow[] {
  return rows.map((row) => ({
    nmCbg: String(row.nm_cbg || ''),
    branchCode: String(row.branch_code || ''),
    CABANG: Number(row.cabang_val || 0) / 1e9,
    PJM: Number(row.pjm_val || 0) / 1e9,
    PMT: Number(row.pmt_val || 0) / 1e9,
    PSL: Number(row.psl_val || 0) / 1e9,
    PTP: Number(row.ptp_val || 0) / 1e9,
    total: Number(row.total_val || 0) / 1e9,
  }));
}

export async function getBerandaSummaryData(
  input: BerandaSummaryQueryInput
): Promise<BerandaSummaryResponse> {
  await ensureModuleFinansialPopulated();

  const rbacBranchCodes =
    input.isPicCabang && input.picBranchCode
      ? [getCanonicalBranchCode(input.picBranchCode)]
      : null;

  // 1. Available years
  const yearsRes = await query<{ year: number }>(
    `SELECT DISTINCT year::int AS year
     FROM module_finansial
     WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))
     ORDER BY year ASC`,
    [input.verifiedOnly, rbacBranchCodes]
  );
  const availableYears = yearsRes.rows.map((r) => Number(r.year)).filter(Number.isFinite);

  let activeYear = input.tahun && availableYears.includes(input.tahun) ? input.tahun : null;
  if (activeYear === null) {
    if (availableYears.includes(2026)) activeYear = 2026;
    else activeYear = availableYears[availableYears.length - 1] ?? 2026;
  }

  // 2. Available months for active year
  const monthsRes = await query<{ month: number }>(
    `SELECT DISTINCT month::int AS month
     FROM module_finansial
     WHERE year = $2::int
       AND ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($3::text[] IS NULL OR branch_code = ANY($3::text[]))
     ORDER BY month ASC`,
    [input.verifiedOnly, activeYear, rbacBranchCodes]
  );
  const availableMonths = monthsRes.rows.map((r) => Number(r.month)).filter(Number.isFinite);

  let activeMonth = input.bulan && availableMonths.includes(input.bulan) ? input.bulan : null;
  if (activeMonth === null) {
    if (availableMonths.includes(8)) activeMonth = 8;
    else activeMonth = availableMonths[availableMonths.length - 1] ?? 8;
  }

  // 3. Available branches (NM_CBG sorted A-Z) for active year & month
  const branchesRes = await query<{ nm_cbg: string; branch_code: string }>(
    `SELECT
       branch_name AS nm_cbg,
       MIN(branch_code) AS branch_code
     FROM module_finansial
     WHERE year = $2::int
       AND month = $3::int
       AND ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($4::text[] IS NULL OR branch_code = ANY($4::text[]))
     GROUP BY branch_name
     ORDER BY LOWER(branch_name) ASC, branch_name ASC`,
    [input.verifiedOnly, activeYear, activeMonth, rbacBranchCodes]
  );
  const availableBranches: BerandaBranchOption[] = branchesRes.rows.map((r) => ({
    nmCbg: String(r.nm_cbg || ''),
    branchCode: String(r.branch_code || ''),
  }));

  // Resolve active NM_CBG selection
  let selectedBranches: string[] = [];
  if (rbacBranchCodes) {
    selectedBranches = availableBranches.map((b) => b.nmCbg);
  } else if (input.nmCbgList && input.nmCbgList.length > 0) {
    const validSet = new Set(availableBranches.map((b) => b.nmCbg));
    selectedBranches = input.nmCbgList.filter((name) => validSet.has(name));
  } else if (input.branchCodes && input.branchCodes.length > 0) {
    const canonicalSet = new Set(input.branchCodes.map((c) => getCanonicalBranchCode(c)));
    selectedBranches = availableBranches
      .filter((b) => canonicalSet.has(getCanonicalBranchCode(b.branchCode)))
      .map((b) => b.nmCbg);
  }

  // When every available branch is explicitly passed, treat SQL filter as NULL (all)
  const filterNmCbg: string[] | null =
    !rbacBranchCodes &&
    selectedBranches.length > 0 &&
    selectedBranches.length < availableBranches.length
      ? selectedBranches
      : null;

  const baseParams = [
    input.verifiedOnly,
    activeYear,
    activeMonth,
    filterNmCbg,
    rbacBranchCodes,
  ];

  // 4. Execute verification counts, KPI summary, and 5 charts in parallel
  const [
    verificationRes,
    kpiRes,
    top10LabaRes,
    top10PendapatanRes,
    bopoRes,
    entityShareRes,
    bottom10PjmRes,
  ] = await Promise.all([
    query<{ verified_count: number; pending_count: number; revision_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified_count,
         COUNT(*) FILTER (WHERE verification_status = 'pending_verification')::int AS pending_count,
         COUNT(*) FILTER (WHERE verification_status = 'revision_needed')::int AS revision_count
       FROM module_finansial
       WHERE year = $1::int
         AND month = $2::int
         AND ($3::text[] IS NULL OR branch_name = ANY($3::text[]))
         AND ($4::text[] IS NULL OR branch_code = ANY($4::text[]))`,
      [activeYear, activeMonth, filterNmCbg, rbacBranchCodes]
    ),
    query<{
      laba_total: number;
      laba_yoy: number | null;
      laba_rka: number | null;
      pendapatan_total: number;
      pendapatan_yoy: number | null;
      pendapatan_rka: number | null;
      beban_total: number;
      beban_yoy: number | null;
      beban_rka: number | null;
    }>(
      `${BASE_CTE_SQL}
       SELECT
         COALESCE(SUM(eff_realisasi) FILTER (WHERE LOWER(TRIM(rekening)) = 'laba bersih'), 0)::double precision AS laba_total,
         AVG(eff_yoy) FILTER (WHERE LOWER(TRIM(rekening)) = 'laba bersih' AND eff_yoy IS NOT NULL)::double precision AS laba_yoy,
         AVG(eff_rka) FILTER (WHERE LOWER(TRIM(rekening)) = 'laba bersih' AND eff_rka IS NOT NULL)::double precision AS laba_rka,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE LOWER(TRIM(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan_total,
         AVG(eff_yoy) FILTER (WHERE LOWER(TRIM(rekening)) = 'pendapatan' AND eff_yoy IS NOT NULL)::double precision AS pendapatan_yoy,
         AVG(eff_rka) FILTER (WHERE LOWER(TRIM(rekening)) = 'pendapatan' AND eff_rka IS NOT NULL)::double precision AS pendapatan_rka,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE LOWER(TRIM(rekening)) = 'beban'), 0)::double precision AS beban_total,
         AVG(eff_yoy) FILTER (WHERE LOWER(TRIM(rekening)) = 'beban' AND eff_yoy IS NOT NULL)::double precision AS beban_yoy,
         AVG(eff_rka) FILTER (WHERE LOWER(TRIM(rekening)) = 'beban' AND eff_rka IS NOT NULL)::double precision AS beban_rka
       FROM base_rows`,
      baseParams
    ),
    query<{
      nm_cbg: string;
      branch_code: string;
      cabang_val: number;
      pjm_val: number;
      pmt_val: number;
      psl_val: number;
      ptp_val: number;
      total_val: number;
    }>(
      `${BASE_CTE_SQL}
       SELECT
         branch_name AS nm_cbg,
         MIN(branch_code) AS branch_code,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'CABANG' THEN eff_realisasi ELSE 0 END), 0)::double precision AS cabang_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PJM' THEN eff_realisasi ELSE 0 END), 0)::double precision AS pjm_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PMT' THEN eff_realisasi ELSE 0 END), 0)::double precision AS pmt_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PSL' THEN eff_realisasi ELSE 0 END), 0)::double precision AS psl_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PTP' THEN eff_realisasi ELSE 0 END), 0)::double precision AS ptp_val,
         COALESCE(SUM(eff_realisasi), 0)::double precision AS total_val
       FROM base_rows
       WHERE LOWER(TRIM(rekening)) = 'laba bersih'
         AND UPPER(TRIM(entitas)) <> 'ELIMINASI'
       GROUP BY branch_name
       ORDER BY total_val DESC, branch_name ASC
       LIMIT 10`,
      baseParams
    ),
    query<{
      nm_cbg: string;
      branch_code: string;
      cabang_val: number;
      pjm_val: number;
      pmt_val: number;
      psl_val: number;
      ptp_val: number;
      total_val: number;
    }>(
      `${BASE_CTE_SQL}
       SELECT
         branch_name AS nm_cbg,
         MIN(branch_code) AS branch_code,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'CABANG' THEN eff_realisasi ELSE 0 END), 0)::double precision AS cabang_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PJM' THEN eff_realisasi ELSE 0 END), 0)::double precision AS pjm_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PMT' THEN eff_realisasi ELSE 0 END), 0)::double precision AS pmt_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PSL' THEN eff_realisasi ELSE 0 END), 0)::double precision AS psl_val,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(entitas)) = 'PTP' THEN eff_realisasi ELSE 0 END), 0)::double precision AS ptp_val,
         COALESCE(SUM(eff_realisasi), 0)::double precision AS total_val
       FROM base_rows
       WHERE LOWER(TRIM(rekening)) = 'pendapatan'
         AND UPPER(TRIM(entitas)) <> 'ELIMINASI'
       GROUP BY branch_name
       ORDER BY total_val DESC, branch_name ASC
       LIMIT 10`,
      baseParams
    ),
    query<{
      nm_cbg: string;
      branch_code: string;
      pendapatan: number;
      beban: number;
    }>(
      `${BASE_CTE_SQL}
       SELECT
         branch_name AS nm_cbg,
         MIN(branch_code) AS branch_code,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE LOWER(TRIM(rekening)) = 'pendapatan'), 0)::double precision AS pendapatan,
         COALESCE(SUM(eff_realisasi) FILTER (WHERE LOWER(TRIM(rekening)) = 'beban'), 0)::double precision AS beban
       FROM base_rows
       GROUP BY branch_name
       ORDER BY LOWER(branch_name) ASC, branch_name ASC`,
      baseParams
    ),
    query<{ entitas: string; total_val: number }>(
      `${BASE_CTE_SQL}
       SELECT
         UPPER(TRIM(entitas)) AS entitas,
         COALESCE(SUM(eff_realisasi), 0)::double precision AS total_val
       FROM base_rows
       WHERE LOWER(TRIM(rekening)) = 'laba bersih'
         AND UPPER(TRIM(entitas)) <> 'ELIMINASI'
       GROUP BY UPPER(TRIM(entitas))`,
      baseParams
    ),
    query<{ nm_cbg: string; branch_code: string; total_val: number }>(
      `${BASE_CTE_SQL}
       SELECT
         branch_name AS nm_cbg,
         MIN(branch_code) AS branch_code,
         COALESCE(SUM(eff_realisasi), 0)::double precision AS total_val
       FROM base_rows
       WHERE LOWER(TRIM(rekening)) = 'laba bersih'
         AND UPPER(TRIM(entitas)) = 'PJM'
       GROUP BY branch_name
       ORDER BY total_val ASC, branch_name ASC
       LIMIT 10`,
      baseParams
    ),
  ]);

  const vRow = verificationRes.rows[0];
  const kRow = kpiRes.rows[0];

  const labaVal = Number(kRow?.laba_total || 0);
  const pendapatanVal = Number(kRow?.pendapatan_total || 0);
  const bebanVal = Number(kRow?.beban_total || 0);
  const bopoVal =
    pendapatanVal !== 0 ? (Math.abs(bebanVal) / Math.abs(pendapatanVal)) * 100 : 0;

  // Map BOPO per cabang (ordered A-Z)
  const bopoPerCabang: BerandaBopoBranchRow[] = bopoRes.rows.map((row) => {
    const pend = Number(row.pendapatan || 0);
    const beb = Number(row.beban || 0);
    return {
      nmCbg: String(row.nm_cbg || ''),
      branchCode: String(row.branch_code || ''),
      pendapatan: pend,
      beban: beb,
      bopo: pend !== 0 ? (Math.abs(beb) / Math.abs(pend)) * 100 : 0,
    };
  });

  // Map % Kontribusi Laba Area Per Entitas
  const entityMap = new Map<string, number>();
  for (const row of entityShareRes.rows) {
    entityMap.set(String(row.entitas || '').toUpperCase(), Number(row.total_val || 0));
  }
  const totalEntityNet = BERANDA_ENTITAS_ORDER.reduce(
    (sum, key) => sum + (entityMap.get(key) ?? 0),
    0
  );
  const kontribusiLabaEntitas: BerandaEntityShareRow[] = BERANDA_ENTITAS_ORDER.map((entitas) => {
    const totalRealisasi = entityMap.get(entitas) ?? 0;
    const sliceValue = Math.max(0, totalRealisasi);
    const exactPct = totalEntityNet !== 0 ? (totalRealisasi / totalEntityNet) * 100 : 0;
    return {
      entitas,
      totalRealisasi,
      sliceValue,
      exactPct,
      roundedPct: Math.round(exactPct),
    };
  });

  // Map Bottom 10 PJM reversed so smallest negative sits at top, largest negative at bottom
  const bottom10LabaPjm: BerandaPjmBottomRow[] = [...bottom10PjmRes.rows]
    .reverse()
    .map((row) => {
      const realisasi = Number(row.total_val || 0);
      return {
        nmCbg: String(row.nm_cbg || ''),
        branchCode: String(row.branch_code || ''),
        realisasi,
        nilaiJt: realisasi / 1e6,
      };
    });

  return {
    success: true,
    filters: {
      tahun: activeYear,
      bulan: activeMonth,
      selectedBranches,
      availableYears,
      availableMonths,
      availableBranches,
      verifiedOnly: input.verifiedOnly,
      isPicCabang: input.isPicCabang,
      assignedBranchName: input.isPicCabang ? (availableBranches[0]?.nmCbg ?? null) : null,
    },
    verificationSummary: {
      verified: Number(vRow?.verified_count || 0),
      pending: Number(vRow?.pending_count || 0),
      revision: Number(vRow?.revision_count || 0),
    },
    kpis: {
      labaArea: {
        value: labaVal,
        formatted: formatBerandaSummaryRupiah(labaVal),
        yoy: toNullableNumber(kRow?.laba_yoy),
        rka: toNullableNumber(kRow?.laba_rka),
      },
      pendapatan: {
        value: pendapatanVal,
        formatted: formatBerandaSummaryRupiah(pendapatanVal),
        yoy: toNullableNumber(kRow?.pendapatan_yoy),
        rka: toNullableNumber(kRow?.pendapatan_rka),
      },
      beban: {
        value: bebanVal,
        formatted: formatBerandaSummaryRupiah(bebanVal),
        yoy: toNullableNumber(kRow?.beban_yoy),
        rka: toNullableNumber(kRow?.beban_rka),
      },
      bopo: {
        value: bopoVal,
        formatted: formatIdPercent2(bopoVal),
      },
    },
    charts: {
      top10LabaArea: mapStackedRows(top10LabaRes.rows),
      top10PendapatanArea: mapStackedRows(top10PendapatanRes.rows),
      bopoPerCabang,
      kontribusiLabaEntitas,
      bottom10LabaPjm,
    },
  };
}
