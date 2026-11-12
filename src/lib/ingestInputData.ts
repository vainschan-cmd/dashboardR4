import { withTransaction } from './db';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { OFFICIAL_BRANCHES, getCanonicalBranchCode, getBranchNameByCode } from './constants';
import {
  FINANSIAL_ENTITAS_LIST,
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
  parsePeralatanCsvRows,
  resolvePeralatanBranchCode,
} from './peralatanHelpers';

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

export function getField(row: any, name: string): any {
  if (!row) return undefined;
  const target = name.trim().toLowerCase();
  let fallbackVal: any = undefined;
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

export async function ingestInputData(filePath?: string) {
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

  console.log(`[Ingest] Membaca file spreadsheet lokal: ${excelPath}`);
  const fileBuffer = fs.readFileSync(excelPath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  // Prioritaskan data/labarugi.xlsx sebagai sumber utama modul Finansial jika tersedia
  const labarugiPath = path.join(path.dirname(excelPath), 'labarugi.xlsx');
  let labarugiWb: xlsx.WorkBook | null = null;
  if (fs.existsSync(labarugiPath)) {
    try {
      const lbStat = fs.statSync(labarugiPath);
      if (lbStat.size <= MAX_SPREADSHEET_SIZE_BYTES) {
        labarugiWb = xlsx.read(fs.readFileSync(labarugiPath), { type: 'buffer' });
        console.log(`[Ingest] Sumber Finansial ditemukan di: ${labarugiPath}`);
      }
    } catch (err) {
      console.warn('[Ingest] Gagal membaca data/labarugi.xlsx, fallback ke sheet input_data.xlsx:', err);
    }
  }

  // Prioritaskan data/peralatan.xlsx (atau peralatan.csv) sebagai sumber utama modul Peralatan jika tersedia
  const dataDir = path.dirname(excelPath);
  const peralatanXlsxPath = path.join(dataDir, 'peralatan.xlsx');
  const peralatanCsvPath = path.join(dataDir, 'peralatan.csv');
  let peralatanWb: xlsx.WorkBook | null = null;
  let peralatanCsvText: string | null = null;
  if (fs.existsSync(peralatanXlsxPath)) {
    try {
      const alatStat = fs.statSync(peralatanXlsxPath);
      if (alatStat.size <= MAX_SPREADSHEET_SIZE_BYTES) {
        peralatanWb = xlsx.read(fs.readFileSync(peralatanXlsxPath), { type: 'buffer' });
        console.log(`[Ingest] Sumber Peralatan ditemukan di: ${peralatanXlsxPath}`);
      }
    } catch (err) {
      console.warn('[Ingest] Gagal membaca data/peralatan.xlsx, fallback ke sheet input_data.xlsx:', err);
    }
  } else if (fs.existsSync(peralatanCsvPath)) {
    try {
      const csvStat = fs.statSync(peralatanCsvPath);
      if (csvStat.size <= MAX_SPREADSHEET_SIZE_BYTES) {
        peralatanCsvText = fs.readFileSync(peralatanCsvPath, 'utf8');
        console.log(`[Ingest] Sumber Peralatan CSV ditemukan di: ${peralatanCsvPath}`);
      }
    } catch (err) {
      console.warn('[Ingest] Gagal membaca data/peralatan.csv:', err);
    }
  }

  return await withTransaction(async (client) => {
    const prepare = (sql: string) => ({
      run: async (...args: any[]) => client.query(sql, args),
    });
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

  const stmtUpsertInd = prepare(`
    INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, formula_desc, default_target, is_core_kpi, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      department_id = excluded.department_id,
      category = excluded.category,
      unit = excluded.unit,
      direction = excluded.direction,
      default_target = excluded.default_target,
      is_core_kpi = excluded.is_core_kpi,
      active = TRUE
  `);

  for (const ind of allIndicators) {
    await stmtUpsertInd.run(ind.id, ind.code, ind.name, ind.department_id, ind.category, ind.unit, ind.direction, '', ind.default_target, Boolean(ind.is_core));
  }

  // 1. Ingest Master Branches & Equipment from 'master'
  console.log('[Ingest] 1. Mengimpor Master Cabang Pelabuhan & Master Peralatan dari sheet master...');
  const masterSheet = wb.Sheets['master'];
  const masterRows: any[][] = xlsx.utils.sheet_to_json(masterSheet, { header: 1 });

  // Parse equipment catalog (Columns 8, 9, 10, 11)
  const stmtEquip = prepare(`
    INSERT INTO equipment_catalog (id, code, name, acronym, category, active)
    VALUES ($1, $2, $3, $4, $5, TRUE)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      acronym = excluded.acronym,
      category = excluded.category,
      active = TRUE
  `);

  let countEquip = 0;
  for (let i = 1; i <= 25; i++) {
    const row = masterRows[i];
    if (row && row[8] && row[9]) {
      const code = String(row[8]).trim();
      const name = String(row[9]).trim();
      const acronym = String(row[10] || '').trim();
      const category = String(row[11] || 'OPERASIONAL').trim();
      await stmtEquip.run(`eq_${code.toLowerCase()}`, code, name, acronym, category);
      countEquip++;
    }
  }

  // Parse facilities for each branch from 'fasilitas (2)'
  const facilitiesSheet = wb.Sheets['fasilitas (2)'] || wb.Sheets['fasilitas'];
  const facilityRows: any[] = facilitiesSheet ? xlsx.utils.sheet_to_json(facilitiesSheet) : [];
  
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
    await client.query("UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
    await client.query("DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");
  } catch (err) {
    console.warn('[Ingest] Peringatan saat membersihkan cabang demo:', err);
  }

  // Extract branch list matching official specification (28 Branches)
  const stmtBranch = prepare(`
    INSERT INTO branches (id, code, name, region, address, phone, email, active, facilities, overview, order_seq)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      region = excluded.region,
      address = excluded.address,
      phone = excluded.phone,
      email = excluded.email,
      active = excluded.active,
      facilities = excluded.facilities,
      overview = excluded.overview,
      order_seq = excluded.order_seq
  `);

  let countBranches = 0;
  for (const b of OFFICIAL_BRANCHES) {
    const fac = branchFacilities.get(b.code) || {
      dermaga_length_m: 650,
      kolam_depth_mlws: -11.0,
      lapangan_sqm: 75000,
      gudang_sqm: 12000
    };

    await stmtBranch.run(
      b.id,
      b.code,
      b.name,
      b.code === 'R99' ? 'Kantor Regional 4 (Konsolidasi)' : 'Regional 4 (Indonesia Timur)',
      `Pelabuhan ${b.name}, Pelindo Regional 4`,
      '(0411) 362400',
      `${b.id.replace('term_', '')}@pelindo.co.id`,
      true,
      JSON.stringify(fac),
      `Cabang operasional ${b.name} di bawah koordinasi Pelindo Regional 4.`,
      b.order
    );
    countBranches++;
  }

  // Statement for Monthly Records (preserving pending/revision manual inputs on conflict)
  const stmtRec = prepare(`
    INSERT INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz, $19, $20::timestamptz, FALSE)
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

  const modFinSql = `
    INSERT INTO module_finansial (
      id, monthly_record_id, year, month, branch_code, branch_name, rekening, entitas,
      realisasi, rka, yoy, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'labarugi_xlsx', 'verified', 'regdashr@gmail.com', $12::timestamptz, 'bod_regional', $13::timestamptz)
    ON CONFLICT(id) DO UPDATE SET
      monthly_record_id = excluded.monthly_record_id,
      branch_name = excluded.branch_name,
      rekening = excluded.rekening,
      entitas = excluded.entitas,
      realisasi = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.realisasi ELSE excluded.realisasi END,
      rka = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.rka ELSE excluded.rka END,
      yoy = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.yoy ELSE excluded.yoy END
  `;
  const stmtModFin = prepare(modFinSql);

  const stmtModOpkom = prepare(`
    INSERT INTO module_opkom (
      id, monthly_record_id, year, month, branch_code, branch_name, layanan, satuan,
      jumlah_rp, yoy, rka, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'google_sheets', 'verified', 'regdashr@gmail.com', $12::timestamptz, 'bod_regional', $13::timestamptz)
    ON CONFLICT(id) DO UPDATE SET
      jumlah_rp = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.jumlah_rp ELSE excluded.jumlah_rp END,
      yoy = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.yoy ELSE excluded.yoy END,
      rka = CASE WHEN module_opkom.source_type = 'manual_input' AND module_opkom.verification_status IN ('pending_verification', 'revision_needed') THEN module_opkom.rka ELSE excluded.rka END
  `);

  const stmtModKinerja = prepare(`
    INSERT INTO module_kinerja (
      id, monthly_record_id, year, month, branch_code, branch_name, kd_kine, nm_kine, satuan,
      nilai, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'google_sheets', 'verified', 'regdashr@gmail.com', $11::timestamptz, 'bod_regional', $12::timestamptz)
    ON CONFLICT(id) DO UPDATE SET
      nilai = CASE WHEN module_kinerja.source_type = 'manual_input' AND module_kinerja.verification_status IN ('pending_verification', 'revision_needed') THEN module_kinerja.nilai ELSE excluded.nilai END
  `);

  const stmtModUtil = prepare(`
    INSERT INTO module_utilisasi (
      id, monthly_record_id, year, month, branch_code, branch_name, kd_jenderm, dermaga,
      bor, yor, sor, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'google_sheets', 'verified', 'regdashr@gmail.com', $12::timestamptz, 'bod_regional', $13::timestamptz)
    ON CONFLICT(id) DO UPDATE SET
      bor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.bor ELSE excluded.bor END,
      yor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.yor ELSE excluded.yor END,
      sor = CASE WHEN module_utilisasi.source_type = 'manual_input' AND module_utilisasi.verification_status IN ('pending_verification', 'revision_needed') THEN module_utilisasi.sor ELSE excluded.sor END
  `);

  const stmtModFas = prepare(`
    INSERT INTO module_fasilitas (
      id, monthly_record_id, year, month, branch_code, branch_name, nama_fasilitas, jenis_fasilitas, satuan,
      panjang_m, lebar_m, mlws, luas_sqm, kapasitas, keterangan, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'google_sheets', 'verified', 'regdashr@gmail.com', $16::timestamptz, 'bod_regional', $17::timestamptz)
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
  let countFas = 0;
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
    await stmtModFas.run(
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
    countFas++;
  }

  // 2. Ingest Financial Data (9 field standar: TAHUN, BULAN, KODE_CBG, NM_CBG, REKENING, ENTITAS, REALISASI, RKA, YOY)
  console.log('[Ingest] 2. Mengimpor Data Finansial terstruktur (labarugi / finansial)...');
  const finSheet =
    (labarugiWb ? labarugiWb.Sheets['labarugi'] || labarugiWb.Sheets[labarugiWb.SheetNames[0]] : undefined) ||
    wb.Sheets['labarugi'] ||
    wb.Sheets['finansial'];
  const rawFinRows: any[] = finSheet ? xlsx.utils.sheet_to_json(finSheet, { defval: '' }) : [];

  interface NormalizedFinInput {
    year: number;
    month: number;
    code: string;
    branchName: string;
    branchId: string;
    rekening: string;
    entitas: string;
    realisasi: number;
    rka: number | null;
    yoy: number | null;
  }

  const normalizedFinRows: NormalizedFinInput[] = [];
  for (const row of rawFinRows) {
    const rawCode = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const rawName = String(getField(row, 'NM_CBG') || '').trim();
    if (!rawCode && !rawName) continue;
    const code = getCanonicalBranchCode(rawCode, rawName);
    const branchName = getBranchNameByCode(code) || rawName || code;
    const branchId = getBranchId(code, branchName);
    const rekening = canonicalRekening(getField(row, 'REKENING') || 'Pendapatan');
    const year = Number(getField(row, 'TAHUN') || 2025);
    const month = Number(getField(row, 'BULAN') || 9);

    const entitasRaw = getField(row, 'ENTITAS');
    if (entitasRaw !== undefined && entitasRaw !== '') {
      const entitas = String(entitasRaw).trim().toUpperCase();
      const realisasi = parseRealisasi(getField(row, 'REALISASI'));
      const rka = parseMetricPercent(getField(row, 'RKA'));
      const yoy = parseMetricPercent(getField(row, 'YOY'));
      normalizedFinRows.push({
        year,
        month,
        code,
        branchName,
        branchId,
        rekening,
        entitas,
        realisasi,
        rka,
        yoy,
      });
    } else {
      // Fallback kompatibilitas jika file legacy masih berformat kolom per entitas
      const yoy = parseMetricPercent(getField(row, 'YOY'));
      const rka = parseMetricPercent(getField(row, 'RKA'));
      for (const entitas of FINANSIAL_ENTITAS_LIST) {
        const realisasi = parseRealisasi(getField(row, entitas));
        normalizedFinRows.push({
          year,
          month,
          code,
          branchName,
          branchId,
          rekening,
          entitas,
          realisasi,
          rka: realisasi === 0 ? null : rka,
          yoy: realisasi === 0 ? null : yoy,
        });
      }
    }
  }

  // Bersihkan baris finansial sumber spreadsheet lama sebelum sinkronisasi ulang agar tidak ada data usang
  if (normalizedFinRows.length > 0) {
    await client.query(
      `DELETE FROM module_finansial
       WHERE NOT (source_type = 'manual_input' AND verification_status IN ('pending_verification', 'revision_needed'))`
    );
    await client.query(
      `DELETE FROM monthly_records
       WHERE department_id = 'dept_keu'
         AND NOT (source_type = 'manual' AND verification_status IN ('pending_verification', 'revision_needed'))`
    );
  }

  let countFin = 0;
  // Batch insert module_finansial per 200 baris demi performa PostgreSQL
  const FIN_BATCH_SIZE = 200;
  for (let start = 0; start < normalizedFinRows.length; start += FIN_BATCH_SIZE) {
    const chunk = normalizedFinRows.slice(start, start + FIN_BATCH_SIZE);
    const valuesSql: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const item of chunk) {
      const recId = getFinansialMonthlyRecordId(item.year, item.month, item.code, item.rekening);
      const modFinId = getFinansialRowId(item.year, item.month, item.code, item.rekening, item.entitas);
      valuesSql.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'labarugi_xlsx', 'verified', 'regdashr@gmail.com', $${pIdx++}::timestamptz, 'bod_regional', $${pIdx++}::timestamptz)`
      );
      params.push(
        modFinId,
        recId,
        item.year,
        item.month,
        item.code,
        item.branchName,
        item.rekening,
        item.entitas,
        item.realisasi,
        item.rka,
        item.yoy,
        nowIso,
        nowIso
      );
      countFin++;
    }

    await client.query(
      `INSERT INTO module_finansial (
        id, monthly_record_id, year, month, branch_code, branch_name, rekening, entitas,
        realisasi, rka, yoy, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
      ) VALUES ${valuesSql.join(', ')}
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_name = excluded.branch_name,
        rekening = excluded.rekening,
        entitas = excluded.entitas,
        realisasi = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.realisasi ELSE excluded.realisasi END,
        rka = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.rka ELSE excluded.rka END,
        yoy = CASE WHEN module_finansial.source_type = 'manual_input' AND module_finansial.verification_status IN ('pending_verification', 'revision_needed') THEN module_finansial.yoy ELSE excluded.yoy END`,
      params
    );
  }

  // Agregasi konsolidasi (menjumlahkan seluruh entitas TERMASUK ELIMINASI) untuk monthly_records
  const finConsolidatedGroups = new Map<
    string,
    {
      year: number;
      month: number;
      code: string;
      branchId: string;
      rekening: string;
      totalRealisasi: number;
      rkaValues: Array<number | null>;
    }
  >();

  for (const item of normalizedFinRows) {
    const recId = getFinansialMonthlyRecordId(item.year, item.month, item.code, item.rekening);
    const existingGroup = finConsolidatedGroups.get(recId);
    if (!existingGroup) {
      finConsolidatedGroups.set(recId, {
        year: item.year,
        month: item.month,
        code: item.code,
        branchId: item.branchId,
        rekening: item.rekening,
        totalRealisasi: item.realisasi,
        rkaValues: item.realisasi !== 0 && item.rka !== null ? [item.rka] : [],
      });
    } else {
      existingGroup.totalRealisasi += item.realisasi;
      if (item.realisasi !== 0 && item.rka !== null) {
        existingGroup.rkaValues.push(item.rka);
      }
    }
  }

  const consolidatedList = Array.from(finConsolidatedGroups.entries());
  for (let start = 0; start < consolidatedList.length; start += FIN_BATCH_SIZE) {
    const chunk = consolidatedList.slice(start, start + FIN_BATCH_SIZE);
    const valuesSql: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const [recId, grp] of chunk) {
      const indId = getIndicatorIdForRekening(grp.rekening);
      const konsolidasiM = Number((grp.totalRealisasi / 1_000_000_000).toFixed(2));
      const avgRka = averageValidMetric(grp.rkaValues);
      const rkaPct = avgRka === '-' ? 0 : avgRka;
      const targetM = rkaPct > 0 ? Number((konsolidasiM / (rkaPct / 100)).toFixed(2)) : konsolidasiM;
      const statusColor = avgRka === '-' ? 'neutral' : rkaPct >= 100 ? 'green' : rkaPct >= 95 ? 'yellow' : 'red';

      valuesSql.push(
        `($${pIdx++}, $${pIdx++}, 'dept_keu', $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'Miliar Rp', $${pIdx++}, $${pIdx++}, $${pIdx++}, 'google_sheets', 'batch_mysteve_input_data', 'verified', NULL, 'regdashr@gmail.com', $${pIdx++}::timestamptz, 'bod_regional', $${pIdx++}::timestamptz, FALSE)`
      );
      params.push(
        recId,
        grp.branchId,
        indId,
        grp.month,
        grp.year,
        targetM,
        konsolidasiM,
        rkaPct,
        statusColor,
        `Konsolidasi ${grp.rekening} (seluruh entitas termasuk ELIMINASI) dari labarugi.xlsx`,
        nowIso,
        nowIso
      );
    }

    await client.query(
      `INSERT INTO monthly_records (
        id, branch_id, department_id, indicator_id, month, year,
        target, realization, unit, achievement_pct, status_color, notes,
        source_type, batch_id, verification_status, revision_notes,
        uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
      ) VALUES ${valuesSql.join(', ')}
      ON CONFLICT(id) DO UPDATE SET
        target = CASE WHEN monthly_records.source_type = 'manual' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.target ELSE excluded.target END,
        realization = CASE WHEN monthly_records.source_type = 'manual' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.realization ELSE excluded.realization END,
        achievement_pct = CASE WHEN monthly_records.source_type = 'manual' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.achievement_pct ELSE excluded.achievement_pct END,
        status_color = CASE WHEN monthly_records.source_type = 'manual' AND monthly_records.verification_status IN ('pending_verification', 'revision_needed') THEN monthly_records.status_color ELSE excluded.status_color END,
        notes = excluded.notes`,
      params
    );
  }
  void stmtModFin;

  // 3. Ingest Utilization Data from 'utilisasi' (BOR, YOR, SOR)
  console.log('[Ingest] 3. Mengimpor Data Utilisasi Dermaga & Lapangan dari sheet utilisasi...');
  const utilSheet = wb.Sheets['utilisasi'];
  const utilRows: any[] = utilSheet ? xlsx.utils.sheet_to_json(utilSheet) : [];

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

    await stmtModUtil.run(
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
      await stmtRec.run(
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
      await stmtRec.run(
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
      await stmtRec.run(
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

  // 4. Ingest Equipment Monitoring (9 Kolom Standar) from peralatan.xlsx / peralatan.csv / sheet peralatan
  console.log('[Ingest] 4. Mengimpor Data Monitoring Kondisi Peralatan (9 Kolom Standar)...');
  let rawAlatMatrix: unknown[][] = [];
  if (peralatanWb) {
    const sheetName =
      peralatanWb.SheetNames.find(s => ['alat', 'peralatan'].includes(s.toLowerCase())) ||
      peralatanWb.SheetNames[0];
    if (sheetName && peralatanWb.Sheets[sheetName]) {
      rawAlatMatrix = xlsx.utils.sheet_to_json(peralatanWb.Sheets[sheetName], {
        header: 1,
        defval: '',
      }) as unknown[][];
    }
  } else if (peralatanCsvText) {
    rawAlatMatrix = parsePeralatanCsvRows(peralatanCsvText);
  } else if (wb.Sheets['peralatan']) {
    rawAlatMatrix = xlsx.utils.sheet_to_json(wb.Sheets['peralatan'], {
      header: 1,
      defval: '',
    }) as unknown[][];
  }

  // Temukan baris header (abaikan baris kosong paling atas seperti ,,,,,,,,)
  const nonEmptyMatrix = rawAlatMatrix.filter(
    row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== '')
  );
  let headerRowIdx = nonEmptyMatrix.findIndex(row =>
    row.some(cell => {
      const h = String(cell ?? '').trim().toLowerCase();
      return h === 'tanggal' || h === 'grup / entitas' || h === 'grup_entitas' || h === 'nama alat' || h === 'nama_alat';
    })
  );
  if (headerRowIdx < 0) headerRowIdx = 0;

  const alatHeaderRow = (nonEmptyMatrix[headerRowIdx] || []).map(cell =>
    String(cell ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  );
  const colIdx = (aliases: string[], fallbackIdx: number): number => {
    for (const a of aliases) {
      const found = alatHeaderRow.findIndex(h => h === a);
      if (found >= 0) return found;
    }
    return fallbackIdx;
  };

  const idxTanggal = colIdx(['tanggal'], 0);
  const idxGrup = colIdx(['grup / entitas', 'grup/entitas', 'grup_entitas', 'grup'], 1);
  const idxCabang = colIdx(['nama cabang', 'nama_cabang', 'nm_cbg'], 2);
  const idxNamaAlat = colIdx(['nama alat', 'nama_alat', 'nm_alat'], 3);
  const idxJenisAlat = colIdx(['jenis alat', 'jenis_alat', 'jns_alat'], 4);
  const idxKategori = colIdx(['kategori alat', 'kategori_alat', 'kategori'], 5);
  const idxKondisi = colIdx(['kondisi', 'status'], 6);
  const idxKerusakan = colIdx(['kerusakan'], 7);
  const idxTindakLanjut = colIdx(['tindak lanjut', 'tindak_lanjut'], 8);

  const normalizedAlatRows: Array<{
    id: string;
    monthlyRecordId: string;
    branchCode: string;
    tanggal: string;
    grupEntitas: string;
    namaCabang: string;
    namaAlat: string;
    jenisAlat: string;
    kategoriAlat: string;
    kondisi: string;
    kerusakan: string | null;
    tindakLanjut: string | null;
  }> = [];

  for (let i = headerRowIdx + 1; i < nonEmptyMatrix.length; i++) {
    const row = nonEmptyMatrix[i];
    if (!row || row.every(c => String(c ?? '').trim() === '')) continue;

    const rawTanggal = row[idxTanggal];
    let tanggal = '';
    if (typeof rawTanggal === 'number' && Number.isFinite(rawTanggal)) {
      const parsedDate = xlsx.SSF.parse_date_code(rawTanggal);
      if (parsedDate) {
        tanggal = `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
      }
    }
    if (!tanggal) {
      tanggal = normalizeTanggalISO(rawTanggal);
    }
    if (!tanggal) continue;

    const grupEntitas = normalizeGrupEntitas(row[idxGrup]);
    const namaCabang = String(row[idxCabang] ?? '').trim();
    const namaAlat = String(row[idxNamaAlat] ?? '').trim();
    const jenisAlat = String(row[idxJenisAlat] ?? '').trim();
    const kategoriAlat = String(row[idxKategori] ?? '').trim();
    const kondisi = normalizeKondisi(row[idxKondisi]);
    const kerusakan = normalizeNullableText(row[idxKerusakan]);
    const tindakLanjut = normalizeNullableText(row[idxTindakLanjut]);

    if (!namaCabang || !namaAlat) continue;

    const branchCode = resolvePeralatanBranchCode(namaCabang);
    const [yrStr, moStr] = tanggal.split('-');
    const rowSeq = normalizedAlatRows.length + 1;
    const monthlyRecordId = `rec_alat_rfu_${Number(yrStr)}_${Number(moStr)}_${branchCode}`;
    const modAlatId = `mod_alat_${tanggal}_${slugKey(branchCode)}_${rowSeq}`;

    normalizedAlatRows.push({
      id: modAlatId,
      monthlyRecordId,
      branchCode,
      tanggal,
      grupEntitas: grupEntitas || 'R4',
      namaCabang,
      namaAlat,
      jenisAlat: jenisAlat || 'Lainnya',
      kategoriAlat: kategoriAlat || 'Alat CY',
      kondisi,
      kerusakan,
      tindakLanjut,
    });
  }

  // Hapus data peralatan lama agar sinkron penuh dengan dataset terbaru
  if (normalizedAlatRows.length > 0) {
    await client.query(
      `DELETE FROM module_peralatan
       WHERE NOT (source_type = 'manual_input' AND verification_status IN ('pending_verification', 'revision_needed'))`
    );
    await client.query(
      `DELETE FROM monthly_records
       WHERE department_id = 'dept_tek'
         AND indicator_id IN ('kpi_rfu', 'kpi_util_alat', 'kpi_alat_qty')
         AND NOT (source_type IN ('manual', 'manual_input') AND verification_status IN ('pending_verification', 'revision_needed'))`
    );
  }

  let countAlat = 0;
  const ALAT_BATCH_SIZE = 250;
  for (let start = 0; start < normalizedAlatRows.length; start += ALAT_BATCH_SIZE) {
    const chunk = normalizedAlatRows.slice(start, start + ALAT_BATCH_SIZE);
    const valuesSql: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const item of chunk) {
      valuesSql.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}::date, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'peralatan_xlsx', 'verified', 'regdashr@gmail.com', $${pIdx++}::timestamptz, 'bod_regional', $${pIdx++}::timestamptz)`
      );
      params.push(
        item.id,
        item.monthlyRecordId,
        item.branchCode,
        item.tanggal,
        item.grupEntitas,
        item.namaCabang,
        item.namaAlat,
        item.jenisAlat,
        item.kategoriAlat,
        item.kondisi,
        item.kerusakan,
        item.tindakLanjut,
        nowIso,
        nowIso
      );
      countAlat++;
    }

    await client.query(
      `INSERT INTO module_peralatan (
        id, monthly_record_id, branch_code, tanggal, grup_entitas, nama_cabang,
        nama_alat, jenis_alat, kategori_alat, kondisi, kerusakan, tindak_lanjut,
        source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
      ) VALUES ${valuesSql.join(', ')}
      ON CONFLICT(id) DO UPDATE SET
        monthly_record_id = excluded.monthly_record_id,
        branch_code = excluded.branch_code,
        tanggal = excluded.tanggal,
        grup_entitas = excluded.grup_entitas,
        nama_cabang = excluded.nama_cabang,
        nama_alat = excluded.nama_alat,
        jenis_alat = excluded.jenis_alat,
        kategori_alat = excluded.kategori_alat,
        kondisi = excluded.kondisi,
        kerusakan = excluded.kerusakan,
        tindak_lanjut = excluded.tindak_lanjut`,
      params
    );
  }

  // Agregasi RFU (Kesiapan Alat) per (year, month, branch_code) pada tanggal snapshot terbaru bulan tsb ke monthly_records
  const alatPeriodBranchLatestDate = new Map<string, string>();
  for (const item of normalizedAlatRows) {
    const [yrStr, moStr] = item.tanggal.split('-');
    const ymKey = `${Number(yrStr)}|${Number(moStr)}|${item.branchCode}`;
    const prevDate = alatPeriodBranchLatestDate.get(ymKey);
    if (!prevDate || item.tanggal > prevDate) {
      alatPeriodBranchLatestDate.set(ymKey, item.tanggal);
    }
  }

  const alatMonthlyAgg = new Map<
    string,
    { year: number; month: number; branchCode: string; branchName: string; tanggal: string; total: number; ready: number }
  >();
  for (const item of normalizedAlatRows) {
    const [yrStr, moStr] = item.tanggal.split('-');
    const year = Number(yrStr);
    const month = Number(moStr);
    const ymKey = `${year}|${month}|${item.branchCode}`;
    if (alatPeriodBranchLatestDate.get(ymKey) !== item.tanggal) continue;

    let entry = alatMonthlyAgg.get(ymKey);
    if (!entry) {
      entry = {
        year,
        month,
        branchCode: item.branchCode,
        branchName: getBranchNameByCode(item.branchCode) || item.namaCabang,
        tanggal: item.tanggal,
        total: 0,
        ready: 0,
      };
      alatMonthlyAgg.set(ymKey, entry);
    }
    entry.total++;
    if (item.kondisi === 'READY' || item.kondisi === 'READY DENGAN CATATAN') {
      entry.ready++;
    }
  }

  for (const agg of alatMonthlyAgg.values()) {
    const branchId = getBranchId(agg.branchCode, agg.branchName);
    const rfuPct = agg.total > 0 ? Number(((agg.ready / agg.total) * 100).toFixed(1)) : 0;
    const rfuAch = Number(((rfuPct / 90.0) * 100).toFixed(1));
    const color = rfuPct >= 90 ? 'green' : rfuPct >= 80 ? 'yellow' : 'red';
    const rfuRecId = `rec_alat_rfu_${agg.year}_${agg.month}_${agg.branchCode}`;
    const qtyRecId = `rec_alat_qty_${agg.year}_${agg.month}_${agg.branchCode}`;

    await stmtRec.run(
      rfuRecId,
      branchId,
      'dept_tek',
      'kpi_rfu',
      agg.month,
      agg.year,
      90.0,
      rfuPct,
      '%',
      rfuAch,
      color,
      `Kesiapan alat (RFU) snapshot ${agg.tanggal}: ${agg.ready}/${agg.total} unit siap operasi`,
      'google_sheets',
      'batch_mysteve_input_data',
      'verified',
      null,
      'regdashr@gmail.com',
      nowIso,
      'bod_regional',
      nowIso
    );

    await stmtRec.run(
      qtyRecId,
      branchId,
      'dept_tek',
      'kpi_alat_qty',
      agg.month,
      agg.year,
      Math.max(agg.total, 1),
      agg.total,
      'Unit',
      100.0,
      'green',
      `Populasi alat snapshot ${agg.tanggal}: ${agg.total} unit`,
      'google_sheets',
      'batch_mysteve_input_data',
      'verified',
      null,
      'regdashr@gmail.com',
      nowIso,
      'bod_regional',
      nowIso
    );
  }

  // 5. Ingest Commodity Revenue & Throughput from 'opkom'
  console.log('[Ingest] 5. Mengimpor Pendapatan & Trafik per Komoditas dari sheet opkom...');
  const opkomSheet = wb.Sheets['opkom'];
  const opkomRows: any[] = opkomSheet ? xlsx.utils.sheet_to_json(opkomSheet) : [];

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

    await stmtModOpkom.run(
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

        await stmtRec.run(
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
  const kinerjaRows: any[] = kinerjaSheet ? xlsx.utils.sheet_to_json(kinerjaSheet) : [];

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

    await stmtModKinerja.run(
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

      await stmtRec.run(
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
  await client.query(
    `
      INSERT INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::timestamptz)
      ON CONFLICT(service_name) DO UPDATE SET
        id = excluded.id,
        config_json = excluded.config_json,
        updated_at = excluded.updated_at
    `,
    [
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
    ]
  );

    // 8. Record in Audit Log
    const totalRecords = countFin + countUtil + countAlat + countOpkom + countKinerja;
    await client.query(
      `
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10)
      `,
      [
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
      ]
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
