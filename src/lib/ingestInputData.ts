import { getDb } from './db';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { OFFICIAL_BRANCHES } from './constants';

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
  if (row[name] !== undefined) return row[name];
  const target = name.trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === target) {
      return row[k];
    }
  }
  return undefined;
}

export function ingestInputData(filePath?: string) {
  const excelPath = filePath || path.join(process.cwd(), 'data', 'input_data.xlsx');

  if (!fs.existsSync(excelPath)) {
    throw new Error(`File input_data.xlsx tidak ditemukan di path: ${excelPath}`);
  }

  const db = getDb();
  console.log(`[Ingest] Membaca file spreadsheet resmi: ${excelPath}...`);
  const fileBuffer = fs.readFileSync(excelPath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

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
  const masterRows: any[][] = xlsx.utils.sheet_to_json(masterSheet, { header: 1 });

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
    db.exec("UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
    db.exec("DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");
  } catch {}

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

  // Statement for Monthly Records
  const stmtRec = db.prepare(`
    INSERT OR REPLACE INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  // 2. Ingest Financial Data from 'finansial'
  console.log('[Ingest] 2. Mengimpor Data Finansial dari sheet finansial...');
  const finSheet = wb.Sheets['finansial'];
  const finRows: any[] = finSheet ? xlsx.utils.sheet_to_json(finSheet) : [];

  let countFin = 0;
  for (const row of finRows) {
    const code = String(row['KODE_CBG'] || '').trim().toUpperCase();
    const branchName = String(row['NM_CBG'] || '').trim();
    const branchId = getBranchId(code, branchName);
    const rekening = String(row['REKENING'] || '').trim().toLowerCase();
    const year = Number(row['TAHUN'] || 2026);
    const month = Number(row['BULAN'] || 9);

    const konsolidasiRp = Number(row['KONSOLIDASI'] || row['CABANG'] || 0);
    const konsolidasiM = Number((konsolidasiRp / 1_000_000_000).toFixed(2));
    const rkaPct = Number(Number(row['RKA'] || 100).toFixed(1));
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
      `Data finansial ${row['REKENING']} dari spreadsheet input_data.xlsx (regdashr@gmail.com)`,
      'google_sheets',
      'batch_mysteve_input_data',
      'verified',
      null,
      'regdashr@gmail.com',
      new Date().toISOString(),
      'bod_regional',
      new Date().toISOString()
    );
    countFin++;
  }

  // 3. Ingest Utilization Data from 'utilisasi' (BOR, YOR, SOR)
  console.log('[Ingest] 3. Mengimpor Data Utilisasi Dermaga & Lapangan dari sheet utilisasi...');
  const utilSheet = wb.Sheets['utilisasi'];
  const utilRows: any[] = utilSheet ? xlsx.utils.sheet_to_json(utilSheet) : [];

  let countUtil = 0;
  for (const row of utilRows) {
    const code = String(row['KODE_CBG'] || '').trim().toUpperCase();
    const branchName = String(row['NM_CBG'] || '').trim();
    const branchId = getBranchId(code, branchName);
    const year = Number(row['TAHUN'] || 2026);
    const month = Number(row['BULAN'] || 9);
    const dermagaType = String(row['DERMAGA'] || 'MULTIPURPOSE');

    const bor = Number(row['BOR'] || 0);
    const yor = Number(row['YOR'] || 0);
    const sor = Number(row['SOR'] || 0);

    if (bor > 0) {
      const borPct = Number(((bor / 60) * 100).toFixed(1));
      const borColor = bor <= 65 ? 'green' : bor <= 75 ? 'yellow' : 'red';
      stmtRec.run(
        `rec_util_${year}_${month}_${code}_bor_${dermagaType.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
      );
      countUtil++;
    }
  }

  // 4. Ingest Equipment & Readiness from 'peralatan'
  console.log('[Ingest] 4. Mengimpor Data Kesiapan & Utilisasi Alat dari sheet peralatan...');
  const alatSheet = wb.Sheets['peralatan'];
  const alatRows: any[] = alatSheet ? xlsx.utils.sheet_to_json(alatSheet) : [];

  let countAlat = 0;
  for (const row of alatRows) {
    const code = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const branchName = String(getField(row, 'NM_CBG') || '').trim();
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const alatName = String(getField(row, 'NM_ALAT') || getField(row, 'KD_ALAT') || 'Alat');
    const singkatan = String(getField(row, 'SINGKATAN_ALAT') || getField(row, 'SINGKT') || '');

    const util = Number(getField(row, 'UTILISASI') || 0);
    const avail = Number(getField(row, 'AVAILABILITY') || 0);
    const jumlah = Number(getField(row, 'JUMLAH') || 0);

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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
      );
      countAlat++;
    }

    if (jumlah > 0) {
      const recId = `rec_alat_qty_${year}_${month}_${code}_${singkatan || 'alat'}`;
      stmtRec.run(
        recId,
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
      );
      countAlat++;
    }
  }

  // 5. Ingest Commodity Revenue from 'opkom'
  console.log('[Ingest] 5. Mengimpor Pendapatan per Komoditas dari sheet opkom...');
  const opkomSheet = wb.Sheets['opkom'];
  const opkomRows: any[] = opkomSheet ? xlsx.utils.sheet_to_json(opkomSheet) : [];

  let countOpkom = 0;
  for (const row of opkomRows) {
    const code = String(getField(row, 'KODE_CBG') || '').trim().toUpperCase();
    const branchName = String(getField(row, 'NM_CBG') || '').trim();
    const branchId = getBranchId(code, branchName);
    const year = Number(getField(row, 'TAHUN') || 2026);
    const month = Number(getField(row, 'BULAN') || 9);
    const layanan = String(getField(row, 'LAYANAN') || '').toUpperCase();
    const jumlahRp = Number(getField(row, 'JUMLAH') || 0);
    const jumlahM = Number((jumlahRp / 1_000_000_000).toFixed(2));
    const rkaPct = Number(Number(getField(row, 'RKA') || 100).toFixed(1));
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
        `rec_opkom_${year}_${month}_${code}_${layanan.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
      );
      countOpkom++;
    }
  }

  // 6. Ingest Operational KPIs from 'kinerja'
  console.log('[Ingest] 6. Mengimpor Kinerja Operasional Kapal, Barang, & Petikemas dari sheet kinerja...');
  const kinerjaSheet = wb.Sheets['kinerja'];
  const kinerjaRows: any[] = kinerjaSheet ? xlsx.utils.sheet_to_json(kinerjaSheet) : [];

  let countKinerja = 0;
  for (const row of kinerjaRows) {
    const code = String(row['KODE_CBG'] || '').trim().toUpperCase();
    const branchName = String(row['NM_CBG'] || '').trim();
    const branchId = getBranchId(code, branchName);
    const year = Number(row['TAHUN'] || 2026);
    const month = Number(row['BULAN'] || 9);
    const kdKine = String(row['KD_KINE'] || '').trim();
    const nmKine = String(row['NM_KINE'] || '').trim().toUpperCase();
    const satuan = String(row['SATUAN'] || '').trim();
    const nilai = Number(row['NILAI'] || 0);

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

    if (indId && nilai > 0) {
      const achPct = isHigherBetter
        ? Number(((nilai / target) * 100).toFixed(1))
        : Number(((target / Math.max(nilai, 0.01)) * 100).toFixed(1));
      const color = achPct >= 100 ? 'green' : achPct >= 90 ? 'yellow' : 'red';

      stmtRec.run(
        `rec_kine_${year}_${month}_${code}_${indId}`,
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
        new Date().toISOString(),
        'bod_regional',
        new Date().toISOString()
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
    'regdashr@gmail.com (Google Drive Sync)',
    'super_admin',
    'IMPORT',
    'GOOGLE_DRIVE_EXCEL',
    'input_data.xlsx',
    `Sukses sinkronisasi file input_data.xlsx akun regdashr@gmail.com: ${countBranches} cabang master, ${countEquip} katalog alat, dan total ${totalRecords} records kinerja operasional & finansial.`,
    new Date().toISOString(),
    '127.0.0.1'
  );

  console.log(`\n======================================================
SUKSES BESAR! Data master dan inputan berhasil diimpor:
- Master Cabang Pelabuhan : ${countBranches} cabang (R01-R80, R99)
- Master Katalog Peralatan: ${countEquip} jenis alat (AL01-AL21)
- Data Finansial          : ${countFin} rekaman (Pendapatan, Beban, Laba)
- Data Utilisasi          : ${countUtil} rekaman (BOR, YOR, SOR)
- Data Kesiapan Alat      : ${countAlat} rekaman (RFU & Utilisasi)
- Data Komoditas (Opkom)  : ${countOpkom} rekaman (Kapal, Petikemas, Barang)
- Data Kinerja Operasional: ${countKinerja} rekaman (WTP, BSH, BCH, TGH, TSD)
------------------------------------------------------
Total Records Terimpor    : ${totalRecords}
Sumber Data Akun          : regdashr@gmail.com (My Drive input_data.xlsx)
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
}
