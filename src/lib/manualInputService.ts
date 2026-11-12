import fs from 'fs';
import path from 'path';
import os from 'os';
import * as xlsx from 'xlsx';
import { getBranchByCode, getCanonicalBranchCode, getBranchNameByCode } from './constants';
import { getBranchId } from './ingestInputData';
import { withTransaction, dbQueries } from './db';
import {
  averageValidMetric,
  canonicalRekening,
  getFinansialMonthlyRecordId,
  getFinansialRowId,
  getIndicatorIdForRekening,
  parseMetricPercent,
  parseRealisasi,
} from './finansialHelpers';
import {
  normalizeGrupEntitas,
  normalizeKondisi,
  normalizeNullableText,
  normalizeTanggalISO,
  resolvePeralatanBranchCode,
} from './peralatanHelpers';

function serializeSnapshot(val: unknown): string | null {
  if (!val) return null;
  return typeof val === 'string' ? val : JSON.stringify(val);
}

export type ModuleType = 'finansial' | 'opkom' | 'kinerja' | 'utilisasi' | 'peralatan' | 'fasilitas';

export interface ManualInputPayload {
  module: ModuleType;
  user?: {
    id: string;
    name: string;
    role: string;
    nipp?: string;
  };
  data: Record<string, any>;
}

function slugKey(str: string): string {
  return (
    String(str || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'item'
  );
}

export function getInputDataSpreadsheetPath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'input_data.xlsx');
}

export async function saveManualInputRecord(payload: ManualInputPayload): Promise<{
  success: boolean;
  message: string;
  isUpdate: boolean;
  verificationStatus: 'pending_verification';
  recordId: string;
  monthlyRecordId: string | null;
  record: any;
}> {
  const { module, data, user } = payload;
  const nowIso = new Date().toISOString();
  const uploadedBy = user?.nipp || user?.id || 'manual_user';
  const verificationStatus = 'pending_verification' as const;

  // Resolve branch and period
  const rawCode = String(data.kodeCabang || data.KODE_CBG || data.branchCode || 'R01').trim().toUpperCase();
  const rawName = String(data.namaCabang || data.NM_CBG || data.branchName || '').trim();
  const branchCode = getCanonicalBranchCode(rawCode, rawName);
  const branchObj = getBranchByCode(branchCode);
  const branchName = getBranchNameByCode(branchCode) || rawName || (branchObj ? branchObj.name : branchCode);
  const branchId = getBranchId(branchCode, branchName);

  const year = Number(data.tahun ?? data.TAHUN ?? data.year) || new Date().getFullYear();
  const month = Number(data.bulan ?? data.BULAN ?? data.month) || (new Date().getMonth() + 1);

  let isUpdate = false;
  let formattedRecord: any = {};
  let recordId = '';
  let monthlyRecordId: string | null = null;

  await withTransaction(async (client) => {
    const upsertMonthlyRecordSql = `
      INSERT INTO monthly_records (
        id, branch_id, department_id, indicator_id, month, year,
        target, realization, unit, achievement_pct, status_color, notes,
        source_type, batch_id, verification_status, revision_notes,
        uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual_input', $13, 'pending_verification', NULL, $14, $15::timestamptz, NULL, NULL, FALSE)
      ON CONFLICT (id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        department_id = EXCLUDED.department_id,
        indicator_id = EXCLUDED.indicator_id,
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        target = EXCLUDED.target,
        realization = EXCLUDED.realization,
        unit = EXCLUDED.unit,
        achievement_pct = EXCLUDED.achievement_pct,
        status_color = EXCLUDED.status_color,
        notes = EXCLUDED.notes,
        source_type = 'manual_input',
        batch_id = EXCLUDED.batch_id,
        verification_status = 'pending_verification',
        revision_notes = NULL,
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        is_simulated = FALSE
    `;
    const stmtUpsertMonthlyRecord = {
      run: async (...params: any[]) => client.query(upsertMonthlyRecordSql, params),
    };

  if (module === 'finansial') {
    const rekening = canonicalRekening(data.rekening ?? data.REKENING ?? 'Pendapatan');
    const entitas = String(data.entitas ?? data.ENTITAS ?? 'CABANG').trim().toUpperCase();
    const realisasi = parseRealisasi(data.realisasi ?? data.REALISASI ?? 0);
    const rkaNum = realisasi === 0 && String(data.rka ?? data.RKA ?? '').trim() === '-'
      ? null
      : parseMetricPercent(data.rka ?? data.RKA);
    const yoyNum = realisasi === 0 && String(data.yoy ?? data.YOY ?? '').trim() === '-'
      ? null
      : parseMetricPercent(data.yoy ?? data.YOY);

    const indId = getIndicatorIdForRekening(rekening);
    monthlyRecordId = getFinansialMonthlyRecordId(year, month, branchCode, rekening);
    recordId = getFinansialRowId(year, month, branchCode, rekening, entitas);

    const existingRes = await client.query(
      'SELECT * FROM module_finansial WHERE id = $1 OR (year = $2 AND month = $3 AND branch_code = $4 AND LOWER(rekening) = LOWER($5) AND UPPER(entitas) = UPPER($6))',
      [recordId, year, month, branchCode, rekening, entitas]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              entitas: existing.entitas,
              realisasi: existing.realisasi,
              rka: existing.rka,
              yoy: existing.yoy,
            })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_finansial (
        id, monthly_record_id, year, month, branch_code, branch_name, rekening, entitas,
        realisasi, rka, yoy, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_input', 'pending_verification', $12, $13::timestamptz, NULL, NULL, NULL, $14::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        monthly_record_id = EXCLUDED.monthly_record_id,
        branch_name = EXCLUDED.branch_name,
        rekening = EXCLUDED.rekening,
        entitas = EXCLUDED.entitas,
        realisasi = EXCLUDED.realisasi,
        rka = EXCLUDED.rka,
        yoy = EXCLUDED.yoy,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        monthlyRecordId,
        year,
        month,
        branchCode,
        branchName,
        rekening,
        entitas,
        realisasi,
        rkaNum,
        yoyNum,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    // Hitung ulang total konsolidasi (menjumlahkan seluruh entitas termasuk ELIMINASI) untuk monthly_records
    const siblingRes = await client.query(
      'SELECT realisasi, rka FROM module_finansial WHERE year = $1 AND month = $2 AND branch_code = $3 AND LOWER(rekening) = LOWER($4)',
      [year, month, branchCode, rekening]
    );
    const totalConsolidatedRealisasi = siblingRes.rows.reduce(
      (sum: number, row: any) => sum + parseRealisasi(row.realisasi),
      0
    );
    const avgRka = averageValidMetric(
      siblingRes.rows
        .filter((row: any) => parseRealisasi(row.realisasi) !== 0)
        .map((row: any) => row.rka)
    );
    const effectiveRka = avgRka === '-' ? (rkaNum ?? 0) : avgRka;
    const konsolidasiM = Number((totalConsolidatedRealisasi / 1_000_000_000).toFixed(2));
    const targetM = effectiveRka > 0 ? Number((konsolidasiM / (effectiveRka / 100)).toFixed(2)) : konsolidasiM;
    const statusColor =
      avgRka === '-' && rkaNum === null ? 'neutral' : effectiveRka >= 100 ? 'green' : effectiveRka >= 95 ? 'yellow' : 'red';

    await stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_keu',
      indId,
      month,
      year,
      targetM,
      konsolidasiM,
      'Miliar Rp',
      Number(effectiveRka.toFixed(2)),
      statusColor,
      `Input manual finansial (${rekening} - ${entitas}) oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      REKENING: rekening,
      ENTITAS: entitas,
      REALISASI: realisasi,
      RKA: rkaNum === null ? '-' : rkaNum,
      YOY: yoyNum === null ? '-' : yoyNum,
    };
  } else if (module === 'opkom') {
    const layanan = String(data.layanan ?? data.LAYANAN ?? 'KAPAL').trim().toUpperCase();
    const satuan = String(data.satuan ?? data.SATUAN ?? 'Rp').trim();
    const jumlah = Number(data.jumlah ?? data.JUMLAH ?? 0);
    const yoy = Number(data.yoy ?? data.YOY ?? 100);
    const rka = Number(data.rka ?? data.RKA ?? 100);

    let indId = 'kpi_rev';
    if (layanan.includes('PETIKEMAS')) indId = satuan.toUpperCase().includes('TEUS') ? 'kpi_teus' : 'kpi_teus_rev';
    else if (layanan.includes('BARANG')) indId = satuan.toUpperCase().includes('TON') ? 'kpi_cargo' : 'kpi_cargo_rev';
    else if (layanan.includes('KAPAL')) indId = satuan.toUpperCase().includes('CALL') ? 'kpi_call' : 'kpi_ship_rev';
    else if (layanan.includes('PENUMPANG')) indId = 'kpi_pax_rev';
    else if (layanan.includes('RUPA')) indId = 'kpi_misc_rev';

    monthlyRecordId = `rec_opkom_${year}_${month}_${branchCode}_${layanan.replace(/[^a-zA-Z0-9]/g, '_')}_${slugKey(satuan)}`;
    recordId = `mod_opkom_${year}_${month}_${branchCode}_${slugKey(layanan)}_${slugKey(satuan)}`;

    const existingRes = await client.query(
      'SELECT * FROM module_opkom WHERE id = $1 OR (year = $2 AND month = $3 AND branch_code = $4 AND UPPER(layanan) = UPPER($5) AND UPPER(satuan) = UPPER($6))',
      [recordId, year, month, branchCode, layanan, satuan]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              jumlah_rp: existing.jumlah_rp,
              yoy: existing.yoy,
              rka: existing.rka,
            })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_opkom (
        id, monthly_record_id, year, month, branch_code, branch_name, layanan, satuan,
        jumlah_rp, yoy, rka, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_input', 'pending_verification', $12, $13::timestamptz, NULL, NULL, NULL, $14::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        monthly_record_id = EXCLUDED.monthly_record_id,
        branch_name = EXCLUDED.branch_name,
        layanan = EXCLUDED.layanan,
        satuan = EXCLUDED.satuan,
        jumlah_rp = EXCLUDED.jumlah_rp,
        yoy = EXCLUDED.yoy,
        rka = EXCLUDED.rka,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        monthlyRecordId,
        year,
        month,
        branchCode,
        branchName,
        layanan,
        satuan,
        jumlah,
        yoy,
        rka,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    const isRupiah = satuan.toLowerCase() === 'rp';
    const realizationVal = isRupiah ? Number((jumlah / 1_000_000_000).toFixed(2)) : jumlah;
    const targetVal = rka > 0 ? Number((realizationVal / (rka / 100)).toFixed(2)) : realizationVal;
    const statusColor = rka >= 100 ? 'green' : rka >= 95 ? 'yellow' : 'red';

    await stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_ops',
      indId,
      month,
      year,
      targetVal,
      realizationVal,
      isRupiah ? 'Miliar Rp' : satuan,
      Number(rka.toFixed(1)),
      statusColor,
      `Input manual opkom (${layanan} - ${satuan}) oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      LAYANAN: layanan,
      SATUAN: satuan,
      JUMLAH: jumlah,
      YOY: yoy,
      RKA: rka,
      verificationStatus,
    };
  } else if (module === 'kinerja') {
    const kdKine = String(data.kdKine ?? data.KD_KINE ?? 'K01').trim().toUpperCase();
    const nmKine = String(data.namaKinerja ?? data.nmKine ?? data.NM_KINE ?? 'KAPAL').trim().toUpperCase();
    const satuan = String(data.satuan ?? data.SATUAN ?? 'WTP').trim();
    const nilai = Number(data.nilai ?? data.NILAI ?? 0);

    let indId = 'kpi_wtp';
    let target = 1.0;
    let unit = satuan;
    let isHigherBetter = true;

    if (kdKine === 'K01' || satuan === 'WTP') {
      indId = 'kpi_wtp';
      target = 1.0;
      unit = 'Jam';
      isHigherBetter = false;
    } else if (kdKine === 'K08' || satuan === 'BSH') {
      indId = 'kpi_bsh';
      target = 25.0;
      unit = 'Box/Jam';
    } else if (kdKine === 'K09' || satuan === 'BCH') {
      indId = 'kpi_bch';
      target = 20.0;
      unit = 'Box/Jam';
    } else if (kdKine === 'K02') {
      indId = 'kpi_tgh_dry';
      target = 150.0;
      unit = 'Ton/Jam';
    } else if (kdKine === 'K03') {
      indId = 'kpi_tsd_dry';
      target = 2000.0;
      unit = 'Ton/Hari';
    } else if (kdKine === 'K04') {
      indId = 'kpi_tgh_liq';
      target = 120.0;
      unit = 'Ton/Jam';
    } else if (kdKine === 'K05') {
      indId = 'kpi_tsd_liq';
      target = 1800.0;
      unit = 'Ton/Hari';
    } else if (kdKine === 'K06') {
      indId = 'kpi_tgh_gc';
      target = 40.0;
      unit = 'Ton/Jam';
    } else if (kdKine === 'K07') {
      indId = 'kpi_tsd_gc';
      target = 600.0;
      unit = 'Ton/Hari';
    }

    monthlyRecordId = `rec_kine_${year}_${month}_${branchCode}_${indId}`;
    recordId = `mod_kine_${year}_${month}_${branchCode}_${slugKey(kdKine)}_${slugKey(nmKine)}_${slugKey(satuan)}`;

    const existingRes = await client.query(
      'SELECT * FROM module_kinerja WHERE id = $1 OR (year = $2 AND month = $3 AND branch_code = $4 AND UPPER(kd_kine) = UPPER($5) AND UPPER(satuan) = UPPER($6))',
      [recordId, year, month, branchCode, kdKine, satuan]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({ nilai: existing.nilai })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_kinerja (
        id, monthly_record_id, year, month, branch_code, branch_name, kd_kine, nm_kine, satuan,
        nilai, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual_input', 'pending_verification', $11, $12::timestamptz, NULL, NULL, NULL, $13::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        monthly_record_id = EXCLUDED.monthly_record_id,
        branch_name = EXCLUDED.branch_name,
        kd_kine = EXCLUDED.kd_kine,
        nm_kine = EXCLUDED.nm_kine,
        satuan = EXCLUDED.satuan,
        nilai = EXCLUDED.nilai,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        monthlyRecordId,
        year,
        month,
        branchCode,
        branchName,
        kdKine,
        nmKine,
        satuan,
        nilai,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    const achPct = isHigherBetter
      ? Number(((nilai / target) * 100).toFixed(1))
      : Number(((target / Math.max(nilai, 0.01)) * 100).toFixed(1));
    const statusColor = achPct >= 100 ? 'green' : achPct >= 90 ? 'yellow' : 'red';

    await stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_ops',
      indId,
      month,
      year,
      target,
      nilai,
      unit,
      achPct,
      statusColor,
      `Input manual kinerja (${nmKine} - ${satuan}) oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_KINE: kdKine,
      NM_KINE: nmKine,
      SATUAN: satuan,
      NILAI: nilai,
      verificationStatus,
    };
  } else if (module === 'utilisasi') {
    const kdJenderm = String(data.kdJenderm ?? data.KD_JENDERM ?? '1').trim();
    const dermaga = String(data.dermaga ?? data.DERMAGA ?? 'MULTIPURPOSE').trim().toUpperCase();
    const bor = Number(data.bor ?? data.BOR ?? 0);
    const yor = Number(data.yor ?? data.YOR ?? 0);
    const sor = Number(data.sor ?? data.SOR ?? 0);

    monthlyRecordId = `rec_util_${year}_${month}_${branchCode}_bor_${dermaga.replace(/[^a-zA-Z0-9]/g, '_')}`;
    recordId = `mod_util_${year}_${month}_${branchCode}_${slugKey(dermaga)}`;

    const existingRes = await client.query(
      'SELECT * FROM module_utilisasi WHERE id = $1 OR (year = $2 AND month = $3 AND branch_code = $4 AND UPPER(dermaga) = UPPER($5))',
      [recordId, year, month, branchCode, dermaga]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({ bor: existing.bor, yor: existing.yor, sor: existing.sor })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_utilisasi (
        id, monthly_record_id, year, month, branch_code, branch_name, kd_jenderm, dermaga,
        bor, yor, sor, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_input', 'pending_verification', $12, $13::timestamptz, NULL, NULL, NULL, $14::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        monthly_record_id = EXCLUDED.monthly_record_id,
        branch_name = EXCLUDED.branch_name,
        kd_jenderm = EXCLUDED.kd_jenderm,
        dermaga = EXCLUDED.dermaga,
        bor = EXCLUDED.bor,
        yor = EXCLUDED.yor,
        sor = EXCLUDED.sor,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        monthlyRecordId,
        year,
        month,
        branchCode,
        branchName,
        kdJenderm,
        dermaga,
        bor,
        yor,
        sor,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    const borPct = Number(((bor / 60) * 100).toFixed(1));
    const borColor = bor <= 65 ? 'green' : bor <= 75 ? 'yellow' : 'red';
    await stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_ops',
      'kpi_bor',
      month,
      year,
      60.0,
      bor,
      '%',
      borPct,
      borColor,
      `Input manual utilisasi dermaga (${dermaga}) oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_JENDERM: kdJenderm,
      DERMAGA: dermaga,
      BOR: bor,
      YOR: yor,
      SOR: sor,
      verificationStatus,
    };
  } else if (module === 'peralatan') {
    const tanggal =
      normalizeTanggalISO(data.tanggal) ||
      `${year}-${String(month).padStart(2, '0')}-01`;
    const grupEntitas = normalizeGrupEntitas(data.grup_entitas ?? data.grupEntitas ?? 'R4') || 'R4';
    const namaCabang = String(data.nama_cabang ?? data.namaCabang ?? branchName).trim() || branchName;
    const namaAlat = String(data.nama_alat ?? data.namaAlat ?? data.NM_ALAT ?? 'Unit Peralatan').trim();
    const jenisAlat = String(data.jenis_alat ?? data.jenisAlat ?? data.JNS_ALAT ?? 'Chassis').trim();
    const kategoriAlat = String(data.kategori_alat ?? data.kategoriAlat ?? 'Alat CY').trim() || 'Alat CY';
    const kondisi = normalizeKondisi(data.kondisi ?? 'READY');
    const kerusakan = normalizeNullableText(data.kerusakan);
    const tindakLanjut = normalizeNullableText(data.tindak_lanjut ?? data.tindakLanjut);

    const [tYrStr, tMoStr] = tanggal.split('-');
    const recYear = Number(tYrStr) || year;
    const recMonth = Number(tMoStr) || month;
    const resolvedBranchCode = resolvePeralatanBranchCode(namaCabang, branchCode);
    const resolvedBranchId = getBranchId(resolvedBranchCode, namaCabang);

    monthlyRecordId = `rec_alat_rfu_${recYear}_${recMonth}_${resolvedBranchCode}`;
    recordId = `mod_alat_${tanggal}_${slugKey(resolvedBranchCode)}_${slugKey(grupEntitas)}_${slugKey(namaAlat)}`;

    const existingRes = await client.query(
      `SELECT * FROM module_peralatan
       WHERE id = $1
          OR (tanggal = $2::date AND UPPER(grup_entitas) = UPPER($3) AND LOWER(nama_cabang) = LOWER($4) AND LOWER(nama_alat) = LOWER($5))`,
      [recordId, tanggal, grupEntitas, namaCabang, namaAlat]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              kondisi: existing.kondisi,
              kerusakan: existing.kerusakan,
              tindak_lanjut: existing.tindak_lanjut,
            })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_peralatan (
        id, monthly_record_id, branch_code, tanggal, grup_entitas, nama_cabang,
        nama_alat, jenis_alat, kategori_alat, kondisi, kerusakan, tindak_lanjut,
        source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (
        $1, $2, $3, $4::date, $5, $6,
        $7, $8, $9, $10, $11, $12,
        'manual_input', 'pending_verification', $13, $14::timestamptz,
        NULL, NULL, NULL, $15::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        monthly_record_id = EXCLUDED.monthly_record_id,
        branch_code = EXCLUDED.branch_code,
        tanggal = EXCLUDED.tanggal,
        grup_entitas = EXCLUDED.grup_entitas,
        nama_cabang = EXCLUDED.nama_cabang,
        nama_alat = EXCLUDED.nama_alat,
        jenis_alat = EXCLUDED.jenis_alat,
        kategori_alat = EXCLUDED.kategori_alat,
        kondisi = EXCLUDED.kondisi,
        kerusakan = EXCLUDED.kerusakan,
        tindak_lanjut = EXCLUDED.tindak_lanjut,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        monthlyRecordId,
        resolvedBranchCode,
        tanggal,
        grupEntitas,
        namaCabang,
        namaAlat,
        jenisAlat,
        kategoriAlat,
        kondisi,
        kerusakan,
        tindakLanjut,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    // Hitung ulang RFU snapshot bulan terkait untuk monthly_records (dept_tek)
    const aggRes = await client.query<{ total: number; ready: number }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE kondisi IN ('READY', 'READY DENGAN CATATAN'))::int AS ready
       FROM module_peralatan
       WHERE branch_code = $1 AND tanggal = $2::date`,
      [resolvedBranchCode, tanggal]
    );
    const totalUnit = Number(aggRes.rows[0]?.total ?? 1);
    const readyUnit = Number(aggRes.rows[0]?.ready ?? (kondisi === 'READY' || kondisi === 'READY DENGAN CATATAN' ? 1 : 0));
    const rfuPct = totalUnit > 0 ? Number(((readyUnit / totalUnit) * 100).toFixed(1)) : 0;
    const rfuAch = Number(((rfuPct / 90.0) * 100).toFixed(1));
    const statusColor = rfuPct >= 90 ? 'green' : rfuPct >= 80 ? 'yellow' : 'red';

    await stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      resolvedBranchId,
      'dept_tek',
      'kpi_rfu',
      recMonth,
      recYear,
      90.0,
      rfuPct,
      '%',
      rfuAch,
      statusColor,
      `Input manual peralatan (${namaAlat} - ${kondisi}) tanggal ${tanggal} oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      Tanggal: tanggal,
      'Grup / Entitas': grupEntitas,
      'Nama Cabang': namaCabang,
      'Nama Alat': namaAlat,
      'Jenis Alat': jenisAlat,
      'Kategori Alat': kategoriAlat,
      Kondisi: kondisi,
      Kerusakan: kerusakan || '-',
      'Tindak Lanjut': tindakLanjut || '-',
      verificationStatus,
    };
  } else if (module === 'fasilitas') {
    const nmPasfel = String(data.namaFasilitas || data.nm_pasfel || 'Dermaga').trim();
    const jnsFaspel = String(data.jenisFasilitas || data.jns_faspel || 'Dermaga').trim();
    const satuan = String(data.satuan || 'meter').trim();
    const panjang = Number(data.panjang || data.panjangM || 0);
    const lebar = Number(data.lebar || data.lebarM || 0);
    const mLws = Number(data.mLws || 0);
    const nilai = Number(data.nilai || data.luas || data.luasSqm || (panjang * lebar));
    const ket = String(data.keterangan || data.ket || '').trim();

    recordId = `mod_fas_${year}_${month}_${branchCode}_${slugKey(nmPasfel)}_${slugKey(jnsFaspel)}`;

    const existingRes = await client.query(
      'SELECT * FROM module_fasilitas WHERE id = $1 OR (year = $2 AND month = $3 AND branch_code = $4 AND LOWER(nama_fasilitas) = LOWER($5))',
      [recordId, year, month, branchCode, nmPasfel]
    );
    const existing = existingRes.rows[0];

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              panjang_m: existing.panjang_m,
              lebar_m: existing.lebar_m,
              mlws: existing.mlws,
              luas_sqm: existing.luas_sqm,
              kapasitas: existing.kapasitas,
              keterangan: existing.keterangan,
            })
          : serializeSnapshot(existing.verified_snapshot_json);
    }

    await client.query(
      `INSERT INTO module_fasilitas (
        id, monthly_record_id, year, month, branch_code, branch_name, nama_fasilitas, jenis_fasilitas, satuan,
        panjang_m, lebar_m, mlws, luas_sqm, kapasitas, keterangan,
        source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, $13, 'manual_input', 'pending_verification', $14, $15::timestamptz, NULL, NULL, NULL, $16::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        branch_name = EXCLUDED.branch_name,
        nama_fasilitas = EXCLUDED.nama_fasilitas,
        jenis_fasilitas = EXCLUDED.jenis_fasilitas,
        satuan = EXCLUDED.satuan,
        panjang_m = EXCLUDED.panjang_m,
        lebar_m = EXCLUDED.lebar_m,
        mlws = EXCLUDED.mlws,
        luas_sqm = EXCLUDED.luas_sqm,
        keterangan = EXCLUDED.keterangan,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = EXCLUDED.uploaded_by,
        uploaded_at = EXCLUDED.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
      [
        recordId,
        year,
        month,
        branchCode,
        branchName,
        nmPasfel,
        jnsFaspel,
        satuan,
        panjang,
        lebar,
        mLws,
        nilai,
        ket,
        uploadedBy,
        nowIso,
        snapshotJson,
      ]
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      nm_pasfel: nmPasfel,
      jns_faspel: jnsFaspel,
      satuan,
      panjang,
      lebar,
      mLws,
      nilai,
      ket,
      verificationStatus,
    };
  }
  });

  // Keep local spreadsheet export in sync without re-running full ingestInputData
  try {
    const upsertSheetRow = (rowsList: any[], record: any, isFin: boolean): any[] => {
      if (!isFin) {
        return [...rowsList, record];
      }
      const idx = rowsList.findIndex(
        r =>
          Number(r.TAHUN) === Number(record.TAHUN) &&
          Number(r.BULAN) === Number(record.BULAN) &&
          String(r.KODE_CBG || '').trim().toUpperCase() === String(record.KODE_CBG).trim().toUpperCase() &&
          String(r.REKENING || '').trim().toLowerCase() === String(record.REKENING).trim().toLowerCase() &&
          String(r.ENTITAS || '').trim().toUpperCase() === String(record.ENTITAS).trim().toUpperCase()
      );
      const next = [...rowsList];
      if (idx >= 0) next[idx] = record;
      else next.push(record);
      return next;
    };

    const excelPath = getInputDataSpreadsheetPath();
    if (fs.existsSync(excelPath)) {
      const fileBuffer = fs.readFileSync(excelPath);
      const wb = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = module === 'fasilitas' && wb.Sheets['fasilitas (2)'] ? 'fasilitas (2)' : module;
      let ws = wb.Sheets[sheetName];
      if (!ws) {
        ws = xlsx.utils.json_to_sheet([]);
        xlsx.utils.book_append_sheet(wb, ws, sheetName);
      }
      const existingRows: any[] = xlsx.utils.sheet_to_json(ws, { defval: '' });
      const updatedRows = upsertSheetRow(existingRows, formattedRecord, module === 'finansial');
      wb.Sheets[sheetName] = xlsx.utils.json_to_sheet(updatedRows);
      const updatedBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(excelPath, updatedBuf);

      const downloadsPath = path.join(os.homedir(), 'Downloads', 'input_data.xlsx');
      if (fs.existsSync(downloadsPath)) {
        fs.writeFileSync(downloadsPath, updatedBuf);
      }
    }

    if (module === 'finansial') {
      const labarugiPath = path.join(path.dirname(excelPath), 'labarugi.xlsx');
      if (fs.existsSync(labarugiPath)) {
        const lbWb = xlsx.read(fs.readFileSync(labarugiPath), { type: 'buffer' });
        const lbSheetName = lbWb.Sheets['labarugi'] ? 'labarugi' : lbWb.SheetNames[0];
        const lbExisting: any[] = xlsx.utils.sheet_to_json(lbWb.Sheets[lbSheetName], { defval: '' });
        const lbClean = lbExisting.map(r => ({
          TAHUN: Number(r.TAHUN),
          BULAN: Number(r.BULAN),
          KODE_CBG: String(r.KODE_CBG || '').trim(),
          NM_CBG: String(r.NM_CBG || '').trim(),
          REKENING: String(r.REKENING || '').trim(),
          ENTITAS: String(r.ENTITAS || '').trim(),
          REALISASI: parseRealisasi(r[' REALISASI '] ?? r.REALISASI),
          RKA: String(r[' RKA '] ?? r.RKA ?? '-').trim() === '-' ? '-' : parseMetricPercent(r[' RKA '] ?? r.RKA) ?? '-',
          YOY: String(r[' YOY '] ?? r.YOY ?? '-').trim() === '-' ? '-' : parseMetricPercent(r[' YOY '] ?? r.YOY) ?? '-',
        }));
        const lbUpdated = upsertSheetRow(lbClean, formattedRecord, true);
        lbWb.Sheets[lbSheetName] = xlsx.utils.json_to_sheet(lbUpdated);
        fs.writeFileSync(labarugiPath, xlsx.write(lbWb, { type: 'buffer', bookType: 'xlsx' }));
      }
    } else if (module === 'peralatan') {
      const alatXlsxPath = path.join(path.dirname(excelPath), 'peralatan.xlsx');
      if (fs.existsSync(alatXlsxPath)) {
        const alatWb = xlsx.read(fs.readFileSync(alatXlsxPath), { type: 'buffer' });
        const alatSheetName =
          alatWb.SheetNames.find(s => ['alat', 'peralatan'].includes(s.toLowerCase())) || alatWb.SheetNames[0];
        const rawMatrix = xlsx.utils.sheet_to_json(alatWb.Sheets[alatSheetName], {
          header: 1,
          defval: '',
        }) as any[][];
        const headers = [
          'Tanggal',
          'Grup / Entitas',
          'Nama Cabang',
          'Nama Alat',
          'Jenis Alat',
          'Kategori Alat',
          'Kondisi',
          'Kerusakan',
          'Tindak Lanjut',
        ];
        const newRow = [
          formattedRecord.Tanggal,
          formattedRecord['Grup / Entitas'],
          formattedRecord['Nama Cabang'],
          formattedRecord['Nama Alat'],
          formattedRecord['Jenis Alat'],
          formattedRecord['Kategori Alat'],
          formattedRecord.Kondisi,
          formattedRecord.Kerusakan,
          formattedRecord['Tindak Lanjut'],
        ];
        const dataMatrix = rawMatrix.length > 0 ? rawMatrix : [headers];
        const rowIdx = dataMatrix.findIndex(
          r =>
            Array.isArray(r) &&
            normalizeTanggalISO(r[0]) === formattedRecord.Tanggal &&
            String(r[1] || '').trim().toUpperCase() === formattedRecord['Grup / Entitas'] &&
            String(r[2] || '').trim().toLowerCase() === String(formattedRecord['Nama Cabang']).toLowerCase() &&
            String(r[3] || '').trim().toLowerCase() === String(formattedRecord['Nama Alat']).toLowerCase()
        );
        if (rowIdx >= 0) {
          dataMatrix[rowIdx] = newRow;
        } else {
          dataMatrix.push(newRow);
        }
        alatWb.Sheets[alatSheetName] = xlsx.utils.aoa_to_sheet(dataMatrix);
        fs.writeFileSync(alatXlsxPath, xlsx.write(alatWb, { type: 'buffer', bookType: 'xlsx' }));
      }
    }
  } catch (err) {
    console.warn('[ManualInput] Non-fatal spreadsheet export warning:', err);
  }

  // Audit log
  try {
    await dbQueries.createAuditLog({
      user_id: user?.id || 'manual_user',
      user_name: user?.name || 'PIC Input Manual',
      user_role: (user?.role as any) || 'pic_cabang',
      action: isUpdate ? 'UPDATE_MANUAL_DATA' : 'CREATE_MANUAL_DATA',
      entity: `module_${module}`,
      entity_id: monthlyRecordId || recordId,
      details: `Input manual modul ${module} untuk ${branchName} (${branchCode}), periode ${month}/${year}. Status awal: Menunggu Verifikasi (pending_verification).`,
    });
  } catch (err) {
    console.warn('[ManualInput] Audit log warning:', err);
  }

  return {
    success: true,
    isUpdate,
    verificationStatus,
    recordId,
    monthlyRecordId,
    message: isUpdate
      ? `Data ${module.toUpperCase()} untuk ${branchName} (${month}/${year}) telah diperbarui dan berstatus Menunggu Verifikasi.`
      : `Data ${module.toUpperCase()} baru untuk ${branchName} (${month}/${year}) telah disimpan dan berstatus Menunggu Verifikasi.`,
    record: formattedRecord,
  };
}
