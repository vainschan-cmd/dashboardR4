import { NextRequest, NextResponse } from 'next/server';
import { getCanonicalBranchCode } from '@/lib/constants';
import { getDb } from '@/lib/db';
import { logError } from '@/lib/logger';
import {
  requireAuth,
  enforceBranchFilterForRead,
  enforceVerificationFilterForRead,
} from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'records:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const db = getDb();

    // Default to the most recent period that actually exists, instead of a
    // hardcoded month that becomes stale as soon as new data arrives.
    const latestPeriod = db
      .prepare('SELECT MAX(year) AS year FROM module_finansial')
      .get() as { year: number | null } | undefined;
    const latestYear = Number(latestPeriod?.year) || new Date().getFullYear();
    const latestMonthRow = db
      .prepare('SELECT MAX(month) AS month FROM module_finansial WHERE year = ?')
      .get(latestYear) as { month: number | null } | undefined;

    const year = Number(searchParams.get('year') || latestYear);
    const month = Number(searchParams.get('month') || latestMonthRow?.month || 12);
    const branchParam =
      searchParams.get('branch') ||
      searchParams.get('branches') ||
      searchParams.get('branchCode') ||
      searchParams.get('terminal') ||
      '';

    // Server-side row-level security: a PIC Cabang can never widen the filter beyond
    // their assigned branch, and a viewer may only read verified rows.
    const scopedBranch = enforceBranchFilterForRead(auth.session, branchParam);
    const verifiedOnly = enforceVerificationFilterForRead(
      auth.session,
      searchParams.get('verifiedOnly') ?? searchParams.get('verified_only')
    );

    // Canonical branch codes only — the data layer stores `branch_code`, not display names.
    const selectedCodes: string[] = [];
    if (scopedBranch && scopedBranch !== 'ALL' && scopedBranch !== 'NONE') {
      for (const raw of scopedBranch.split(',')) {
        const trimmed = raw.trim();
        const code = getCanonicalBranchCode(trimmed, trimmed);
        if (code) selectedCodes.push(code);
      }
    }

    const branchFilter = (column: string) => {
      if (selectedCodes.length === 0) return '';
      const placeholders = selectedCodes.map(() => '?').join(',');
      return ` AND ${column} IN (${placeholders})`;
    };
    const branchValues = selectedCodes.length > 0 ? [...selectedCodes] : [];
    const verifiedFilter = verifiedOnly ? " AND verification_status = 'verified'" : '';

    // `module_finansial` carries verification_status; `module_finansial_entitas` does not.
    const branchCondition = branchFilter('branch_code') + verifiedFilter;
    const entitasCondition = branchFilter('branch_code');
    const bopoBranchCondition = branchFilter('b.branch_code');
    const params: (string | number)[] = [year, month, ...branchValues];

    // 1. KPI Aggregates: Laba Bersih, Pendapatan, Beban
    const kpiRows = db
      .prepare(
        `
      SELECT rekening, SUM(konsolidasi_rp) as total_rp, AVG(yoy) as avg_yoy, AVG(rka) as avg_rka
      FROM module_finansial
      WHERE year = ? AND month = ? ${branchCondition}
      GROUP BY rekening
    `
      )
      .all(...params) as Array<{
      rekening: string;
      total_rp: number;
      avg_yoy: number;
      avg_rka: number;
    }>;

    const kpiMap: Record<string, { total_rp: number; yoy: number | null; rka: number | null }> = {};
    for (const row of kpiRows) {
      kpiMap[row.rekening] = {
        total_rp: Number(row.total_rp || 0),
        // Missing comparison values stay null instead of being replaced by a fake 100%.
        yoy: row.avg_yoy === null || row.avg_yoy === undefined ? null : Number(row.avg_yoy),
        rka: row.avg_rka === null || row.avg_rka === undefined ? null : Number(row.avg_rka),
      };
    }

    const labaBersihRp = kpiMap['Laba Bersih']?.total_rp || 0;
    const labaBersihYoY = kpiMap['Laba Bersih']?.yoy ?? null;
    const labaBersihRKA = kpiMap['Laba Bersih']?.rka ?? null;

    const pendapatanRp = kpiMap['Pendapatan']?.total_rp || 0;
    const pendapatanYoY = kpiMap['Pendapatan']?.yoy ?? null;
    const pendapatanRKA = kpiMap['Pendapatan']?.rka ?? null;

    const bebanRp = kpiMap['Beban']?.total_rp || 0;
    const bebanYoY = kpiMap['Beban']?.yoy ?? null;
    const bebanRKA = kpiMap['Beban']?.rka ?? null;

    const bopoPct = pendapatanRp > 0 ? (Math.abs(bebanRp) / pendapatanRp) * 100 : null;

    // 2. 10 Cabang Terbesar Laba Area (Stacked by Entitas: CABANG, PJM, PMT, PSL, PTP)
    const topLabaRows = db
      .prepare(
        `
      SELECT 
        branch_name,
        branch_code,
        cabang_rp,
        pjm_rp,
        pmt_rp,
        psl_rp,
        ptp_rp,
        konsolidasi_rp
      FROM module_finansial
      WHERE year = ? AND month = ? AND rekening = 'Laba Bersih' ${branchCondition}
      ORDER BY konsolidasi_rp DESC
      LIMIT 10
    `
      )
      .all(...params) as Array<{
      branch_name: string;
      branch_code: string;
      cabang_rp: number;
      pjm_rp: number;
      pmt_rp: number;
      psl_rp: number;
      ptp_rp: number;
      konsolidasi_rp: number;
    }>;

    const topLabaBranches = topLabaRows.map((r) => ({
      branchName: r.branch_name,
      branchCode: r.branch_code,
      CABANG: Number(r.cabang_rp || 0),
      PJM: Number(r.pjm_rp || 0),
      PMT: Number(r.pmt_rp || 0),
      PSL: Number(r.psl_rp || 0),
      PTP: Number(r.ptp_rp || 0),
      total: Number(r.konsolidasi_rp || 0),
    }));

    // 3. 10 Cabang Terbesar Pendapatan Area (Stacked by Entitas, without ELIMINASI)
    const topPendapatanRows = db
      .prepare(
        `
      SELECT 
        branch_name,
        SUM(CASE WHEN entitas='CABANG' THEN realisasi ELSE 0 END) as cabang,
        SUM(CASE WHEN entitas='PJM' THEN realisasi ELSE 0 END) as pjm,
        SUM(CASE WHEN entitas='PMT' THEN realisasi ELSE 0 END) as pmt,
        SUM(CASE WHEN entitas='PSL' THEN realisasi ELSE 0 END) as psl,
        SUM(CASE WHEN entitas='PTP' THEN realisasi ELSE 0 END) as ptp,
        SUM(realisasi) as grand_total
      FROM module_finansial_entitas
      WHERE year = ? AND month = ? AND rekening = 'Pendapatan' AND entitas != 'ELIMINASI' ${entitasCondition}
      GROUP BY branch_name
      ORDER BY grand_total DESC
      LIMIT 10
    `
      )
      .all(...params) as Array<{
      branch_name: string;
      cabang: number;
      pjm: number;
      pmt: number;
      psl: number;
      ptp: number;
      grand_total: number;
    }>;

    const topPendapatanBranches = topPendapatanRows.map((r) => ({
      branchName: r.branch_name,
      CABANG: Number(r.cabang || 0),
      PJM: Number(r.pjm || 0),
      PMT: Number(r.pmt || 0),
      PSL: Number(r.psl || 0),
      PTP: Number(r.ptp || 0),
      total: Number(r.grand_total || 0),
    }));

    // 4. BOPO Area per Cabang (Beban / Pendapatan per cabang)
    const bopoCabangRows = db
      .prepare(
        `
      SELECT 
        b.branch_name,
        b.branch_code,
        abs(b.konsolidasi_rp) as beban,
        p.konsolidasi_rp as pendapatan,
        CASE WHEN p.konsolidasi_rp > 0 THEN (abs(b.konsolidasi_rp) / p.konsolidasi_rp) * 100 ELSE 0 END as bopo
      FROM module_finansial b
      JOIN module_finansial p ON b.branch_code = p.branch_code AND b.year = p.year AND b.month = p.month
      WHERE b.year = ? AND b.month = ? AND b.rekening = 'Beban' AND p.rekening = 'Pendapatan' ${bopoBranchCondition}
      ORDER BY b.branch_name ASC
    `
      )
      .all(...params) as Array<{
      branch_name: string;
      branch_code: string;
      beban: number;
      pendapatan: number;
      bopo: number;
    }>;

    const bopoPerCabang = bopoCabangRows.map((r) => ({
      branchName: r.branch_name,
      branchCode: r.branch_code,
      beban: Number(r.beban || 0),
      pendapatan: Number(r.pendapatan || 0),
      bopoPct: Number(Number(r.bopo || 0).toFixed(2)),
    }));

    // 5. % Kontribusi Laba Area per Entitas (rekening = 'Laba Bersih', excluding ELIMINASI)
    const entitasLabaRows = db
      .prepare(
        `
      SELECT entitas, SUM(realisasi) as total_laba
      FROM module_finansial_entitas
      WHERE year = ? AND month = ? AND rekening = 'Laba Bersih' AND entitas != 'ELIMINASI' ${entitasCondition}
      GROUP BY entitas
      ORDER BY total_laba DESC
    `
      )
      .all(...params) as Array<{
      entitas: string;
      total_laba: number;
    }>;

    const grandLabaEntitas = entitasLabaRows.reduce((acc, r) => acc + (r.total_laba || 0), 0);
    const kontribusiEntitas = entitasLabaRows.map((r) => ({
      entitas: r.entitas,
      realisasi: Number(r.total_laba || 0),
      percentage: grandLabaEntitas > 0 ? Number(((r.total_laba / grandLabaEntitas) * 100).toFixed(1)) : 0,
    }));

    // 6. 10 Cabang Terendah Laba Area PJM
    const pjmTerendahRows = db
      .prepare(
        `
      SELECT branch_name, branch_code, realisasi
      FROM module_finansial_entitas
      WHERE year = ? AND month = ? AND rekening = 'Laba Bersih' AND entitas = 'PJM' ${entitasCondition}
      ORDER BY realisasi ASC
      LIMIT 10
    `
      )
      .all(...params) as Array<{
      branch_name: string;
      branch_code: string;
      realisasi: number;
    }>;

    const pjmTerendah = pjmTerendahRows.map((r) => ({
      branchName: r.branch_name,
      branchCode: r.branch_code,
      realisasi: Number(r.realisasi || 0),
      realisasiBillion: Number((Number(r.realisasi || 0) / 1_000_000_000).toFixed(3)),
    }));

    // 7. Metadata options (Available Years, Months, and Branches)
    const availablePeriods = db
      .prepare(
        `
      SELECT DISTINCT year, month
      FROM module_finansial_entitas
      ORDER BY year DESC, month DESC
    `
      )
      .all() as Array<{ year: number; month: number }>;

    // Filter in SQL, not in JavaScript: reading every distinct branch and
    // discarding most of them client-side is exactly the pattern this endpoint
    // must avoid (RBAC-09). The scoped codes are already canonical.
    const availableBranches = (
      selectedCodes.length === 0
        ? (db
            .prepare(
              `
      SELECT DISTINCT branch_code, branch_name
      FROM module_finansial_entitas
      ORDER BY branch_name ASC
    `
            )
            .all() as Array<{ branch_code: string; branch_name: string }>)
        : (db
            .prepare(
              `
      SELECT DISTINCT branch_code, branch_name
      FROM module_finansial_entitas
      WHERE branch_code IN (${selectedCodes.map(() => '?').join(',')})
      ORDER BY branch_name ASC
    `
            )
            .all(...selectedCodes) as Array<{ branch_code: string; branch_name: string }>)
    );

    const toNullable2 = (value: number | null) => (value === null ? null : Number(value.toFixed(2)));

    return NextResponse.json({
      success: true,
      verifiedOnly,
      filters: {
        year,
        month,
        selectedBranches: selectedCodes,
      },
      kpi: {
        labaArea: {
          realisasi: labaBersihRp,
          yoy: toNullable2(labaBersihYoY),
          rka: toNullable2(labaBersihRKA),
        },
        pendapatan: {
          realisasi: pendapatanRp,
          yoy: toNullable2(pendapatanYoY),
          rka: toNullable2(pendapatanRKA),
        },
        beban: {
          realisasi: bebanRp,
          yoy: toNullable2(bebanYoY),
          rka: toNullable2(bebanRKA),
        },
        bopo: {
          percentage: bopoPct === null ? null : Number(bopoPct.toFixed(2)),
        },
      },
      charts: {
        topLabaBranches,
        topPendapatanBranches,
        bopoPerCabang,
        kontribusiEntitas,
        pjmTerendah,
      },
      options: {
        availablePeriods,
        availableBranches,
      },
    });
  } catch (err: unknown) {
    logError('api/keuangan/konsolidasi', err, { requestId: req.headers.get('x-request-id') });
    const message = err instanceof Error ? err.message : 'Gagal memproses data konsolidasi keuangan.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

