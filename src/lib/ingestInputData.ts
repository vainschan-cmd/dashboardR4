import { getDb, withTransaction } from './db';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { OFFICIAL_BRANCHES, getCanonicalBranchCode, getBranchNameByCode } from './constants';

const MAX_SPREADSHEET_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB batas keamanan unggahan spreadsheet

export const BRANCH_CODE_TO_ID: Record<string, string> = {
  'R01': 'term_makassar',
  'R02': 'term_tpk_makassar',
  'R03': 'term_samarinda',
  'R04': 'term_balikpapan',
  'R05': 'term_bitung',
  'R06': 'term_tpk_bitung',
  'R07': 'term_ambon',
  'R08': 'term_sorong',
  'R09': 'term_jayapura',
  'R10': 'term_tarakan',
  'R11': 'term_pantoloan',
  'R12': 'term_ternate',
  'R13': 'term_kendari',
  'R14': 'term_parepare',
  'R15': 'term_biak',
  'R16': 'term_merauke',
  'R17': 'term_manokwari',
  'R18': 'term_nunukan',
  'R19': 'term_tg_redeb',
  'R20': 'term_gorontalo',
  'R21': 'term_fakfak',
  'R22': 'term_tolitoli',
  'R23': 'term_manado',
  'R24': 'term_makassar_new_port',
  'R25': 'term_bontang',
  'R26': 'term_kkt',
  'R80': 'term_luwuk_tangkiang',
  'R99': 'term_regional_4',
  'TRM-NMK': 'term_new_makassar'
};

export function getBranchId(code: string, name?: string): string {
  const canonicalCode = getCanonicalBranchCode(code, name);
  if (BRANCH_CODE_TO_ID[canonicalCode]) {
    return BRANCH_CODE_TO_ID[canonicalCode];
  }
  const cleanCode = (code || '').trim().toUpperCase();
  if (BRANCH_CODE_TO_ID[cleanCode]) {
    return BRANCH_CODE_TO_ID[cleanCode];
  }
  if (name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `term_${slug}`;
  }
  return `term_${cleanCode.toLowerCase()}`;
}

export function getField(row: Record<string, unknown> | undefined | null, name: string): unknown {
  if (!row) return undefined;
  const target = name.trim().toLowerCase();
  let fallbackVal: unknown = undefined;
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === target) {
      const val = row[k];
      if (val !== undefined && val !== null && val !== '' && val !== 0 && val !== '0') {
        return val;
      }
      if (fallbackVal === undefined) {
        fallbackVal = val;
      }
    }
  }
  return fallbackVal;
}

function slugKey(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'item';
}

export function ingestInputData(filePath?: string) {
  const excelPath = filePath || path.join(process.cwd(), 'data', 'input_data.xlsx');

  if (!fs.existsSync(excelPath)) {
    throw new Error(`File input_data.xlsx tidak ditemukan di path: ${excelPath}`);
  }

  const stat = fs.statSync(excelPath);
  if (stat.size > MAX_SPREADSHEET_SIZE_BYTES) {
    throw new Error(
      `Ukuran file spreadsheet (${(stat.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB.`
    );
  }

  const db = getDb();
  console.log(`[Ingest] Membaca file spreadsheet lokal: ${excelPath}`);
  const fileBuffer = fs.readFileSync(excelPath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  return withTransaction(db, () => {
    // 0. Pastikan Semua KPI Indicators Terdaftar (mencegah foreign key error)
    console.log('[Ingest] 0. Sinkronisasi KPI Indicators & Taksonomi Indikator...');
  const allIndicators = [
    { id: 'kpi_teus', code: 'OPS-TEUS', name: 'Arus Petikemas', department_id: 'dept_ops', category: 'Kargo', unit: 'TEUs', direction: 'higher_is_better', default_target: 1026000, is_core: 1 },
    { id: 'kpi_cargo', code: 'OPS-CARGO', name: 'Arus Barang', department_id: 'dept_ops', category: 'Kargo', unit: 'Ton', direction: 'higher_is_better', default_target: 8300000, is_core: 1 },
    { id: 'kpi_call', code: 'OPS-CALL', name: 'Kunjungan Kapal', department_id: 'dept_ops', category: 'Trafik', unit: 'Call', direction: 'higher_is_better', default_target: 1800, is_core: 1 },
    { id: 'kpi_rev', code: 'KEU-REV', name: 'Pendapatan Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 2010.0, is_core: 1 },
    { id: 'kpi_cost', code: 'KEU-COST', name: 'Beban Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'lower_is_better', default_target: 1425.0, is_core: 1 },
    { id: 'kpi_profit', code: 'KEU-OP', name: 'Laba Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 585.0, is_core: 1 },
    { id: 'kpi_net_profit', code: 'KEU-NET', name: 'Laba Bersih', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 450.0, is_core: 1 },
    { id: 'kpi_rfu', code: 'TEK-RFU', name: 'Kesiapan Alat (RFU)', department_id: 'dept_tek', category: 'Keandalan', unit: '%', direction: 'higher_is_better', default_target: 92.0, is_core: 1 },
    { id: 'kpi_util_alat', code: 'TEK-UTIL', name: 'Utilisasi Alat', department_id: 'dept_tek', category: 'Peralatan', unit: '%', direction: 'higher_is_better', default_target: 65.0, is_core: 0 },
    { id: 'kpi_alat_qty', code: 'TEK-QTY', name: 'Populasi Alat Operasional', department_id: 'dept_tek', category: 'Peralatan', unit: 'Unit', direction: 'higher_is_better', default_target: 5.0, is_core: 0 },
    { id: 'kpi_csat', code: 'PEL-CSAT', name: 'Indeks Kepuasan (CSAT)', department_id: 'dept_pel', category: 'Layanan', unit: 'Skor 1-5', direction: 'higher_is_better', default_target: 4.0, is_core: 1 },
    { id: 'kpi_sla', code: 'PEL-SLA', name: 'SLA Keluhan', department_id: 'dept_pel', category: 'Layanan', unit: '%', direction: 'higher_is_better', default_target: 90.0, is_core: 1 },
    { id: 'kpi_fatality', code: 'HSSE-FAT', name: 'Fatality', department_id: 'dept_hsse', category: 'K3', unit: 'Kasus', direction: 'lower_is_better', default_target: 0, is_core: 1 },
    { id: 'kpi_lti', code: 'HSSE-LTI', name: 'Lost Time Injury', department_id: 'dept_hsse', category: 'K3', unit: 'Kasus', direction: 'lower_is_better', default_target: 0, is_core: 1 },
    { id: 'kpi_bor', code: 'OPS-BOR', name: 'Berth Occupancy Ratio (BOR)', department_id: 'dept_ops', category: 'Fasilitas', unit: '%', direction: 'lower_is_better', default_target: 60.0, is_core: 1 },
    { id: 'kpi_yor', code: 'OPS-YOR', name: 'Yard Occupancy Ratio (YOR)', department_id: 'dept_ops', category: 'Fasilitas', unit: '%', direction: 'lower_is_better', default_target: 60.0, is_core: 1 },
    { id: 'kpi_sor', code: 'OPS-SOR', name: 'Storage Occupancy Ratio (SOR)', department_id: 'dept_ops', category: 'Fasilitas', unit: '%', direction: 'lower_is_better', default_target: 60.0, is_core: 0 },
    { id: 'kpi_ship_rev', code: 'OPS-SHIP-REV', name: 'Pendapatan Layanan Kapal', department_id: 'dept_ops', category: 'Komoditas', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 100.0, is_core: 0 },
    { id: 'kpi_teus_rev', code: 'OPS-TEUS-REV', name: 'Pendapatan Layanan Petikemas', department_id: 'dept_ops', category: 'Komoditas', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 150.0, is_core: 0 },
    { id: 'kpi_cargo_rev', code: 'OPS-CARGO-REV', name: 'Pendapatan Layanan Barang', department_id: 'dept_ops', category: 'Komoditas', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 80.0, is_core: 0 },
    { id: 'kpi_pax_rev', code: 'OPS-PAX-REV', name: 'Pendapatan Layanan Penumpang', department_id: 'dept_ops', category: 'Komoditas', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 20.0, is_core: 0 },
    { id: 'kpi_misc_rev', code: 'OPS-MISC-REV', name: 'Pendapatan Rupa-rupa', department_id: 'dept_ops', category: 'Komoditas', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 15.0, is_core: 0 },
    { id: 'kpi_wtp', code: 'OPS-WTP', name: 'Waiting Time to Pilot (WTP)', department_id: 'dept_ops', category: 'Kinerja Kapal', unit: 'Jam', direction: 'lower_is_better', default_target: 1.0, is_core: 1 },
    { id: 'kpi_bsh', code: 'OPS-BSH', name: 'Box / Ship / Hour (BSH)', department_id: 'dept_ops', category: 'Kinerja Petikemas', unit: 'Box/Jam', direction: 'higher_is_better', default_target: 25.0, is_core: 1 },
    { id: 'kpi_bch', code: 'OPS-BCH', name: 'Box / Crane / Hour (BCH)', department_id: 'dept_ops', category: 'Kinerja Petikemas', unit: 'Box/Jam', direction: 'higher_is_better', default_target: 20.0, is_core: 1 },
    { id: 'kpi_tgh_dry', code: 'OPS-TGH-DRY', name: 'TGH Curah Kering', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Jam', direction: 'higher_is_better', default_target: 150.0, is_core: 0 },
    { id: 'kpi_tsd_dry', code: 'OPS-TSD-DRY', name: 'TSD Curah Kering', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Hari', direction: 'higher_is_better', default_target: 2000.0, is_core: 0 },
    { id: 'kpi_tgh_liq', code: 'OPS-TGH-LIQ', name: 'TGH Curah Cair', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Jam', direction: 'higher_is_better', default_target: 120.0, is_core: 0 },
    { id: 'kpi_tsd_liq', code: 'OPS-TSD-LIQ', name: 'TSD Curah Cair', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Hari', direction: 'higher_is_better', default_target: 1800.0, is_core: 0 },
    { id: 'kpi_tgh_gc', code: 'OPS-TGH-GC', name: 'TGH General Cargo', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Jam', direction: 'higher_is_better', default_target: 40.0, is_core: 0 },
    { id: 'kpi_tsd_gc', code: 'OPS-TSD-GC', name: 'TSD General Cargo', department_id: 'dept_ops', category: 'Kinerja Barang', unit: 'Ton/Hari', direction: 'higher_is_better', default_target: 600.0, is_core: 0 },
  ];

  const stmtUpsertInd = db.prepare(`
    INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, formula_desc, default_target, is_core_kpi, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      department_id = excluded.department_id,
      category = excluded.category,
      unit = excluded.unit,
      direction = excluded.direction,
      default_target = excluded.default_target,
      is_core_kpi = excluded.is_core_kpi,
      active = 1
  `);

  for (const ind of allIndicators) {
    stmtUpsertInd.run(ind.id, ind.code, ind.name, ind.department_id, ind.category, ind.unit, ind.direction, '', ind.default_target, ind.is_core);
  }

  // 1. Ingest Master Branches & Equipment from 'master'
  console.log('[Ingest] 1. Mengimpor Master Cabang Pelabuhan & Master Peralatan dari sheet master...');
  const masterSheet = wb.Sheets['master'];
  const masterRows: unknown[][] = xlsx.utils.sheet_to_json(masterSheet, { header: 1 });

  // Parse equipment catalog (Columns 8, 9, 10, 11)
  const stmtEquip = db.prepare(`
    INSERT OR REPLACE INTO equipment_catalog (id, code, name, acronym, category, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  let countEquip = 0;
  for (let i = 1; i <= 25; i++) {
    const row = masterRows[i];
    if (row && row[8] && row[9]) {
      const code = String(row[8]).trim();
      const name = String(row[9]).trim();
      const acronym = String(row[10] || '').trim();
      const category = String(row[11] || 'OPERASIONAL').trim();
      stmtEquip.run(`eq_${code.toLowerCase()}`, code, name, acronym, category);
      countEquip++;
    }
  }

  // Parse facilities for each branch from 'fasilitas (2)'
  const facilitiesSheet = wb.Sheets['fasilitas (2)'] || wb.Sheets['fasilitas'];
  const facilityRows: Record<string, unknown>[] = facilitiesSheet ? xlsx.utils.sheet_to_json(facilitiesSheet) : [];
  
  const branchFacilities = new Map<string, { dermaga_length_m: number; kolam_depth_mlws: number; lapangan_sqm: number; gudang_sqm: number }>();
  for (const f of facilityRows) {
    const code = String(f['KODE_CBG'] || '').trim().toUpperCase();
    if (!code) continue;

    if (!branchFacilities.has(code)) {
      branchFacilities.set(code, {
        dermaga_length_m: 0,
        kolam_depth_mlws: -12.0,
        lapangan_sqm: 0,
        gudang_sqm: 0,
      });
    }

    const fac = branchFacilities.get(code)!;
    const jns = String(f['jns_faspel'] || '').toLowerCase();
    const panjang = Number(f[' panjang '] || f['panjang'] || 0);
    const depth = Number(f[' mLws '] || f['mLws'] || 0);
    const luas = Number(f[' luas '] || f['luas'] || 0);

    if (jns.includes('dermaga') && panjang > 0) {
      fac.dermaga_length_m += panjang;
    }
    if (depth < fac.kolam_depth_mlws && depth < 0) {
      fac.kolam_depth_mlws = depth;
    }
    if (jns.includes('lapangan') && luas > 0) {
      fac.lapangan_sqm += luas;
    }
    if (jns.includes('gudang') && luas > 0) {
      fac.gudang_sqm += luas;
    }
  }

  // Re-point any old demo terminal records and delete demo branch
  try {
    db.exec("UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
    db.exec("DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");
  } catch (err) {
    console.warn('[Ingest] Peringatan saat membersihkan cabang demo:', err);
  }

  // Extract branch list matching official specification (28 Branches)
  const stmtBranch = db.prepare(`
    INSERT OR REPLACE INTO branches (id, code, name, region, address, phone, email, active, facilities, overview, order_seq)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let countBranches = 0;
  for (const b of OFFICIAL_BRANCHES) {
    const fac = branchFacilities.get(b.code) || {
      dermaga_length_m: 650,
      kolam_depth_mlws: -11.0,
      lapangan_sqm: 75000,
      gudang_sqm: 12000
    };

    stmtBranch.run(
      b.id,
      b.code,
      b.name,
      b.code === 'R99' ? 'Kantor Regional 4 (Konsolidasi)' : 'Regional 4 (Indonesia Timur)',
      `Pelabuhan ${b.name}, Pelindo Regional 4`,
      '(0411) 362400',
      `${b.id.replace('term_', '')}@pelindo.co.id`,
      1,
      JSON.stringify(fac),
      `Cabang operasional ${b.name} di bawah koordinasi Pelindo Regional 4.`,
      b.order
    );
    countBranches++;
  }

  // Statement for Monthly Records (preserving pending/revision manual inputs on conflict)
  const stmtRec = db.prepare(`
    INSERT INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET
      branch_id = excluded.branch_id,
      department_id = excluded.department_id,
      indicator_id = excluded.indicator_id,
      month = excluded.month,
      year = excluded.year,
      target = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.target ELSE excluded.target END,
      realization = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.realization ELSE excluded.realization END,
      unit = excluded.unit,
      achievement_pct = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.achievement_pct ELSE excluded.achievement_pct END,
      status_color = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.status_color ELSE excluded.status_color END,
      notes = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.notes ELSE excluded.notes END,
      source_type = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.source_type ELSE excluded.source_type END,
      verification_status = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.verification_status ELSE excluded.verification_status END,
      revision_notes = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.revision_notes ELSE excluded.revision_notes END,
      uploaded_by = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.uploaded_by ELSE excluded.uploaded_by END,
      uploaded_at = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.uploaded_at ELSE excluded.uploaded_at END,
      verified_by = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.verified_by ELSE excluded.verified_by END,
      verified_at = CASE WHEN monthly_records.source_type = 'manual_input' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.verified_at ELSE excluded.verified_at END
  `);

  const stmtModFin = db.prepare(`
    INSERT INTO module_finansial (
      id, monthly_record_id, year, month, branch_code, branch_name, rekening,
      cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp,
      yoy, rka, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      cabang_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.cabang_rp ELSE excluded.cabang_rp END,
      pmt_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.pmt_rp ELSE excluded.pmt_rp END,
      ptp_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.ptp_rp ELSE excluded.ptp_rp END,
      psl_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.psl_rp ELSE excluded.psl_rp END,
      pjm_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.pjm_rp ELSE excluded.pjm_rp END,
      eliminasi_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.eliminasi_rp ELSE excluded.eliminasi_rp END,
      konsolidasi_rp = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.konsolidasi_rp ELSE excluded.konsolidasi_rp END,
      yoy = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.yoy ELSE excluded.yoy END,
      rka = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.rka ELSE excluded.rka END
  `);

  const stmtModOpkom = db.prepare(`
    INSERT INTO module_opkom (
      id, monthly_record_id, year, month, branch_code, branch_name, layanan, satuan,
      jumlah_rp, yoy, rka, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      jumlah_rp = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.jumlah_rp ELSE excluded.jumlah_rp END,
      yoy = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.yoy ELSE excluded.yoy END,
      rka = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.rka ELSE excluded.rka END
  `);

  const stmtModKinerja = db.prepare(`
    INSERT INTO module_kinerja (
      id, monthly_record_id, year, month, branch_code, branch_name, kd_kine, nm_kine, satuan,
      nilai, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      nilai = CASE WHEN module_kinerja.source_type = 'manual_input' AND module_kinerja.verification_status IN ('pending_verification', 'revision_needed') THEN module_kinerja.nilai ELSE excluded.nilai END
  `);

  const stmtModUtil = db.prepare(`
    INSERT INTO module_utilisasi (
      id, monthly_record_id, year, month, branch_code, branch_name, kd_jenderm, dermaga,
      bor, yor, sor, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      bor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.bor ELSE excluded.bor END,
      yor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.yor ELSE excluded.yor END,
      sor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.sor ELSE excluded.sor END
  `);

  const stmtModAlat = db.prepare(`
    INSERT INTO module_peralatan (
      id, monthly_record_id, year, month, branch_code, branch_name, kd_alat, nm_alat, singkatan, jns_alat,
      jumlah, availability, utilisasi, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      jumlah = CASE WHEN module_peralatan.source_type = 'manual_input' AND module_peralatan.verification_status IN ('pending_verification', 'revision_needed') THEN module_peralatan.jumlah ELSE excluded.jumlah END,
      availability = CASE WHEN module_peralatan.source_type = 'manual_input' AND module_peralatan.verification_status IN ('pending_verification', 'revision_needed') THEN module_peralatan.availability ELSE excluded.availability END,
      utilisasi = CASE WHEN module_peralatan.source_type = 'manual_input' AND module_peralatan.verification_status IN ('pending_verification', 'revision_needed') THEN module_peralatan.utilisasi ELSE excluded.utilisasi END
  `);

  const stmtModFas = db.prepare(`
    INSERT INTO module_fasilitas (
      id, monthly_record_id, year, month, branch_code, branch_name, nama_fasilitas, jenis_fasilitas, satuan,
      panjang_m, lebar_m, mlws, luas_sqm, kapasitas, keterangan, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', 'verified', 'regdashr@gmail.com', ?, 'bod_regional', ?)
    ON CONFLICT(id) DO UPDATE SET
      panjang_m = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.panjang_m ELSE excluded.panjang_m END,
      lebar_m = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.lebar_m ELSE excluded.lebar_m END,
      mlws = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.mlws ELSE excluded.mlws END,
      luas_sqm = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.luas_sqm ELSE excluded.luas_sqm END,
      kapasitas = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.kapasitas ELSE excluded.kapasitas END,
      keterangan = CASE WHEN module_fasilitas.source_type = 'manual_input' AND module_fasilitas.verification_status IN ('pending_verification', 'revision_needed') THEN module_fasilitas.keterangan ELSE excluded.keterangan END
  `);

  const nowIso = new Date().toISOString();

  // 1b. Ingest Facility rows into module_fasilitas
  for (let i = 0; i < facilityRows.length; i++) {
    const f = facilityRows[i];
    const rawCode = String(getField(f, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(f, 'NM_CBG') || '').trim();
    if (!rawCode && !rawName) continue;
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const year = Number(getField(f, 'TAHUN') || 2026);
    const month = Number(getField(f, 'BULAN') || 9);
    const namaFasilitas = String(getField(f, 'nm_pasfel') || getField(f, 'nm_faspel') || `Fasilitas_${i + 1}`).trim();
    const jenisFasilitas = String(getField(f, 'jns_faspel') || '').trim();
    const satuan = String(getField(f, 'satuan') || 'meter').trim();
    const panjangM = Number(getField(f, 'panjang') || 0);
    const lebarM = Number(getField(f, 'lebar') || 0);
    const mlws = Number(getField(f, 'mLws') || 0);
    const luasSqm = Number(getField(f, 'luas') || getField(f, 'nilai') || 0);
    const kapasitas = getField(f, 'kapasitas') ? String(getField(f, 'kapasitas')).trim() : null;
    const keterangan = getField(f, 'ket') ? String(getField(f, 'ket')).trim() : '';

    const fasId = `mod_fas_${year}_${month}_${code}_${slugKey(namaFasilitas)}_${slugKey(jenisFasilitas)}_${i}`;
    stmtModFas.run(
      fasId,
      null,
      year,
      month,
      code,
      branchName,
      namaFasilitas,
      jenisFasilitas,
      satuan,
      panjangM,
      lebarM,
      mlws,
      luasSqm,
      kapasitas,
      keterangan,
      nowIso,
      nowIso
    );
  }

  // 2. Ingest Financial Data from 'finansial'
  console.log('[Ingest] 2. Mengimpor Data Finansial dari sheet finansial...');
  const finSheet = wb.Sheets['finansial'];
  const finRows: Record<string, unknown>[] = finSheet ? xlsx.utils.sheet_to_json(finSheet) : [];

  let countFin = 0;
  for (const row of finRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const rawRekening = String(getField(row, 'REKENING') || 'Pendapatan').trim();
    const rekening = rawRekening.toLowerCase();
    const year = Number(getField(row, 'TAHUN') || 2025);
    const month = Number(getField(row, 'BULAN') || 9);

    const cabangRp = Number(getField(row, 'CABANG') || 0);
    const pmtRp = Number(getField(row, 'PMT') || 0);
    const ptpRp = Number(getField(row, 'PTP') || 0);
    const pslRp = Number(getField(row, 'PSL') || 0);
    const pjmRp = Number(getField(row, 'PJM') || 0);
    const eliminasiRp = Number(getField(row, 'ELIMINASI') || 0);
    const konsolidasiRp = Number(getField(row, 'KONSOLIDASI') ?? cabangRp ?? 0);
    const konsolidasiM = Number((konsolidasiRp / 1_000_000_000).toFixed(2));
    const yoyPct = Number(Number(getField(row, 'YOY') || 0).toFixed(1));
    const rkaPct = Number(Number(getField(row, 'RKA') || 0).toFixed(1));
    const targetM = rkaPct > 0 ? Number((konsolidasiM / (rkaPct / 100)).toFixed(2)) : konsolidasiM;
    const statusColor = rkaPct >= 100 ? 'green' : rkaPct >= 95 ? 'yellow' : 'red';

    let indId = 'kpi_rev';
    if (rekening.includes('beban')) {
      indId = 'kpi_cost';
    } else if (rekening.includes('bersih')) {
      indId = 'kpi_net_profit';
    } else if (rekening.includes('laba')) {
      indId = 'kpi_profit';
    }

    const recId = `rec_fin_${year}_${month}_${code}_${indId}`;
    const modFinId = `mod_fin_${year}_${month}_${code}_${slugKey(rawRekening)}`;

    stmtModFin.run(
      modFinId,
      recId,
      year,
      month,
      code,
      branchName,
      rawRekening,
      cabangRp,
      pmtRp,
      ptpRp,
      pslRp,
      pjmRp,
      eliminasiRp,
      konsolidasiRp,
      yoyPct,
      rkaPct,
      nowIso,
      nowIso
    );

    stmtRec.run(
      recId,
      branchId,
      'dept_keu',
      indId,
      month,
      year,
      targetM,
      konsolidasiM,
      'Miliar Rp',
      rkaPct,
      statusColor,
      `Data finansial ${rawRekening} dari spreadsheet input_data.xlsx (regdashr@gmail.com)`,
      'google_sheets',
      'batch_mysteve_input_data',
      'verified',
      null,
      'regdashr@gmail.com',
      nowIso,
      'bod_regional',
      nowIso
    );
    countFin++;
  }

  // 3. Ingest Utilization Data from 'utilisasi' (BOR, YOR, SOR)
  console.log('[Ingest] 3. Mengimpor Data Utilisasi Dermaga & Lapangan dari sheet utilisasi...');
  const utilSheet = wb.Sheets['utilisasi'];
  const utilRows: Record<string, unknown>[] = utilSheet ? xlsx.utils.sheet_to_json(utilSheet) : [];

  let countUtil = 0;
  for (const row of utilRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const kdJenderm = String(getField(row, 'KD_JENDERM') ?? '1').trim();
    const dermagaType = String(getField(row, 'DERMAGA') || 'MULTIPURPOSE').trim();

    const bor = Number(getField(row, 'BOR') || 0);
    const yor = Number(getField(row, 'YOR') || 0);
    const sor = Number(getField(row, 'SOR') || 0);

    const borRecId = `rec_util_${year}_${month}_${code}_bor_${dermagaType.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const modUtilId = `mod_util_${year}_${month}_${code}_${slugKey(dermagaType)}`;

    stmtModUtil.run(
      modUtilId,
      borRecId,
      year,
      month,
      code,
      branchName,
      kdJenderm,
      dermagaType,
      bor,
      yor,
      sor,
      nowIso,
      nowIso
    );

    if (bor > 0) {
      const borPct = Number(((bor / 60) * 100).toFixed(1));
      const borColor = bor <= 65 ? 'green' : bor <= 75 ? 'yellow' : 'red';
      stmtRec.run(
        borRecId,
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
        `Berth Occupancy Ratio dermaga ${dermagaType} dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countUtil++;
    }

    if (yor > 0) {
      const yorPct = Number(((yor / 60) * 100).toFixed(1));
      const yorColor = yor <= 60 ? 'green' : yor <= 70 ? 'yellow' : 'red';
      stmtRec.run(
        `rec_util_${year}_${month}_${code}_yor_${dermagaType.replace(/[^a-zA-Z0-9]/g, '_')}`,
        branchId,
        'dept_ops',
        'kpi_yor',
        month,
        year,
        60.0,
        yor,
        '%',
        yorPct,
        yorColor,
        `Yard Occupancy Ratio lapangan ${dermagaType} dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countUtil++;
    }

    if (sor > 0) {
      const sorPct = Number(((sor / 60) * 100).toFixed(1));
      const sorColor = sor <= 60 ? 'green' : sor <= 70 ? 'yellow' : 'red';
      stmtRec.run(
        `rec_util_${year}_${month}_${code}_sor_${dermagaType.replace(/[^a-zA-Z0-9]/g, '_')}`,
        branchId,
        'dept_ops',
        'kpi_sor',
        month,
        year,
        60.0,
        sor,
        '%',
        sorPct,
        sorColor,
        `Storage Occupancy Ratio gudang ${dermagaType} dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countUtil++;
    }
  }

  // 4. Ingest Equipment & Readiness from 'peralatan'
  console.log('[Ingest] 4. Mengimpor Data Kesiapan & Utilisasi Alat dari sheet peralatan...');
  const alatSheet = wb.Sheets['peralatan'];
  const alatRows: Record<string, unknown>[] = alatSheet ? xlsx.utils.sheet_to_json(alatSheet) : [];

  let countAlat = 0;
  for (const row of alatRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const kdAlat = String(getField(row, 'KD_ALAT') || '').trim();
    const alatName = String(getField(row, 'NM_ALAT') || kdAlat || 'Alat').trim();
    const singkatan = String(getField(row, 'SINGKATAN_ALAT') || getField(row, 'SINGKT') || '').trim();
    const jnsAlat = String(getField(row, 'JNS_ALAT') || '').trim();

    const util = Number(getField(row, 'UTILISASI') || 0);
    const avail = Number(getField(row, 'AVAILABILITY') || 0);
    const jumlah = Number(getField(row, 'JUMLAH') || 0);

    const primaryAlatRecId = `rec_alat_qty_${year}_${month}_${code}_${singkatan || slugKey(kdAlat || alatName)}`;
    const modAlatId = `mod_alat_${year}_${month}_${code}_${slugKey(kdAlat || singkatan || alatName)}`;

    stmtModAlat.run(
      modAlatId,
      primaryAlatRecId,
      year,
      month,
      code,
      branchName,
      kdAlat,
      alatName,
      singkatan,
      jnsAlat,
      jumlah,
      avail,
      util,
      nowIso,
      nowIso
    );

    if (avail > 0) {
      const recId = `rec_alat_avail_${year}_${month}_${code}_${singkatan || 'alat'}`;
      const availPct = Number(((avail / 90.0) * 100).toFixed(1));
      const color = avail >= 90 ? 'green' : avail >= 80 ? 'yellow' : 'red';

      stmtRec.run(
        recId,
        branchId,
        'dept_tek',
        'kpi_rfu',
        month,
        year,
        90.0,
        avail,
        '%',
        availPct,
        color,
        `Kesiapan alat (RFU) ${alatName} (${singkatan}) dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countAlat++;
    }

    if (util > 0) {
      const recId = `rec_alat_util_${year}_${month}_${code}_${singkatan || 'alat'}`;
      const utilPct = Number(((util / 60.0) * 100).toFixed(1));
      const color = util >= 60 ? 'green' : util >= 45 ? 'yellow' : 'red';

      stmtRec.run(
        recId,
        branchId,
        'dept_tek',
        'kpi_util_alat',
        month,
        year,
        60.0,
        util,
        '%',
        utilPct,
        color,
        `Utilisasi alat ${alatName} (${singkatan}) dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countAlat++;
    }

    if (jumlah > 0) {
      stmtRec.run(
        primaryAlatRecId,
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
        `Populasi unit ${alatName} (${singkatan}) operasional dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countAlat++;
    }
  }

  // 5. Ingest Commodity Revenue & Throughput from 'opkom'
  console.log('[Ingest] 5. Mengimpor Pendapatan & Trafik per Komoditas dari sheet opkom...');
  const opkomSheet = wb.Sheets['opkom'];
  const opkomRows: Record<string, unknown>[] = opkomSheet ? xlsx.utils.sheet_to_json(opkomSheet) : [];

  let countOpkom = 0;
  for (const row of opkomRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const layanan = String(getField(row, 'LAYANAN') || '').trim().toUpperCase();
    const satuan = String(getField(row, 'SATUAN') || 'Rp').trim();
    const jumlahVal = Number(getField(row, 'JUMLAH') || 0);
    const yoyPct = Number(Number(getField(row, 'YOY') || 0).toFixed(1));
    const rkaPct = Number(Number(getField(row, 'RKA') || 0).toFixed(1));

    const recId = `rec_opkom_${year}_${month}_${code}_${layanan.replace(/[^a-zA-Z0-9]/g, '_')}_${slugKey(satuan)}`;
    const modOpkomId = `mod_opkom_${year}_${month}_${code}_${slugKey(layanan)}_${slugKey(satuan)}`;

    stmtModOpkom.run(
      modOpkomId,
      recId,
      year,
      month,
      code,
      branchName,
      layanan,
      satuan,
      jumlahVal,
      yoyPct,
      rkaPct,
      nowIso,
      nowIso
    );

    if (satuan.toLowerCase() === 'rp') {
      const jumlahM = Number((jumlahVal / 1_000_000_000).toFixed(2));
      const targetM = rkaPct > 0 ? Number((jumlahM / (rkaPct / 100)).toFixed(2)) : jumlahM;
      const color = rkaPct >= 100 ? 'green' : rkaPct >= 95 ? 'yellow' : 'red';

      if (jumlahM > 0) {
        let indId = 'kpi_rev';
        if (layanan.includes('PETIKEMAS')) indId = 'kpi_teus_rev';
        else if (layanan.includes('BARANG')) indId = 'kpi_cargo_rev';
        else if (layanan.includes('KAPAL')) indId = 'kpi_ship_rev';
        else if (layanan.includes('PENUMPANG')) indId = 'kpi_pax_rev';
        else if (layanan.includes('RUPA')) indId = 'kpi_misc_rev';

        stmtRec.run(
          recId,
          branchId,
          'dept_ops',
          indId,
          month,
          year,
          targetM,
          jumlahM,
          'Miliar Rp',
          rkaPct,
          color,
          `Pendapatan Layanan ${layanan} dari spreadsheet input_data.xlsx`,
          'google_sheets',
          'batch_mysteve_input_data',
          'verified',
          null,
          'regdashr@gmail.com',
          nowIso,
          'bod_regional',
          nowIso
        );
        countOpkom++;
      }
    }
  }

  // 6. Ingest Operational KPIs from 'kinerja'
  console.log('[Ingest] 6. Mengimpor Kinerja Operasional Kapal, Barang, & Petikemas dari sheet kinerja...');
  const kinerjaSheet = wb.Sheets['kinerja'];
  const kinerjaRows: Record<string, unknown>[] = kinerjaSheet ? xlsx.utils.sheet_to_json(kinerjaSheet) : [];

  let countKinerja = 0;
  for (const row of kinerjaRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const kdKine = String(getField(row, 'KD_KINE') || '').trim();
    const nmKine = String(getField(row, 'NM_KINE') || '').trim().toUpperCase();
    const satuan = String(getField(row, 'SATUAN') || '').trim();
    const nilai = Number(getField(row, 'NILAI') || 0);

    let indId = '';
    let target = 0;
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

    const recId = indId ? `rec_kine_${year}_${month}_${code}_${indId}` : `rec_kine_${year}_${month}_${code}_${slugKey(kdKine)}_${slugKey(satuan)}`;
    const modKineId = `mod_kine_${year}_${month}_${code}_${slugKey(kdKine)}_${slugKey(nmKine)}_${slugKey(satuan)}`;

    stmtModKinerja.run(
      modKineId,
      indId ? recId : null,
      year,
      month,
      code,
      branchName,
      kdKine,
      nmKine,
      satuan,
      nilai,
      nowIso,
      nowIso
    );

    if (indId && nilai > 0) {
      const achPct = isHigherBetter
        ? Number(((nilai / target) * 100).toFixed(1))
        : Number(((target / Math.max(nilai, 0.01)) * 100).toFixed(1));
      const color = achPct >= 100 ? 'green' : achPct >= 90 ? 'yellow' : 'red';

      stmtRec.run(
        recId,
        branchId,
        'dept_ops',
        indId,
        month,
        year,
        target,
        nilai,
        unit,
        achPct,
        color,
        `Kinerja ${nmKine} (${satuan}) dari input_data.xlsx`,
        'google_sheets',
        'batch_mysteve_input_data',
        'verified',
        null,
        'regdashr@gmail.com',
        nowIso,
        'bod_regional',
        nowIso
      );
      countKinerja++;
    }
  }

  // 7. Update integration_settings
  db.prepare(`
    INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'cfg_google_drive',
    'google_drive_regdashr',
    JSON.stringify({
      email: 'regdashr@gmail.com',
      file_name: 'input_data.xlsx',
      synced_at: new Date().toISOString(),
      branches_count: countBranches,
      equipment_count: countEquip,
      financial_count: countFin,
      utilization_count: countUtil,
      equipment_readiness_count: countAlat,
      commodity_count: countOpkom,
      performance_kpi_count: countKinerja,
      status: 'synced_success'
    }),
    new Date().toISOString()
  );

    // 8. Record in Audit Log
    const totalRecords = countFin + countUtil + countAlat + countOpkom + countKinerja;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_ingest_${Date.now()}`,
      'usr_regdashr',
      'Sinkronisasi Spreadsheet Lokal',
      'super_admin',
      'IMPORT',
      'SPREADSHEET_LOCAL',
      'input_data.xlsx',
      `Sinkronisasi file spreadsheet lokal input_data.xlsx selesai: ${countBranches} cabang master, ${countEquip} katalog alat, dan total ${totalRecords} rekaman kinerja operasional & finansial.`,
      new Date().toISOString(),
      '127.0.0.1'
    );

    console.log(`\n======================================================
Sinkronisasi data master dan rekaman kinerja selesai:
- Master Cabang Pelabuhan : ${countBranches} cabang (R01-R80, R99)
- Master Katalog Peralatan: ${countEquip} jenis alat (AL01-AL21)
- Data Finansial          : ${countFin} rekaman (Pendapatan, Beban, Laba)
- Data Utilisasi          : ${countUtil} rekaman (BOR, YOR, SOR)
- Data Kesiapan Alat      : ${countAlat} rekaman (RFU & Utilisasi)
- Data Komoditas (Opkom)  : ${countOpkom} rekaman (Kapal, Petikemas, Barang)
- Data Kinerja Operasional: ${countKinerja} rekaman (WTP, BSH, BCH, TGH, TSD)
------------------------------------------------------
Total Rekaman Terimpor    : ${totalRecords}
Sumber Berkas             : data/input_data.xlsx (Penyimpanan Lokal)
======================================================\n`);

    return {
      branches: countBranches,
      equipment: countEquip,
      financial: countFin,
      utilization: countUtil,
      equipmentReadiness: countAlat,
      commodity: countOpkom,
      performance: countKinerja,
      totalRecords,
    };
  });
}
