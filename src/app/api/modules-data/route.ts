import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_BRANCHES, getCanonicalBranchCode, getBranchNameByCode } from '@/lib/constants';
import { query } from '@/lib/db';
import { requireAuth, enforceBranchFilterForRead } from '@/lib/rbac';
import { canonicalRekening, parseMetricPercent, parseRealisasi } from '@/lib/finansialHelpers';
import {
  normalizeGrupEntitas,
  normalizeKondisi,
  normalizeNullableText,
  normalizeTanggalISO,
  resolvePeralatanBranchCode,
} from '@/lib/peralatanHelpers';
import type { FinansialRecord, PeralatanRecord } from '@/lib/types';

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

async function ensureModuleTablesPopulated() {
  const res = await query<{ count: number }>('SELECT COUNT(*) as count FROM module_finansial');
  const count = Number(res.rows[0]?.count || 0);
  if (count === 0) {
    console.warn('[modules-data] Tabel module_finansial kosong di PostgreSQL ed_dashboard.');
  }
}

function resolveVerificationRow<T extends Record<string, any>>(
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
      const snapshot =
        typeof rawRow.verified_snapshot_json === 'string'
          ? JSON.parse(rawRow.verified_snapshot_json)
          : rawRow.verified_snapshot_json;
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

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    await ensureModuleTablesPopulated();

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

    // Default verifiedOnly = true for BOD viewer role unless explicitly overridden via ?verifiedOnly=false
    const isBodViewer = auth.session.role === 'viewer';
    const verifiedOnlyParam = searchParams.get('verifiedOnly');
    const verifiedOnly =
      verifiedOnlyParam !== null ? verifiedOnlyParam === 'true' : isBodViewer;

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
      const p = periodName.toUpperCase();
      if (p.includes('FY 2025') || p.includes('2025')) {
        startYear = 2025;
        startMonth = 1;
        endYear = 2025;
        endMonth = 12;
      } else if (p.includes('YTD SEP 2026') || p.includes('SEP 2026')) {
        startYear = 2026;
        startMonth = 1;
        endYear = 2026;
        endMonth = 9;
      } else if (p.includes('YTD JUN 2026') || p.includes('JUN 2026')) {
        startYear = 2026;
        startMonth = 1;
        endYear = 2026;
        endMonth = 6;
      } else if (p.includes('YTD MAR 2026') || p.includes('MAR 2026')) {
        startYear = 2026;
        startMonth = 1;
        endYear = 2026;
        endMonth = 3;
      }
    }

    const counters = { verified: 0, pending: 0, revision: 0 };

    // 1. Finansial from PostgreSQL module_finansial (9 field standar)
    const includeAllFinansial = searchParams.get('includeAllFinansial') === 'true';
    const entitasParam = searchParams.get('entitas')?.trim().toUpperCase();
    const nmCbgParam = searchParams.get('nmCbg')?.trim().toLowerCase();

    const rawFinRows = (
      await query(
        'SELECT * FROM module_finansial ORDER BY year DESC, month DESC, branch_code ASC, rekening ASC, entitas ASC'
      )
    ).rows as any[];

    const allFinMapped: FinansialRecord[] = rawFinRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        const branchName = getBranchNameByCode(code) || String(r.branch_name || code).trim();
        const rkaParsed = parseMetricPercent(r.rka);
        const yoyParsed = parseMetricPercent(r.yoy);
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id,
          TAHUN: Number(r.year),
          BULAN: Number(r.month),
          KODE_CBG: code,
          NM_CBG: branchName,
          REKENING: canonicalRekening(r.rekening),
          ENTITAS: String(r.entitas || 'CABANG').trim().toUpperCase(),
          REALISASI: parseRealisasi(r.realisasi),
          RKA: rkaParsed === null ? '-' : rkaParsed,
          YOY: yoyParsed === null ? '-' : yoyParsed,
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      });

    const matchesFinFilters = (r: FinansialRecord) => {
      if (!matchesBranch(r.KODE_CBG)) return false;
      if (entitasParam && entitasParam !== 'ALL' && entitasParam !== 'SEMUA' && r.ENTITAS !== entitasParam) {
        return false;
      }
      if (nmCbgParam && nmCbgParam !== 'all' && nmCbgParam !== 'semua' && r.NM_CBG.toLowerCase() !== nmCbgParam) {
        return false;
      }
      return true;
    };

    let finansial: FinansialRecord[] = [];
    if (includeAllFinansial && !periodName && !startYear && !endYear) {
      finansial = allFinMapped.filter(r => {
        if (!matchesFinFilters(r)) return false;
        if (exactYearParam && r.TAHUN !== exactYearParam) return false;
        if (exactMonthParam && r.BULAN !== exactMonthParam) return false;
        return true;
      });
    } else {
      // Kelompokkan per (KODE_CBG, REKENING, ENTITAS) agar seluruh entitas termasuk ELIMINASI selalu terjaga
      const finByBranchAccountEntity = new Map<string, FinansialRecord[]>();
      for (const r of allFinMapped) {
        if (!matchesFinFilters(r)) continue;
        const key = `${r.KODE_CBG}__${canonicalRekening(r.REKENING)}__${r.ENTITAS}`;
        if (!finByBranchAccountEntity.has(key)) finByBranchAccountEntity.set(key, []);
        finByBranchAccountEntity.get(key)!.push(r);
      }

      finByBranchAccountEntity.forEach(rows => {
        const matchingRows = rows.filter(r =>
          matchesPeriod(r.TAHUN, r.BULAN, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth)
        );
        if (exactYearParam && !startYear) {
          finansial.push(...matchingRows);
        } else if (matchingRows.length > 0) {
          // Ambil snapshot periode terbaru dalam rentang filter agar kumulatif YTD tidak terjumlah ganda
          finansial.push(matchingRows[0]);
        } else {
          const baseline = rows.filter(r => r.TAHUN === 2025);
          if (baseline.length > 0) {
            finansial.push(baseline[0]);
          }
        }
      });
    }

    // 2. Opkom from PostgreSQL module_opkom
    const rawOpkomRows = (
      await query('SELECT * FROM module_opkom ORDER BY year DESC, month DESC, branch_code ASC')
    ).rows as any[];

    const opkom = rawOpkomRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        const branchName = getBranchNameByCode(code) || r.branch_name;
        const jumlahRp = Number(r.jumlah_rp || 0);
        const yoy = Number(r.yoy || 0);
        const rka = Number(r.rka || 0);
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id,
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
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 3. Kinerja from PostgreSQL module_kinerja
    const rawKinerjaRows = (
      await query('SELECT * FROM module_kinerja ORDER BY year DESC, month DESC, branch_code ASC')
    ).rows as any[];

    const kinerja = rawKinerjaRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        const branchName = getBranchNameByCode(code) || r.branch_name;
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id,
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
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 4. Utilisasi from PostgreSQL module_utilisasi
    const rawUtilRows = (
      await query('SELECT * FROM module_utilisasi ORDER BY year DESC, month DESC, branch_code ASC')
    ).rows as any[];

    const utilisasi = rawUtilRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        const branchName = getBranchNameByCode(code) || r.branch_name;
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id,
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
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 5. Peralatan from PostgreSQL module_peralatan (9 Kolom Standar)
    const includeAllPeralatan = searchParams.get('includeAllPeralatan') === 'true';
    const tanggalParam = searchParams.get('tanggal')?.trim();
    const grupEntitasParam = searchParams.get('grupEntitas')?.trim().toUpperCase();
    const namaCabangParam = searchParams.get('namaCabang')?.trim().toLowerCase();
    const kategoriAlatParam = searchParams.get('kategoriAlat')?.trim().toLowerCase();
    const kondisiParam = searchParams.get('kondisi')?.trim();

    const rawAlatRows = (
      await query(
        `SELECT *, TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal_iso
         FROM module_peralatan
         ORDER BY tanggal DESC, grup_entitas ASC, nama_cabang ASC, nama_alat ASC`
      )
    ).rows as any[];

    const allAlatMapped: PeralatanRecord[] = rawAlatRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const tanggal = String(r.tanggal_iso || normalizeTanggalISO(r.tanggal) || '').trim();
        const namaCabang = String(r.nama_cabang || '').trim();
        const branchCode = resolvePeralatanBranchCode(namaCabang, r.branch_code);
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id || null,
          branchCode,
          tanggal,
          grup_entitas: normalizeGrupEntitas(r.grup_entitas),
          nama_cabang: namaCabang,
          nama_alat: String(r.nama_alat || '').trim(),
          jenis_alat: String(r.jenis_alat || '').trim(),
          kategori_alat: String(r.kategori_alat || '').trim(),
          kondisi: normalizeKondisi(r.kondisi),
          kerusakan: normalizeNullableText(r.kerusakan),
          tindak_lanjut: normalizeNullableText(r.tindak_lanjut),
          verificationStatus: r.verificationStatus,
          hasPendingUpdate: r.hasPendingUpdate,
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      });

    const branchScopedAlat = allAlatMapped.filter(r => {
      if (!matchesBranch(r.branchCode || 'R99')) return false;
      if (grupEntitasParam && grupEntitasParam !== 'ALL' && r.grup_entitas !== grupEntitasParam) return false;
      if (namaCabangParam && namaCabangParam !== 'all' && r.nama_cabang.toLowerCase() !== namaCabangParam) return false;
      if (kategoriAlatParam && kategoriAlatParam !== 'all' && r.kategori_alat.toLowerCase() !== kategoriAlatParam) {
        return false;
      }
      if (kondisiParam && kondisiParam !== 'ALL' && r.kondisi !== normalizeKondisi(kondisiParam)) return false;
      if (tanggalParam && tanggalParam !== 'ALL' && r.tanggal !== tanggalParam) return false;
      return true;
    });

    let peralatan: PeralatanRecord[];
    if (includeAllPeralatan || tanggalParam) {
      peralatan = branchScopedAlat;
    } else if (startDate || endDate) {
      peralatan = branchScopedAlat.filter(r => {
        if (startDate && r.tanggal < startDate) return false;
        if (endDate && r.tanggal > endDate) return false;
        return true;
      });
    } else if (periodName || exactYearParam || exactMonthParam || startYear || endYear) {
      const periodMatched = branchScopedAlat.filter(r => {
        const [yr, mo] = r.tanggal.split('-').map(Number);
        if (!yr || !mo) return false;
        return matchesPeriod(yr, mo, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

      if (periodMatched.length > 0) {
        peralatan = periodMatched;
      } else if (periodName && branchScopedAlat.length > 0) {
        // Fallback snapshot terbaru di tahun bersangkutan ketika dataset peralatan mulai tersedia di Q4
        const targetYr = periodName.includes('2025') ? 2025 : 2026;
        const inYear = branchScopedAlat.filter(r => Number(r.tanggal.slice(0, 4)) === targetYr);
        if (inYear.length > 0) {
          const latestSnapshotDate = inYear.map(r => r.tanggal).sort().reverse()[0];
          peralatan = inYear.filter(r => r.tanggal === latestSnapshotDate);
        } else {
          peralatan = [];
        }
      } else {
        peralatan = [];
      }
    } else {
      peralatan = branchScopedAlat;
    }

    // 6. Fasilitas from PostgreSQL module_fasilitas
    const rawFasRows = (
      await query('SELECT * FROM module_fasilitas ORDER BY year DESC, month DESC, branch_code ASC')
    ).rows as any[];

    const fasilitas = rawFasRows
      .map(r => resolveVerificationRow(r, verifiedOnly, counters))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => {
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        const branchName = getBranchNameByCode(code) || r.branch_name;
        return {
          id: r.id,
          monthlyRecordId: r.monthly_record_id,
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
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
        };
      })
      .filter(r => {
        if (!matchesBranch(r.branchCode)) return false;
        return matchesPeriod(r.year, r.month, exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      });

    // 7. Equipment Catalog from PostgreSQL equipment_catalog
    const equipmentCatalog = (
      (await query('SELECT code, name, acronym, category FROM equipment_catalog WHERE active = TRUE ORDER BY code ASC')).rows as any[]
    ).map(r => ({
      code: String(r.code).trim(),
      name: String(r.name).trim(),
      acronym: String(r.acronym || '').trim(),
      category: String(r.category || 'OPERASIONAL').trim(),
    }));

    // 8. Additional KPI Records from PostgreSQL monthly_records (e.g. kpi_rfu, kpi_sla, kpi_csat)
    const rawKpiRecords = (
      await query(`
        SELECT r.id, r.indicator_id, r.year, r.month, r.target, r.realization, r.unit,
               r.achievement_pct, r.verification_status, b.code as branch_code, b.name as branch_name
        FROM monthly_records r
        JOIN branches b ON r.branch_id = b.id
        WHERE r.indicator_id IN ('kpi_rfu', 'kpi_sla', 'kpi_csat')
      `)
    ).rows as any[];

    const kpiRecords = rawKpiRecords
      .filter(r => {
        if (verifiedOnly && r.verification_status !== 'verified') return false;
        const code = getCanonicalBranchCode(r.branch_code, r.branch_name);
        if (!matchesBranch(code)) return false;
        return matchesPeriod(Number(r.year), Number(r.month), exactYearParam, exactMonthParam, startYear, startMonth, endYear, endMonth);
      })
      .map(r => ({
        id: r.id,
        indicatorId: r.indicator_id,
        year: Number(r.year),
        month: Number(r.month),
        branchCode: getCanonicalBranchCode(r.branch_code, r.branch_name),
        branchName: r.branch_name,
        target: Number(r.target),
        realization: Number(r.realization),
        unit: r.unit,
        achievementPct: Number(r.achievement_pct),
        verificationStatus: r.verification_status,
      }));

    return NextResponse.json({
      success: true,
      source: 'postgresql',
      verifiedOnly,
      verificationSummary: {
        verifiedCount: counters.verified,
        pendingCount: counters.pending,
        revisionCount: counters.revision,
      },
      branches: OFFICIAL_BRANCHES,
      finansial,
      opkom,
      kinerja,
      utilisasi,
      peralatan,
      fasilitas,
      equipmentCatalog,
      kpiRecords,
    });
  } catch (error: any) {
    console.error('Error in /api/modules-data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
