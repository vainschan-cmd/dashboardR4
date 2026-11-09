import fs from 'fs';
import path from 'path';
import os from 'os';
import * as xlsx from 'xlsx';
import { getBranchByCode, getCanonicalBranchCode, getBranchNameByCode } from './constants';
import { getBranchId } from './ingestInputData';
import { getDb, dbQueries } from './db';

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

export function saveManualInputRecord(payload: ManualInputPayload): {
  success: boolean;
  message: string;
  isUpdate: boolean;
  verificationStatus: 'pending_verification';
  recordId: string;
  monthlyRecordId: string | null;
  record: any;
} {
  const { module, data, user } = payload;
  const db = getDb();
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

  const stmtUpsertMonthlyRecord = db.prepare(`
    INSERT INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', ?, 'pending_verification', NULL, ?, ?, NULL, NULL, 0)
    ON CONFLICT(id) DO UPDATE SET
      branch_id = excluded.branch_id,
      department_id = excluded.department_id,
      indicator_id = excluded.indicator_id,
      month = excluded.month,
      year = excluded.year,
      target = excluded.target,
      realization = excluded.realization,
      unit = excluded.unit,
      achievement_pct = excluded.achievement_pct,
      status_color = excluded.status_color,
      notes = excluded.notes,
      source_type = 'manual_input',
      batch_id = excluded.batch_id,
      verification_status = 'pending_verification',
      revision_notes = NULL,
      uploaded_by = excluded.uploaded_by,
      uploaded_at = excluded.uploaded_at,
      verified_by = NULL,
      verified_at = NULL,
      is_simulated = 0
  `);

  if (module === 'finansial') {
    const rekening = String(data.rekening ?? data.REKENING ?? 'Pendapatan').trim();
    const cabang = Number(data.cabang ?? data.CABANG ?? 0);
    const pmt = Number(data.pmt ?? data.PMT ?? 0);
    const ptp = Number(data.ptp ?? data.PTP ?? 0);
    const psl = Number(data.psl ?? data.PSL ?? 0);
    const pjm = Number(data.pjm ?? data.PJM ?? 0);
    const eliminasi = Number(data.eliminasi ?? data.ELIMINASI ?? 0);
    const konsolidasiVal = data.konsolidasi ?? data.KONSOLIDASI;
    const konsolidasi =
      konsolidasiVal !== undefined && konsolidasiVal !== null && konsolidasiVal !== ''
        ? Number(konsolidasiVal)
        : cabang + pmt + ptp + psl + pjm + eliminasi;
    const yoy = Number(data.yoy ?? data.YOY ?? 100);
    const rka = Number(data.rka ?? data.RKA ?? 100);

    const rekLower = rekening.toLowerCase();
    let indId = 'kpi_rev';
    if (rekLower.includes('beban')) indId = 'kpi_cost';
    else if (rekLower.includes('bersih')) indId = 'kpi_net_profit';
    else if (rekLower.includes('laba')) indId = 'kpi_profit';

    monthlyRecordId = `rec_fin_${year}_${month}_${branchCode}_${indId}`;
    recordId = `mod_fin_${year}_${month}_${branchCode}_${slugKey(rekening)}`;

    const existing = db
      .prepare('SELECT * FROM module_finansial WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND LOWER(rekening) = LOWER(?))')
      .get(recordId, year, month, branchCode, rekening) as any;

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              cabang_rp: existing.cabang_rp,
              pmt_rp: existing.pmt_rp,
              ptp_rp: existing.ptp_rp,
              psl_rp: existing.psl_rp,
              pjm_rp: existing.pjm_rp,
              eliminasi_rp: existing.eliminasi_rp,
              konsolidasi_rp: existing.konsolidasi_rp,
              yoy: existing.yoy,
              rka: existing.rka,
            })
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_finansial (
        id, monthly_record_id, year, month, branch_code, branch_name, rekening,
        cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp,
        yoy, rka, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        rekening = excluded.rekening,
        cabang_rp = excluded.cabang_rp,
        pmt_rp = excluded.pmt_rp,
        ptp_rp = excluded.ptp_rp,
        psl_rp = excluded.psl_rp,
        pjm_rp = excluded.pjm_rp,
        eliminasi_rp = excluded.eliminasi_rp,
        konsolidasi_rp = excluded.konsolidasi_rp,
        yoy = excluded.yoy,
        rka = excluded.rka,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
      recordId,
      monthlyRecordId,
      year,
      month,
      branchCode,
      branchName,
      rekening,
      cabang,
      pmt,
      ptp,
      psl,
      pjm,
      eliminasi,
      konsolidasi,
      yoy,
      rka,
      uploadedBy,
      nowIso,
      snapshotJson
    );

    const konsolidasiM = Number((konsolidasi / 1_000_000_000).toFixed(2));
    const targetM = rka > 0 ? Number((konsolidasiM / (rka / 100)).toFixed(2)) : konsolidasiM;
    const statusColor = rka >= 100 ? 'green' : rka >= 95 ? 'yellow' : 'red';

    stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_keu',
      indId,
      month,
      year,
      targetM,
      konsolidasiM,
      'Miliar Rp',
      Number(rka.toFixed(1)),
      statusColor,
      `Input manual finansial (${rekening}) oleh ${user?.name || uploadedBy}`,
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
      CABANG: cabang,
      PMT: pmt,
      PTP: ptp,
      PSL: psl,
      PJM: pjm,
      ELIMINASI: eliminasi,
      KONSOLIDASI: konsolidasi,
      YOY: yoy,
      RKA: rka,
      verificationStatus,
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

    const existing = db
      .prepare('SELECT * FROM module_opkom WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND UPPER(layanan) = UPPER(?) AND UPPER(satuan) = UPPER(?))')
      .get(recordId, year, month, branchCode, layanan, satuan) as any;

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
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_opkom (
        id, monthly_record_id, year, month, branch_code, branch_name, layanan, satuan,
        jumlah_rp, yoy, rka, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        layanan = excluded.layanan,
        satuan = excluded.satuan,
        jumlah_rp = excluded.jumlah_rp,
        yoy = excluded.yoy,
        rka = excluded.rka,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
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
      snapshotJson
    );

    const isRupiah = satuan.toLowerCase() === 'rp';
    const realizationVal = isRupiah ? Number((jumlah / 1_000_000_000).toFixed(2)) : jumlah;
    const targetVal = rka > 0 ? Number((realizationVal / (rka / 100)).toFixed(2)) : realizationVal;
    const statusColor = rka >= 100 ? 'green' : rka >= 95 ? 'yellow' : 'red';

    stmtUpsertMonthlyRecord.run(
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

    const existing = db
      .prepare('SELECT * FROM module_kinerja WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND UPPER(kd_kine) = UPPER(?) AND UPPER(satuan) = UPPER(?))')
      .get(recordId, year, month, branchCode, kdKine, satuan) as any;

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({ nilai: existing.nilai })
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_kinerja (
        id, monthly_record_id, year, month, branch_code, branch_name, kd_kine, nm_kine, satuan,
        nilai, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        kd_kine = excluded.kd_kine,
        nm_kine = excluded.nm_kine,
        satuan = excluded.satuan,
        nilai = excluded.nilai,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
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
      snapshotJson
    );

    const achPct = isHigherBetter
      ? Number(((nilai / target) * 100).toFixed(1))
      : Number(((target / Math.max(nilai, 0.01)) * 100).toFixed(1));
    const statusColor = achPct >= 100 ? 'green' : achPct >= 90 ? 'yellow' : 'red';

    stmtUpsertMonthlyRecord.run(
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

    const existing = db
      .prepare('SELECT * FROM module_utilisasi WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND UPPER(dermaga) = UPPER(?))')
      .get(recordId, year, month, branchCode, dermaga) as any;

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({ bor: existing.bor, yor: existing.yor, sor: existing.sor })
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_utilisasi (
        id, monthly_record_id, year, month, branch_code, branch_name, kd_jenderm, dermaga,
        bor, yor, sor, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        kd_jenderm = excluded.kd_jenderm,
        dermaga = excluded.dermaga,
        bor = excluded.bor,
        yor = excluded.yor,
        sor = excluded.sor,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
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
      snapshotJson
    );

    const borPct = Number(((bor / 60) * 100).toFixed(1));
    const borColor = bor <= 65 ? 'green' : bor <= 75 ? 'yellow' : 'red';
    stmtUpsertMonthlyRecord.run(
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
    const kdAlat = String(data.kdAlat ?? data.KD_ALAT ?? 'AL01').trim().toUpperCase();
    const nmAlat = String(data.namaAlat ?? data.nmAlat ?? data.NM_ALAT ?? 'Quay Container Crane').trim();
    const singkatan = String(data.singkatan ?? data.SINGKATAN_ALAT ?? 'QCC').trim().toUpperCase();
    const jnsAlat = String(data.jenisAlat ?? data.jnsAlat ?? data.JNS_ALAT ?? 'OPERASI KAPAL').trim().toUpperCase();
    const jumlah = Number(data.jumlah ?? data.JUMLAH ?? 0);
    const availability = Number(data.availability ?? data.AVAILABILITY ?? 0);
    const utilisasi = Number(data.utilisasi ?? data.UTILISASI ?? 0);

    monthlyRecordId = `rec_alat_qty_${year}_${month}_${branchCode}_${singkatan || slugKey(kdAlat || nmAlat)}`;
    recordId = `mod_alat_${year}_${month}_${branchCode}_${slugKey(kdAlat || singkatan || nmAlat)}`;

    const existing = db
      .prepare('SELECT * FROM module_peralatan WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND (UPPER(kd_alat) = UPPER(?) OR LOWER(nm_alat) = LOWER(?)))')
      .get(recordId, year, month, branchCode, kdAlat, nmAlat) as any;

    let snapshotJson: string | null = null;
    if (existing) {
      isUpdate = true;
      recordId = existing.id;
      snapshotJson =
        existing.verification_status === 'verified'
          ? JSON.stringify({
              jumlah: existing.jumlah,
              availability: existing.availability,
              utilisasi: existing.utilisasi,
            })
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_peralatan (
        id, monthly_record_id, year, month, branch_code, branch_name, kd_alat, nm_alat, singkatan, jns_alat,
        jumlah, availability, utilisasi, source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        kd_alat = excluded.kd_alat,
        nm_alat = excluded.nm_alat,
        singkatan = excluded.singkatan,
        jns_alat = excluded.jns_alat,
        jumlah = excluded.jumlah,
        availability = excluded.availability,
        utilisasi = excluded.utilisasi,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
      recordId,
      monthlyRecordId,
      year,
      month,
      branchCode,
      branchName,
      kdAlat,
      nmAlat,
      singkatan,
      jnsAlat,
      jumlah,
      availability,
      utilisasi,
      uploadedBy,
      nowIso,
      snapshotJson
    );

    stmtUpsertMonthlyRecord.run(
      monthlyRecordId,
      branchId,
      'dept_tek',
      'kpi_alat_qty',
      month,
      year,
      Math.max(jumlah, 1),
      jumlah,
      'Unit',
      100.0,
      'green',
      `Input manual peralatan (${nmAlat} - ${singkatan}) oleh ${user?.name || uploadedBy}`,
      `batch_manual_${Date.now()}`,
      uploadedBy,
      nowIso
    );

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_ALAT: kdAlat,
      NM_ALAT: nmAlat,
      SINGKATAN_ALAT: singkatan,
      JNS_ALAT: jnsAlat,
      JUMLAH: jumlah,
      AVAILABILITY: availability,
      UTILISASI: utilisasi,
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

    const existing = db
      .prepare('SELECT * FROM module_fasilitas WHERE id = ? OR (year = ? AND month = ? AND branch_code = ? AND LOWER(nama_fasilitas) = LOWER(?))')
      .get(recordId, year, month, branchCode, nmPasfel) as any;

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
          : existing.verified_snapshot_json || null;
    }

    db.prepare(`
      INSERT INTO module_fasilitas (
        id, monthly_record_id, year, month, branch_code, branch_name, nama_fasilitas, jenis_fasilitas, satuan,
        panjang_m, lebar_m, mlws, luas_sqm, kapasitas, keterangan,
        source_type, verification_status, uploaded_by, uploaded_at,
        verified_by, verified_at, revision_notes, verified_snapshot_json
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'manual_input', 'pending_verification', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        branch_name = excluded.branch_name,
        nama_fasilitas = excluded.nama_fasilitas,
        jenis_fasilitas = excluded.jenis_fasilitas,
        satuan = excluded.satuan,
        panjang_m = excluded.panjang_m,
        lebar_m = excluded.lebar_m,
        mlws = excluded.mlws,
        luas_sqm = excluded.luas_sqm,
        keterangan = excluded.keterangan,
        source_type = 'manual_input',
        verification_status = 'pending_verification',
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        verified_by = NULL,
        verified_at = NULL,
        revision_notes = NULL,
        verified_snapshot_json = excluded.verified_snapshot_json
    `).run(
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
      snapshotJson
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

  // Keep local spreadsheet export in sync without re-running full ingestInputData
  try {
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
      const existingRows: any[] = xlsx.utils.sheet_to_json(ws);
      existingRows.push(formattedRecord);
      wb.Sheets[sheetName] = xlsx.utils.json_to_sheet(existingRows);
      const updatedBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(excelPath, updatedBuf);

      const downloadsPath = path.join(os.homedir(), 'Downloads', 'input_data.xlsx');
      if (fs.existsSync(downloadsPath)) {
        fs.writeFileSync(downloadsPath, updatedBuf);
      }
    }
  } catch (err) {
    console.warn('[ManualInput] Non-fatal spreadsheet export warning:', err);
  }

  // Audit log
  try {
    dbQueries.createAuditLog({
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
