import { query } from '@/lib/db/sqliteQuery';
import { getCanonicalBranchCode } from '@/lib/constants';
import {
  BERANDA_ENTITAS_ORDER,
  type BerandaBopoBranchRow,
  type BerandaBranchOption,
  type BerandaEntityShareRow,
  type BerandaPjmBottomRow,
  type BerandaStackedBranchRow,
  type BerandaSummaryResponse,
} from '@/lib/berandaSummary';
import {
  ensureModuleFinansialPopulated,
  FINANSIAL_EFF_COLUMNS_SQL,
  queryFinansialConsolidatedKpis,
} from '@/lib/finansialConsolidationService';

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
      ${FINANSIAL_EFF_COLUMNS_SQL}
    FROM v_module_finansial_entitas
    WHERE year = $2::int
      AND month = $3::int
      AND ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
      AND ($4::text[] IS NULL OR branch_name = ANY($4::text[]))
      AND ($5::text[] IS NULL OR branch_code = ANY($5::text[]))
  )
`;

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

  // 1. Available years, with their coverage
  const yearsRes = await query<{ year: number; branch_count: number }>(
    `SELECT year::int AS year, COUNT(DISTINCT branch_code)::int AS branch_count
     FROM v_module_finansial_entitas
     WHERE ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($2::text[] IS NULL OR branch_code = ANY($2::text[]))
     GROUP BY year
     ORDER BY year ASC`,
    [input.verifiedOnly, rbacBranchCodes]
  );
  const yearCoverage = yearsRes.rows
    .map((r) => ({ year: Number(r.year), branches: Number(r.branch_count) || 0 }))
    .filter((r) => Number.isFinite(r.year));
  const availableYears = yearCoverage.map((r) => r.year);

  let activeYear = input.tahun && availableYears.includes(input.tahun) ? input.tahun : null;
  if (activeYear === null) {
    // Coverage decides the default, not the calendar.
    //
    // This used to prefer 2026 unconditionally. One stray imported row for 2026
    // then made the whole executive dashboard open on a year holding a single
    // zero-valued branch — every KPI read "Rp 0" while 26 branches of real data
    // sat one year earlier. Choosing the year with the widest branch coverage
    // means the default view always shows the data that exists; ties go to the
    // newer year so a completed migration still lands on the current period.
    activeYear = yearCoverage.reduce(
      (best, candidate) => {
        if (!best) return candidate;
        if (candidate.branches !== best.branches) {
          return candidate.branches > best.branches ? candidate : best;
        }
        return candidate.year > best.year ? candidate : best;
      },
      null as { year: number; branches: number } | null
    )?.year ?? yearCoverage[yearCoverage.length - 1]?.year ?? 2026;
  }

  // 2. Available months for active year, with their coverage
  const monthsRes = await query<{ month: number; branch_count: number }>(
    `SELECT month::int AS month, COUNT(DISTINCT branch_code)::int AS branch_count
     FROM v_module_finansial_entitas
     WHERE year = $2::int
       AND ($1::boolean = false OR verification_status = 'verified' OR verified_snapshot_json IS NOT NULL)
       AND ($3::text[] IS NULL OR branch_code = ANY($3::text[]))
     GROUP BY month
     ORDER BY month ASC`,
    [input.verifiedOnly, activeYear, rbacBranchCodes]
  );
  const monthCoverage = monthsRes.rows
    .map((r) => ({ month: Number(r.month), branches: Number(r.branch_count) || 0 }))
    .filter((r) => Number.isFinite(r.month));
  const availableMonths = monthCoverage.map((r) => r.month);

  let activeMonth = input.bulan && availableMonths.includes(input.bulan) ? input.bulan : null;
  if (activeMonth === null) {
    // Same rule as the year: the widest month wins, ties go to the later month.
    activeMonth = monthCoverage.reduce(
      (best, candidate) => {
        if (!best) return candidate;
        if (candidate.branches !== best.branches) {
          return candidate.branches > best.branches ? candidate : best;
        }
        return candidate.month > best.month ? candidate : best;
      },
      null as { month: number; branches: number } | null
    )?.month ?? monthCoverage[monthCoverage.length - 1]?.month ?? 8;
  }

  // 3. Available branches (NM_CBG sorted A-Z) for active year & month
  const branchesRes = await query<{ nm_cbg: string; branch_code: string }>(
    `SELECT
       branch_name AS nm_cbg,
       MIN(branch_code) AS branch_code
     FROM v_module_finansial_entitas
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

  // 4. Hitung KPI utama dari Single Source of Truth PostgreSQL + 5 grafik Beranda secara paralel
  const [
    consolidatedKpis,
    top10LabaRes,
    top10PendapatanRes,
    bopoRes,
    entityShareRes,
    bottom10PjmRes,
  ] = await Promise.all([
    queryFinansialConsolidatedKpis({
      verifiedOnly: input.verifiedOnly,
      year: activeYear,
      month: activeMonth,
      nmCbgList: filterNmCbg,
      branchCodes: null,
      rbacBranchCodes,
      entitas: null, // Konsolidasi seluruh entitas TERMASUK ELIMINASI
    }),
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
    verificationSummary: consolidatedKpis.verificationSummary,
    kpis: {
      labaArea: {
        value: consolidatedKpis.labaBersih.realisasi,
        formatted: consolidatedKpis.labaBersih.formatted,
        yoy: consolidatedKpis.labaBersih.yoy,
        rka: consolidatedKpis.labaBersih.rka,
      },
      pendapatan: {
        value: consolidatedKpis.pendapatan.realisasi,
        formatted: consolidatedKpis.pendapatan.formatted,
        yoy: consolidatedKpis.pendapatan.yoy,
        rka: consolidatedKpis.pendapatan.rka,
      },
      beban: {
        value: consolidatedKpis.beban.realisasi,
        formatted: consolidatedKpis.beban.formatted,
        yoy: consolidatedKpis.beban.yoy,
        rka: consolidatedKpis.beban.rka,
      },
      bopo: consolidatedKpis.bopo,
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
