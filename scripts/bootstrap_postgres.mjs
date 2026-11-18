#!/usr/bin/env node
/**
 * scripts/bootstrap_postgres.mjs
 *
 * Inisialisasi skema PostgreSQL (`data/schema.sql`), master referensi
 * (cabang, departemen, indikator KPI, katalog peralatan), dan akun pengguna
 * awal dari `data/master_user_pic.xlsx` secara idempoten.
 *
 * Dipakai oleh CI/CD, lingkungan staging, maupun instalasi database baru.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { randomBytes, scryptSync } from 'crypto';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const xlsx = require('xlsx');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: environment variable DATABASE_URL wajib disetel.');
  process.exit(1);
}

const BRANCHES = [
  ['term_makassar', 'R01', 'Makassar', 1],
  ['term_tpk_makassar', 'R02', 'TPK Makassar', 2],
  ['term_samarinda', 'R03', 'Samarinda', 3],
  ['term_balikpapan', 'R04', 'Balikpapan', 4],
  ['term_bitung', 'R05', 'Bitung', 5],
  ['term_tpk_bitung', 'R06', 'TPK Bitung', 6],
  ['term_ambon', 'R07', 'Ambon', 7],
  ['term_sorong', 'R08', 'Sorong', 8],
  ['term_jayapura', 'R09', 'Jayapura', 9],
  ['term_tarakan', 'R10', 'Tarakan', 10],
  ['term_pantoloan', 'R11', 'Pantoloan', 11],
  ['term_ternate', 'R12', 'Ternate', 12],
  ['term_kendari', 'R13', 'Kendari', 13],
  ['term_parepare', 'R14', 'Parepare', 14],
  ['term_biak', 'R15', 'Biak', 15],
  ['term_merauke', 'R16', 'Merauke', 16],
  ['term_manokwari', 'R17', 'Manokwari', 17],
  ['term_nunukan', 'R18', 'Nunukan', 18],
  ['term_tg_redeb', 'R19', 'Tg Redeb', 19],
  ['term_gorontalo', 'R20', 'Gorontalo', 20],
  ['term_fakfak', 'R21', 'Fakfak', 21],
  ['term_tolitoli', 'R22', 'Tolitoli', 22],
  ['term_manado', 'R23', 'Manado', 23],
  ['term_makassar_new_port', 'R24', 'Makassar New Port', 24],
  ['term_bontang', 'R25', 'Bontang', 25],
  ['term_kkt', 'R26', 'KKT', 26],
  ['term_luwuk_tangkiang', 'R80', 'Luwuk Tangkiang', 27],
  ['term_regional_4', 'R99', 'Regional 4', 28],
];

const DEPARTMENTS = [
  ['dept_keu', 'KEU', 'Keuangan', 'PIC Keuangan', 'keu@pelindo.co.id', 'Divisi Finansial Regional 4'],
  ['dept_ops', 'OPS', 'Operasi & Pelayanan Kapal', 'PIC Operasi', 'ops@pelindo.co.id', 'Divisi Operasional & Kargo'],
  ['dept_pel', 'PEL', 'Komersial & Pelayanan Pelanggan', 'PIC Komersial', 'pel@pelindo.co.id', 'Divisi Komersial'],
  ['dept_tek', 'TEK', 'Teknik', 'PIC Teknik', 'tek@pelindo.co.id', 'Divisi Fasilitas & Peralatan'],
  ['dept_hsse', 'HSSE', 'HSSE', 'PIC HSSE', 'hsse@pelindo.co.id', 'Health, Safety, Security & Environment'],
  ['dept_sdm', 'SDM', 'SDM & Umum', 'PIC SDM', 'sdm@pelindo.co.id', 'Sumber Daya Manusia & Umum'],
];

const EQUIPMENT = [
  ['eq_qcc', 'QCC', 'Quay Container Crane', 'QCC', 'Alat Dermaga'],
  ['eq_rtg', 'RTG', 'Rubber Tyred Gantry', 'RTG', 'Alat CY'],
  ['eq_rs', 'RS', 'Reach Stacker', 'RS', 'Alat CY'],
  ['eq_tt', 'TT', 'Terminal Tractor', 'TT', 'Alat Angkut'],
  ['eq_fl', 'FL', 'Forklift', 'FL', 'Alat Bantu'],
  ['eq_mc', 'MC', 'Mobile Crane', 'MC', 'Alat Dermaga'],
];

const KPI_INDICATORS = [
  ['kpi_teus', 'OPS-TEUS', 'Arus Petikemas', 'dept_ops', 'Kargo', 'TEUs', 'higher_is_better', 1026000, true],
  ['kpi_cargo', 'OPS-CARGO', 'Arus Barang', 'dept_ops', 'Kargo', 'Ton', 'higher_is_better', 8300000, true],
  ['kpi_call', 'OPS-CALL', 'Kunjungan Kapal', 'dept_ops', 'Trafik', 'Call', 'higher_is_better', 1800, true],
  ['kpi_rev', 'KEU-REV', 'Pendapatan Usaha', 'dept_keu', 'Keuangan', 'Miliar Rp', 'higher_is_better', 2010, true],
  ['kpi_cost', 'KEU-COST', 'Beban Usaha', 'dept_keu', 'Keuangan', 'Miliar Rp', 'lower_is_better', 1425, true],
  ['kpi_profit', 'KEU-OP', 'Laba Usaha', 'dept_keu', 'Keuangan', 'Miliar Rp', 'higher_is_better', 585, true],
  ['kpi_net_profit', 'KEU-NET', 'Laba Bersih', 'dept_keu', 'Keuangan', 'Miliar Rp', 'higher_is_better', 450, true],
  ['kpi_rfu', 'TEK-RFU', 'Kesiapan Alat (RFU)', 'dept_tek', 'Keandalan', '%', 'higher_is_better', 92, true],
  ['kpi_bor', 'OPS-BOR', 'Berth Occupancy Ratio (BOR)', 'dept_ops', 'Fasilitas', '%', 'lower_is_better', 60, true],
  ['kpi_yor', 'OPS-YOR', 'Yard Occupancy Ratio (YOR)', 'dept_ops', 'Fasilitas', '%', 'lower_is_better', 60, false],
  ['kpi_sor', 'OPS-SOR', 'Storage Occupancy Ratio (SOR)', 'dept_ops', 'Fasilitas', '%', 'lower_is_better', 60, false],
  ['kpi_csat', 'PEL-CSAT', 'Indeks Kepuasan (CSAT)', 'dept_pel', 'Layanan', 'Skor 1-5', 'higher_is_better', 4, false],
  ['kpi_sla', 'PEL-SLA', 'SLA Keluhan', 'dept_pel', 'Layanan', '%', 'higher_is_better', 90, false],
  ['kpi_fatality', 'HSSE-FAT', 'Fatality', 'dept_hsse', 'Keselamatan', 'Kasus', 'lower_is_better', 0, false],
  ['kpi_lti', 'HSSE-LTI', 'Lost Time Injury', 'dept_hsse', 'Keselamatan', 'Kasus', 'lower_is_better', 0, false],
  ['kpi_util_alat', 'TEK-UTIL', 'Utilisasi Alat', 'dept_tek', 'Keandalan', '%', 'higher_is_better', 65, false],
  ['kpi_alat_qty', 'TEK-QTY', 'Populasi Alat Operasional', 'dept_tek', 'Keandalan', 'Unit', 'higher_is_better', 5, false],
  ['kpi_ship_rev', 'OPS-SHIP-REV', 'Pendapatan Layanan Kapal', 'dept_ops', 'Komersial', 'Miliar Rp', 'higher_is_better', 100, false],
  ['kpi_teus_rev', 'OPS-TEUS-REV', 'Pendapatan Layanan Petikemas', 'dept_ops', 'Komersial', 'Miliar Rp', 'higher_is_better', 150, false],
  ['kpi_cargo_rev', 'OPS-CARGO-REV', 'Pendapatan Layanan Barang', 'dept_ops', 'Komersial', 'Miliar Rp', 'higher_is_better', 80, false],
  ['kpi_pax_rev', 'OPS-PAX-REV', 'Pendapatan Layanan Penumpang', 'dept_ops', 'Komersial', 'Miliar Rp', 'higher_is_better', 20, false],
  ['kpi_misc_rev', 'OPS-MISC-REV', 'Pendapatan Rupa-rupa', 'dept_ops', 'Komersial', 'Miliar Rp', 'higher_is_better', 15, false],
  ['kpi_wtp', 'OPS-WTP', 'Waiting Time to Pilot (WTP)', 'dept_ops', 'Kinerja', 'Jam', 'lower_is_better', 1, false],
  ['kpi_bsh', 'OPS-BSH', 'Box / Ship / Hour (BSH)', 'dept_ops', 'Kinerja', 'Box/Jam', 'higher_is_better', 25, false],
  ['kpi_bch', 'OPS-BCH', 'Box / Crane / Hour (BCH)', 'dept_ops', 'Kinerja', 'Box/Jam', 'higher_is_better', 20, false],
  ['kpi_tgh_dry', 'OPS-TGH-DRY', 'TGH Curah Kering', 'dept_ops', 'Kinerja', 'Ton/Jam', 'higher_is_better', 150, false],
  ['kpi_tsd_dry', 'OPS-TSD-DRY', 'TSD Curah Kering', 'dept_ops', 'Kinerja', 'Ton/Hari', 'higher_is_better', 2000, false],
  ['kpi_tgh_liq', 'OPS-TGH-LIQ', 'TGH Curah Cair', 'dept_ops', 'Kinerja', 'Ton/Jam', 'higher_is_better', 120, false],
  ['kpi_tsd_liq', 'OPS-TSD-LIQ', 'TSD Curah Cair', 'dept_ops', 'Kinerja', 'Ton/Hari', 'higher_is_better', 1800, false],
  ['kpi_tgh_gc', 'OPS-TGH-GC', 'TGH General Cargo', 'dept_ops', 'Kinerja', 'Ton/Jam', 'higher_is_better', 40, false],
  ['kpi_tsd_gc', 'OPS-TSD-GC', 'TSD General Cargo', 'dept_ops', 'Kinerja', 'Ton/Hari', 'higher_is_better', 600, false],
];

function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const schemaPath = path.resolve(process.cwd(), 'data', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('[Bootstrap PG] Skema data/schema.sql berhasil diterapkan.');

    for (const [id, code, name, orderSeq] of BRANCHES) {
      await client.query(
        `INSERT INTO branches (id, code, name, region, address, phone, email, active, order_seq)
         VALUES ($1, $2, $3, 'Regional 4', $4, '0411-123456', $5, true, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, code, name, `Pelabuhan ${name}`, `${code.toLowerCase()}@pelindo.co.id`, orderSeq]
      );
    }

    for (const [id, code, name, picName, picEmail, desc] of DEPARTMENTS) {
      await client.query(
        `INSERT INTO departments (id, code, name, pic_name, pic_email, active, description)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, code, name, picName, picEmail, desc]
      );
    }

    for (const [id, code, name, acronym, category] of EQUIPMENT) {
      await client.query(
        `INSERT INTO equipment_catalog (id, code, name, acronym, category, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO NOTHING`,
        [id, code, name, acronym, category]
      );
    }

    for (const [id, code, name, deptId, category, unit, direction, target, isCore] of KPI_INDICATORS) {
      await client.query(
        `INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, default_target, is_core_kpi, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         ON CONFLICT (id) DO NOTHING`,
        [id, code, name, deptId, category, unit, direction, target, isCore]
      );
    }

    console.log('[Bootstrap PG] Data master referensi (cabang, departemen, alat, KPI) terverifikasi.');

    const defaultPassword = process.env.BOOTSTRAP_PIC_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;
    const masterUserFile = path.resolve(process.cwd(), 'data', 'master_user_pic.xlsx');

    if (defaultPassword && fs.existsSync(masterUserFile)) {
      if (defaultPassword.length < 12) {
        console.error(
          '[Bootstrap PG] Error: BOOTSTRAP_PIC_PASSWORD / SEED_DEFAULT_PASSWORD minimal 12 karakter.'
        );
        process.exit(1);
      }
      // SA-26: Default must_change_password=true for seeded accounts; CI test suites
      // opt out explicitly via BOOTSTRAP_TEST_READY=true.
      const mustChangePassword = process.env.BOOTSTRAP_TEST_READY !== 'true';
      const wb = xlsx.readFile(masterUserFile);
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      for (const r of rows) {
        const nipp = String(r['NIPP (USERNAME)'] || '').trim();
        if (!nipp) continue;
        const name = String(r['NAMA LENGKAP'] || nipp).trim();
        const divisi = String(r['DIVISI'] || '').trim();
        const departemen = String(r['DEPARTEMEN'] || '').trim();
        const role = String(r['HAK AKSES (ROLE)'] || 'viewer').trim();
        const branchId = String(r['CABANG'] || 'R99').trim();
        const email = String(r['EMAIL'] || `${nipp}@pelindo.co.id`).trim();
        const id = `usr_${nipp}`;
        // SA-26: Derive a unique random scrypt salt & hash per user account.
        const passwordHash = hashPassword(defaultPassword);

        await client.query(
          `INSERT INTO users (id, username, nipp, name, email, divisi, departemen, role, branch_id, password_hash, active, must_change_password)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
           ON CONFLICT (username) DO NOTHING`,
          [id, nipp, nipp, name, email, divisi, departemen, role, branchId, passwordHash, mustChangePassword]
        );
      }
      console.log(`[Bootstrap PG] Seed akun pengguna dari master_user_pic.xlsx selesai (${rows.length} baris diproses).`);
    } else {
      console.log('[Bootstrap PG] Melewati seed pengguna (BOOTSTRAP_PIC_PASSWORD tidak disetel atau master_user_pic.xlsx tidak ditemukan).');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[Bootstrap PG] Gagal:', err);
  process.exit(1);
});

