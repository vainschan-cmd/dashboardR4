import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_BRANCHES, getCanonicalBranchCode, getBranchNameByCode, getModuleDepartmentId } from '@/lib/constants';
import { getDb } from '@/lib/db';
import { ingestInputData } from '@/lib/ingestInputData';
import { resolvePeriodRange } from '@/lib/period';
import { logError } from '@/lib/logger';
import { authorize, resolveReadBranchScope } from '@/lib/policy';
import {
  requireAuth,
  enforceBranchFilterForRead,
  enforceDepartmentFilterForRead,
  enforceVerificationFilterForRead,
} from '@/lib/rbac';

function canonicalRekeningCategory(rekening: string): string {
  const lower = String(rekening || '').trim().toLowerCase();
  if (lower.includes('beban')) return 'beban';
  if (lower.includes('bersih')) return 'laba_bersih';
  if (lower.includes('laba')) return 'laba_usaha';
  if (lower.includes('ebitda')) return 'ebitda';
  return 'pendapatan';
}

function matchesPeriod(
  rowYear: number,
  rowMonth: number,
  exactYear?: number,
  exactMonth?: number,
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
): boolean {
  if (exactYear && !startYear) {
    if (rowYear !== exactYear) return false;
    if (exactMonth && rowMonth !== exactMonth) return false;
    return true;
  }
  if (startYear || endYear) {
    const sY = startYear || 2020;
    const sM = startMonth || 1;
    const eY = endYear || 2035;
    const eM = endMonth || 12;

    const rowVal = rowYear * 100 + rowMonth;
    const startVal = sY * 100 + sM;
    const endVal = eY * 100 + eM;

    return rowVal >= startVal && rowVal <= endVal;
  }
  return true;
}

function ensureModuleTablesPopulated() {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM module_finansial').get() as { count: number };
  if (!countRow || countRow.count === 0) {
    ingestInputData();
  }
}

function resolveVerificationRow<T extends Record<string, unknown>>(
  rawRow: T,
  verifiedOnly: boolean,
  counters: { verified: number; pending: number; revision: number }
): (T & { verificationStatus: string; hasPendingUpdate: boolean }) | null {
  const status = String(rawRow.verification_status || 'verified');
  if (status === 'pending_verification') counters.pending++;
  else if (status === 'revision_needed') counters.revision++;
  else counters.verified++;

  if (!verifiedOnly) {
    return {
      ...rawRow,
      verificationStatus: status,
      hasPendingUpdate: status === 'pending_verification',
    };
  }

  if (status === 'verified') {
    return {
      ...rawRow,
      verificationStatus: 'verified',
      hasPendingUpdate: false,
    };
  }

  // When verifiedOnly is true and an existing verified row was edited (pending_verification),
  // restore its last verified snapshot so BOD sees verified numbers while knowing an update is pending.
  if (rawRow.verified_snapshot_json) {
    try {
      const snapshot = JSON.parse(String(rawRow.verified_snapshot_json)) as Record<string, unknown>;
      return {
        ...rawRow,
        ...snapshot,
        verificationStatus: 'verified',
        hasPendingUpdate: true,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Translate the requested period window into a SQL predicate so the database
 * returns only the rows we need. Previously every module table was read in full
 * and filtered in JavaScript, which produced 0.5–0.6 MB responses.
 *
 * The range form deliberately avoids the compact `year * 100 + month BETWEEN ...`
 * trick: wrapping the columns in an expression makes the composite
 * `(branch_code, year, month)` index unusable for the year/month part, so the
 * planner could only narrow on branch. Written as plain comparisons, SQLite walks
 * the index range directly — the common single-year window becomes
 * `year = ? AND month BETWEEN ? AND ?`.
 */
function buildPeriodSql(filters: {
  exactYear?: number;
  exactMonth?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}): { clause: string; params: Array<string | number> } {
  const { exactYear, exactMonth, startYear, startMonth, endYear, endMonth } = filters;

  if (exactYear && !startYear) {
    if (exactMonth) {
      return { clause: ' AND year = ? AND month = ?', params: [exactYear, exactMonth] };
    }
    return { clause: ' AND year = ?', params: [exactYear] };
  }

  if (startYear || endYear) {
    const sY = startYear || 2020;
    const sM = startMonth || 1;
    const eY = endYear || 2035;
    const eM = endMonth || 12;

    // Same year: a single equality plus a month range keeps the index range scan tight.
    if (sY === eY) {
      return {
        clause: ' AND year = ? AND month BETWEEN ? AND ?',
        params: [sY, Math.min(sM, eM), Math.max(sM, eM)],
      };
    }

    // Cross-year window: two disjoint index ranges instead of an expression scan.
    return {
      clause: ' AND ((year = ? AND month >= ?) OR (year > ? AND year < ?) OR (year = ? AND month <= ?))',
      params: [sY, Math.min(sM, 12), sY, eY, eY, Math.max(eM, 1)],
    };
  }

  return { clause: '', params: [] };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    ensureModuleTablesPopulated();
    const db = getDb();

    const { searchParams } = new URL(req.url);
    const requestedBranch =
      searchParams.get('branchCode') ||
      searchParams.get('branch') ||
      searchParams.get('terminal') ||
      undefined;
    const rawBranch = enforceBranchFilterForRead(auth.session, requestedBranch);
    const targetBranches =
      rawBranch && rawBranch !== 'ALL'
        ? rawBranch === 'NONE'
          ? []
          : rawBranch
              .split(',')
              .map(b => getCanonicalBranchCode(b.trim()))
              .filter(Boolean)
        : null;

    const matchesBranch = (code: string) => {
      if (rawBranch === 'NONE') return false;
      if (!targetBranches || targetBranches.length === 0 || targetBranches.includes('ALL')) return true;
      return targetBranches.includes(code.toUpperCase());
    };

    // Enforce verifiedOnly = true for BOD viewer role even if query parameters are manipulated
    const verifiedOnlyParam = searchParams.get('verifiedOnly') ?? searchParams.get('verified_only');
    const verifiedOnly = enforceVerificationFilterForRead(auth.session, verifiedOnlyParam);

    // Period filters
    const exactYearParam = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
    const exactMonthParam = searchParams.get('month') ? Number(searchParams.get('month')) : undefined;

    let startYear = searchParams.get('startYear') ? Number(searchParams.get('startYear')) : undefined;
    let startMonth = searchParams.get('startMonth') ? Number(searchParams.get('startMonth')) : undefined;
    let endYear = searchParams.get('endYear') ? Number(searchParams.get('endYear')) : undefined;
    let endMonth = searchParams.get('endMonth') ? Number(searchParams.get('endMonth')) : undefined;

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate) {
      const parts = startDate.split('-').map(Number);
      if (parts.length >= 2) {
        startYear = parts[0];
        startMonth = parts[1];
      }
    }
    if (endDate) {
      const parts = endDate.split('-').map(Number);
      if (parts.length >= 2) {
        endYear = parts[0];
        endMonth = parts[1];
      }
    }

    const periodName = searchParams.get('period');
    if (periodName) {
      // Single parser shared with the UI — no duplicated month-name mapping.
      const range = resolvePeriodRange(periodName);
      startYear = range.startYear;
      startMonth = range.startMonth;
      endYear = range.endYear;
      endMonth = range.endMonth;
    }

    const counters = { verified: 0, pending: 0, revision: 0 };

    // ---- Shared SQL scope --------------------------------------------------
    const periodSql = buildPeriodSql({
      exactYear: exactYearParam,
      exactMonth: exactMonthParam,
      startYear,
      startMonth,
      endYear,
      endMonth,
    });

    const noBranchMatch = rawBranch === 'NONE';
    const branchCodesForSql =
      targetBranches && targetBranches.length > 0 && !targetBranches.includes('ALL')
        ? targetBranches
        : null;

    const branchSql =
      noBranchMatch
        ? ' AND 1 = 0'
        : branchCodesForSql
          ? ` AND branch_code IN (${branchCodesForSql.map(() => '?').join(',')})`
          : '';

    const whereSql = `${branchSql}${periodSql.clause}`;
    const whereParams: Array<string | number> = [
      ...(branchCodesForSql || []),
      ...periodSql.params,
    ];

    // 1. Finansial from SQLite module_finansial
    const rawFinRows = db
      .prepare(
        `SELECT * FROM module_finansial WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const allFinMapped = rawFinRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        const cabang = Number(r.cabang_rp || 0);
        const konsolidasi = Number(r.konsolidasi_rp || 0);
        const yoy = Number(r.yoy || 0);
        const rka = Number(r.rka || 0);
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          rekening: String(r.rekening || '').trim(),
          cabangRp: cabang,
          cabangM: Number((cabang / 1_000_000_000).toFixed(2)),
          pmtRp: Number(r.pmt_rp || 0),
          ptpRp: Number(r.ptp_rp || 0),
          pslRp: Number(r.psl_rp || 0),
          pjmRp: Number(r.pjm_rp || 0),
          eliminasiRp: Number(r.eliminasi_rp || 0),
          konsolidasiRp: konsolidasi,
          konsolidasiM: Number((konsolidasi / 1_000_000_000).toFixed(2)),
          yoy: Number(yoy.toFixed(1)),
          rka: Number(rka.toFixed(1)),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      });

    // Group by (branchCode, canonicalRekeningCategory) so updating one account in 2026
    // never drops the other 3 accounts (Beban, Laba Usaha, Laba Bersih) for that branch.
    const finByBranchAndAccount = new Map<string, typeof allFinMapped>();
    for (const r of allFinMapped) {
      if (!matchesBranch(r.branchCode)) continue;
      const key = `${r.branchCode}__${canonicalRekeningCategory(r.rekening)}`;
      if (!finByBranchAndAccount.has(key)) finByBranchAndAccount.set(key, []);
      finByBranchAndAccount.get(key)!.push(r);
    }

    const finansial: typeof allFinMapped = [];
    finByBranchAndAccount.forEach(rows => {
      const matchingRows = rows.filter(r =>
        matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth)
      );
      if (matchingRows.length === 0) return;

      if (exactYearParam && !startYear) {
        // Explicit single period filter: return every matching account row.
        finansial.push(...matchingRows);
        return;
      }

      // Range query: use the most recent row for this (branch, account).
      // No silent fallback to another year — a branch without data in the window
      // simply has no row, and the UI shows "belum tersedia".
      finansial.push(matchingRows[0]);
    });

    // 2. Opkom from SQLite module_opkom
    const rawOpkomRows = db
      .prepare(
        `SELECT * FROM module_opkom WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const opkom = rawOpkomRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        const jumlahRp = Number(r.jumlah_rp || 0);
        const yoy = Number(r.yoy || 0);
        const rka = Number(r.rka || 0);
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          layanan: String(r.layanan || '').trim().toUpperCase(),
          satuan: String(r.satuan || 'Rp').trim(),
          jumlahRp,
          jumlahM: Number((jumlahRp / 1_000_000_000).toFixed(2)),
          yoy: Number(yoy.toFixed(1)),
          rka: Number(rka.toFixed(1)),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 3. Kinerja from SQLite module_kinerja
    const rawKinerjaRows = db
      .prepare(
        `SELECT * FROM module_kinerja WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const kinerja = rawKinerjaRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          kdKine: String(r.kd_kine || '').trim(),
          nmKine: String(r.nm_kine || '').trim().toUpperCase(),
          satuan: String(r.satuan || '').trim(),
          nilai: Number(r.nilai || 0),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 4. Utilisasi from SQLite module_utilisasi
    const rawUtilRows = db
      .prepare(
        `SELECT * FROM module_utilisasi WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const utilisasi = rawUtilRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          kdJenderm: String(r.kd_jenderm || '1').trim(),
          dermaga: String(r.dermaga || 'MULTIPURPOSE').trim(),
          bor: Number(r.bor || 0),
          yor: Number(r.yor || 0),
          sor: Number(r.sor || 0),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 5. Peralatan from SQLite module_peralatan
    const rawAlatRows = db
      .prepare(
        `SELECT * FROM module_peralatan WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const peralatan = rawAlatRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          kdAlat: String(r.kd_alat || '').trim(),
          nmAlat: String(r.nm_alat || '').trim(),
          singkatan: String(r.singkatan || '').trim(),
          jnsAlat: String(r.jns_alat || '').trim(),
          jumlah: Number(r.jumlah || 0),
          availability: Number(r.availability || 0),
          utilisasi: Number(r.utilisasi || 0),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 6. Fasilitas from SQLite module_fasilitas
    const rawFasRows = db
      .prepare(
        `SELECT * FROM module_fasilitas WHERE 1 = 1${whereSql} ORDER BY year DESC, month DESC, branch_code ASC`
      )
      .all(...whereParams) as Array<Record<string, unknown>>;

    const fasilitas = rawFasRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        const branchName = getBranchNameByCode(code) || String(r.branch_name || '');
        return {
          id: String(r.id || ''),
          monthlyRecordId: r.monthly_record_id ? String(r.monthly_record_id) : null,
          year: Number(r.year),
          month: Number(r.month),
          branchCode: code,
          branchName,
          namaFasilitas: String(r.nama_fasilitas || 'Fasilitas').trim(),
          jenisFasilitas: String(r.jenis_fasilitas || '').trim(),
          satuan: String(r.satuan || 'meter').trim(),
          panjangM: Number(r.panjang_m || 0),
          lebarM: Number(r.lebar_m || 0),
          mLws: Number(r.mlws || 0),
          luasSqm: Number(r.luas_sqm || 0),
          kapasitas: r.kapasitas ? String(r.kapasitas).trim() : null,
          keterangan: r.keterangan ? String(r.keterangan).trim() : '',
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          uploadedAt: r.uploaded_at ? String(r.uploaded_at) : null,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 7. Equipment Catalog from SQLite equipment_catalog
    const equipmentCatalog = (
      db.prepare('SELECT code, name, acronym, category FROM equipment_catalog WHERE active = 1 ORDER BY code ASC').all() as Array<Record<string, unknown>>
    ).map(r => ({
      code: String(r.code).trim(),
      name: String(r.name).trim(),
      acronym: String(r.acronym || '').trim(),
      category: String(r.category || 'OPERASIONAL').trim(),
    }));

    // 8. Additional KPI Records from SQLite monthly_records (e.g. kpi_rfu, kpi_sla, kpi_csat)
    const kpiPeriodSql = periodSql.clause.replace(/\byear\b/g, 'r.year').replace(/\bmonth\b/g, 'r.month');
    const kpiBranchSql = noBranchMatch
      ? ' AND 1 = 0'
      : branchCodesForSql
        ? ` AND UPPER(b.code) IN (${branchCodesForSql.map(() => '?').join(',')})`
        : '';
    const rawKpiRecords = db
      .prepare(`
        SELECT r.id, r.indicator_id, r.year, r.month, r.target, r.realization, r.unit,
               r.achievement_pct, r.verification_status, b.code as branch_code, b.name as branch_name
        FROM monthly_records r
        JOIN branches b ON r.branch_id = b.id
        WHERE r.indicator_id IN ('kpi_rfu', 'kpi_sla', 'kpi_csat')
        ${kpiBranchSql}
        ${kpiPeriodSql}
      `)
      .all(...whereParams) as Array<Record<string, unknown>>;

    const kpiRecords = rawKpiRecords
      .filter(r => {
        if (verifiedOnly && r.verification_status !== 'verified') return false;
        const code = getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || ''));
        if (!matchesBranch(code)) return false;
        return matchesPeriod(Number(r.year), Number(r.month), exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      })
      .map(r => ({
        id: String(r.id || ''),
        indicatorId: String(r.indicator_id || ''),
        year: Number(r.year),
        month: Number(r.month),
        branchCode: getCanonicalBranchCode(String(r.branch_code || ''), String(r.branch_name || '')),
        branchName: String(r.branch_name || ''),
        target: Number(r.target),
        realization: Number(r.realization),
        unit: String(r.unit || ''),
        achievementPct: Number(r.achievement_pct),
        verificationStatus: String(r.verification_status || 'verified'),
      }));

    const branchScope = resolveReadBranchScope(
      {
        role: auth.session.role,
        branch_id: auth.session.branch_id,
        department_id: auth.session.department_id,
        sub: auth.session.sub,
      },
      undefined
    );
    const scopedOfficialBranches = branchScope
      ? OFFICIAL_BRANCHES.filter((b) => b.code.toUpperCase() === branchScope.toUpperCase())
      : OFFICIAL_BRANCHES;

    // Department-scoped roles only receive modules owned by their department.
    const scopedDepartmentId = enforceDepartmentFilterForRead(auth.session, undefined);
    const canViewModule = (module: string) =>
      !scopedDepartmentId || getModuleDepartmentId(module) === scopedDepartmentId;

    // Executive viewers are not told how much unverified data exists; that would
    // be operational detail they cannot act on.
    const viewerSeesCounters = authorize(
      {
        role: auth.session.role,
        branch_id: auth.session.branch_id,
        department_id: auth.session.department_id,
        sub: auth.session.sub,
      },
      'data:verify'
    ).allowed;

    return NextResponse.json({
      success: true,
      source: 'sqlite',
      verifiedOnly,
      verificationSummary: {
        verifiedCount: counters.verified,
        pendingCount: viewerSeesCounters ? counters.pending : 0,
        revisionCount: viewerSeesCounters ? counters.revision : 0,
      },
      branches: scopedOfficialBranches,
      finansial: canViewModule('finansial') ? finansial : [],
      opkom: canViewModule('opkom') ? opkom : [],
      kinerja: canViewModule('kinerja') ? kinerja : [],
      utilisasi: canViewModule('utilisasi') ? utilisasi : [],
      peralatan: canViewModule('peralatan') ? peralatan : [],
      fasilitas: canViewModule('fasilitas') ? fasilitas : [],
      equipmentCatalog: canViewModule('peralatan') ? equipmentCatalog : [],
      kpiRecords: canViewModule('kinerja') ? kpiRecords : [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data modul.';
    logError('api/modules-data', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: message, requestId: req.headers.get('x-request-id') },
      { status: 500 }
    );
  }
}
