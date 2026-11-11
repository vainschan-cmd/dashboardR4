import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'records:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') || '2026');
    const month = Number(searchParams.get('month') || '8');
    const branchParam = searchParams.get('branch') || searchParams.get('branches') || '';

    const db = getDb();

    // Parse branch filter if provided
    let selectedBranches: string[] = [];
    if (branchParam && branchParam !== 'ALL') {
      selectedBranches = branchParam
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
    }

    let branchCondition = '';
    const params: (string | number)[] = [year, month];
    if (selectedBranches.length > 0) {
      const placeholders = selectedBranches.map(() => '?').join(',');
      branchCondition = ` AND branch_name IN (${placeholders})`;
      params.push(...selectedBranches);
    }

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

    const kpiMap: Record<string, { total_rp: number; yoy: number; rka: number }> = {};
    for (const row of kpiRows) {
      kpiMap[row.rekening] = {
        total_rp: Number(row.total_rp || 0),
        yoy: Number(row.avg_yoy || 100),
        rka: Number(row.avg_rka || 100),
      };
    }

    const labaBersihRp = kpiMap['Laba Bersih']?.total_rp || 0;
    const labaBersihYoY = kpiMap['Laba Bersih']?.yoy || 99.01;
    const labaBersihRKA = kpiMap['Laba Bersih']?.rka || 99.01;

    const pendapatanRp = kpiMap['Pendapatan']?.total_rp || 0;
    const pendapatanYoY = kpiMap['Pendapatan']?.yoy || 99.01;
    const pendapatanRKA = kpiMap['Pendapatan']?.rka || 99.01;

    const bebanRp = kpiMap['Beban']?.total_rp || 0;
    const bebanYoY = kpiMap['Beban']?.yoy || 99.01;
    const bebanRKA = kpiMap['Beban']?.rka || 99.01;

    const bopoPct = pendapatanRp > 0 ? (Math.abs(bebanRp) / pendapatanRp) * 100 : 0;

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
      WHERE year = ? AND month = ? AND rekening = 'Pendapatan' AND entitas != 'ELIMINASI' ${branchCondition}
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
      WHERE b.year = ? AND b.month = ? AND b.rekening = 'Beban' AND p.rekening = 'Pendapatan'
      ${selectedBranches.length > 0 ? ` AND b.branch_name IN (${selectedBranches.map(() => '?').join(',')})` : ''}
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
      WHERE year = ? AND month = ? AND rekening = 'Laba Bersih' AND entitas != 'ELIMINASI' ${branchCondition}
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
      WHERE year = ? AND month = ? AND rekening = 'Laba Bersih' AND entitas = 'PJM' ${branchCondition}
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

    const availableBranches = db
      .prepare(
        `
      SELECT DISTINCT branch_code, branch_name
      FROM module_finansial_entitas
      ORDER BY branch_name ASC
    `
      )
      .all() as Array<{ branch_code: string; branch_name: string }>;

    return NextResponse.json({
      success: true,
      filters: {
        year,
        month,
        selectedBranches,
      },
      kpi: {
        labaArea: {
          realisasi: labaBersihRp,
          yoy: Number(labaBersihYoY.toFixed(2)),
          rka: Number(labaBersihRKA.toFixed(2)),
        },
        pendapatan: {
          realisasi: pendapatanRp,
          yoy: Number(pendapatanYoY.toFixed(2)),
          rka: Number(pendapatanRKA.toFixed(2)),
        },
        beban: {
          realisasi: bebanRp,
          yoy: Number(bebanYoY.toFixed(2)),
          rka: Number(bebanRKA.toFixed(2)),
        },
        bopo: {
          percentage: Number(bopoPct.toFixed(2)),
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
    const message = err instanceof Error ? err.message : 'Gagal memproses data konsolidasi keuangan.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

