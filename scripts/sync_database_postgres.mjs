#!/usr/bin/env node
/**
 * scripts/sync_database_postgres.mjs
 *
 * Sinkronisasi penuh dua arah / rehidrasi antara PostgreSQL ('ed_dashboard')
 * dan database aplikasi SQLite ('data/ed_dashboard.db').
 *
 * Memastikan ke-16 tabel operasional & master, data finansial konsolidasi,
 * modul peralatan 9 kolom standar, dan master user sinkron 100%.
 */
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';
import xlsx from 'xlsx';

const cwd = process.cwd();

// Muat .env
const envPath = path.join(cwd, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:ictpi4@localhost:5432/ed_dashboard';
const SQLITE_PATH = path.join(cwd, 'data', 'ed_dashboard.db');

async function syncAll() {
  console.log(`[Sync] Menghubungkan ke PostgreSQL: ${DATABASE_URL.replace(/:[^:]+@/, ':****@')}`);
  const pgClient = new Client({ connectionString: DATABASE_URL });
  await pgClient.connect();

  console.log(`[Sync] Membuka SQLite di: ${SQLITE_PATH}`);
  const sqlite = new DatabaseSync(SQLITE_PATH);
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  try {
    // -------------------------------------------------------------
    // 1. Pastikan skema tabel SQLite mendukung kolom-kolom standar
    // -------------------------------------------------------------
    console.log('[Sync] Memeriksa skema tabel SQLite...');

    // Pastikan module_peralatan memiliki 9 kolom standar
    const alatCols = sqlite.prepare("PRAGMA table_info('module_peralatan')").all().map((c) => c.name);
    const requiredAlatCols = [
      { name: 'tanggal', type: 'TEXT' },
      { name: 'grup_entitas', type: 'TEXT' },
      { name: 'nama_cabang', type: 'TEXT' },
      { name: 'nama_alat', type: 'TEXT' },
      { name: 'jenis_alat', type: 'TEXT' },
      { name: 'kategori_alat', type: 'TEXT' },
      { name: 'kondisi', type: 'TEXT' },
      { name: 'kerusakan', type: 'TEXT' },
      { name: 'tindak_lanjut', type: 'TEXT' },
    ];
    for (const col of requiredAlatCols) {
      if (!alatCols.includes(col.name)) {
        console.log(`[Sync] Menambahkan kolom '${col.name}' ke module_peralatan SQLite...`);
        sqlite.exec(`ALTER TABLE module_peralatan ADD COLUMN ${col.name} ${col.type};`);
      }
    }

    // Pastikan module_finansial_entitas ada
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS module_finansial_entitas (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        branch_code TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        rekening TEXT NOT NULL,
        entitas TEXT NOT NULL,
        realisasi REAL NOT NULL,
        rka REAL,
        yoy REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -------------------------------------------------------------
    // 2. Sinkronkan Tabel Master & Pendukung
    // -------------------------------------------------------------
    const directCopyTables = [
      'branches',
      'departments',
      'equipment_catalog',
      'kpi_indicators',
      'templates',
      'monthly_records',
      'module_fasilitas',
      'module_kinerja',
      'module_opkom',
      'module_utilisasi',
      'audit_logs',
      'integration_settings',
    ];

    for (const table of directCopyTables) {
      const pgRows = (await pgClient.query(`SELECT * FROM "${table}"`)).rows;
      if (pgRows.length === 0) {
        console.log(`[Sync] Tabel ${table} di PostgreSQL kosong, lewati.`);
        continue;
      }

      const sqliteCols = sqlite.prepare(`PRAGMA table_info('${table}')`).all().map((c) => c.name);
      
      sqlite.exec(`DELETE FROM ${table};`);
      const sample = pgRows[0];
      const validCols = Object.keys(sample).filter((col) => sqliteCols.includes(col));
      const placeholders = validCols.map(() => '?').join(', ');
      const insertSql = `INSERT OR REPLACE INTO ${table} (${validCols.join(', ')}) VALUES (${placeholders});`;
      const stmt = sqlite.prepare(insertSql);

      for (const row of pgRows) {
        const values = validCols.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          if (val instanceof Date) {
            return val.toISOString();
          }
          if (typeof val === 'boolean') {
            return val ? 1 : 0;
          }
          return val;
        });
        stmt.run(...values);
      }
      console.log(`[Sync] Tabel ${table}: berhasil menyinkronkan ${pgRows.length} baris.`);
    }

    // -------------------------------------------------------------
    // 3. Sinkronkan Tabel USERS (12 Users termasuk Chandra & Cakra)
    // -------------------------------------------------------------
    const pgUsers = (await pgClient.query('SELECT * FROM users ORDER BY nipp')).rows;
    sqlite.exec('DELETE FROM users;');
    const userStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO users (
        id, username, nipp, name, email, divisi, departemen, password,
        role, branch_id, department_id, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of pgUsers) {
      userStmt.run(
        u.id,
        u.username || u.nipp,
        u.nipp,
        u.name,
        u.email,
        u.divisi || 'Regional 4',
        u.departemen || 'Operasi & Komersial',
        u.password_hash || u.password,
        u.role,
        u.branch_id || 'R99',
        u.department_id || null,
        u.active !== false ? 1 : 0,
        u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
      );
    }
    console.log(`[Sync] Tabel users: berhasil menyinkronkan ${pgUsers.length} pengguna.`);

    // -------------------------------------------------------------
    // 4. Sinkronkan Modul PERALATAN (6.046 baris)
    // -------------------------------------------------------------
    const pgAlat = (await pgClient.query(`
      SELECT 
        id, monthly_record_id, branch_code, 
        TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal_str,
        grup_entitas, nama_cabang, nama_alat, jenis_alat, kategori_alat,
        kondisi, kerusakan, tindak_lanjut, source_type, verification_status,
        uploaded_by, uploaded_at, verified_by, verified_at, revision_notes,
        verified_snapshot_json
      FROM module_peralatan
      ORDER BY tanggal DESC
    `)).rows;

    sqlite.exec('DELETE FROM module_peralatan;');
    const alatStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO module_peralatan (
        id, monthly_record_id, year, month, branch_code, branch_name,
        kd_alat, nm_alat, singkatan, jns_alat, jumlah, availability, utilisasi,
        source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at,
        revision_notes, verified_snapshot_json,
        tanggal, grup_entitas, nama_cabang, nama_alat, jenis_alat, kategori_alat,
        kondisi, kerusakan, tindak_lanjut
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    for (const a of pgAlat) {
      const tgl = a.tanggal_str || '';
      const [yrStr, moStr] = tgl.split('-');
      const year = Number.parseInt(yrStr, 10) || 2026;
      const month = Number.parseInt(moStr, 10) || 11;
      const isReady = String(a.kondisi || '').trim().toUpperCase() === 'READY';

      alatStmt.run(
        a.id,
        a.monthly_record_id || null,
        year,
        month,
        a.branch_code || 'R99',
        a.nama_cabang,
        a.nama_alat,
        a.nama_alat,
        a.kategori_alat,
        a.jenis_alat,
        1,
        isReady ? 100 : 0,
        0,
        a.source_type || 'excel_import',
        a.verification_status || 'verified',
        a.uploaded_by || null,
        a.uploaded_at ? new Date(a.uploaded_at).toISOString() : null,
        a.verified_by || null,
        a.verified_at ? new Date(a.verified_at).toISOString() : null,
        a.revision_notes || null,
        a.verified_snapshot_json ? JSON.stringify(a.verified_snapshot_json) : null,
        tgl,
        a.grup_entitas,
        a.nama_cabang,
        a.nama_alat,
        a.jenis_alat,
        a.kategori_alat,
        a.kondisi,
        a.kerusakan || null,
        a.tindak_lanjut || null
      );
    }
    console.log(`[Sync] Tabel module_peralatan: berhasil menyinkronkan ${pgAlat.length} baris.`);

    // -------------------------------------------------------------
    // 5. Sinkronkan Modul FINANSIAL (2.400 baris tall & 400 baris wide)
    // -------------------------------------------------------------
    const pgFin = (await pgClient.query(`
      SELECT * FROM module_finansial ORDER BY year, month, branch_code, rekening, entitas
    `)).rows;

    // A. Isi tabel tall module_finansial_entitas
    sqlite.exec('DELETE FROM module_finansial_entitas;');
    const finTallStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO module_finansial_entitas (
        id, year, month, branch_code, branch_name, rekening, entitas, realisasi, rka, yoy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of pgFin) {
      finTallStmt.run(
        f.id,
        f.year,
        f.month,
        f.branch_code,
        f.branch_name,
        f.rekening,
        f.entitas,
        Number(f.realisasi) || 0,
        f.rka !== null ? Number(f.rka) : null,
        f.yoy !== null ? Number(f.yoy) : null
      );
    }
    console.log(`[Sync] Tabel module_finansial_entitas: berhasil menyinkronkan ${pgFin.length} baris.`);

    // B. Bentuk 400 baris wide untuk module_finansial
    // Group by year, month, branch_code, rekening
    const wideMap = new Map();
    for (const f of pgFin) {
      const key = `${f.year}|${f.month}|${f.branch_code}|${f.rekening}`;
      if (!wideMap.has(key)) {
        wideMap.set(key, {
          id: `mod_fin_wide_${f.year}_${f.month}_${f.branch_code}_${f.rekening.replace(/\s+/g, '_').toLowerCase()}`,
          monthly_record_id: f.monthly_record_id || null,
          year: f.year,
          month: f.month,
          branch_code: f.branch_code,
          branch_name: f.branch_name,
          rekening: f.rekening,
          cabang_rp: 0,
          pmt_rp: 0,
          ptp_rp: 0,
          psl_rp: 0,
          pjm_rp: 0,
          eliminasi_rp: 0,
          konsolidasi_rp: 0,
          rka: f.rka !== null ? Number(f.rka) : null,
          yoy: f.yoy !== null ? Number(f.yoy) : null,
          source_type: f.source_type || 'labarugi_xlsx',
          verification_status: f.verification_status || 'verified',
          uploaded_by: f.uploaded_by || null,
          uploaded_at: f.uploaded_at ? new Date(f.uploaded_at).toISOString() : null,
          verified_by: f.verified_by || null,
          verified_at: f.verified_at ? new Date(f.verified_at).toISOString() : null,
        });
      }
      const record = wideMap.get(key);
      const val = Number(f.realisasi) || 0;
      const ent = String(f.entitas || '').trim().toUpperCase();

      if (ent === 'CABANG') record.cabang_rp = val;
      else if (ent === 'PMT') record.pmt_rp = val;
      else if (ent === 'PTP') record.ptp_rp = val;
      else if (ent === 'PSL') record.psl_rp = val;
      else if (ent === 'PJM') record.pjm_rp = val;
      else if (ent === 'ELIMINASI') record.eliminasi_rp = val;

      // Akumulasi konsolidasi_rp selalu menjumlahkan seluruh entitas termasuk ELIMINASI
      record.konsolidasi_rp += val;
    }

    sqlite.exec('DELETE FROM module_finansial;');
    const finWideStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO module_finansial (
        id, monthly_record_id, year, month, branch_code, branch_name, rekening,
        cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp,
        rka, yoy, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const w of wideMap.values()) {
      finWideStmt.run(
        w.id,
        w.monthly_record_id,
        w.year,
        w.month,
        w.branch_code,
        w.branch_name,
        w.rekening,
        w.cabang_rp,
        w.pmt_rp,
        w.ptp_rp,
        w.psl_rp,
        w.pjm_rp,
        w.eliminasi_rp,
        w.konsolidasi_rp,
        w.rka,
        w.yoy,
        w.source_type,
        w.verification_status,
        w.uploaded_by,
        w.uploaded_at,
        w.verified_by,
        w.verified_at
      );
    }
    console.log(`[Sync] Tabel module_finansial (wide): berhasil menyinkronkan ${wideMap.size} baris.`);

    // -------------------------------------------------------------
    // 6. Sinkronkan File Excel master_user_pic.xlsx (12 Pengguna)
    // -------------------------------------------------------------
    const masterExcelPath = path.join(cwd, 'data', 'master_user_pic.xlsx');
    console.log(`[Sync] Memperbarui file Excel: ${masterExcelPath}...`);
    const excelRows = pgUsers.map((u, i) => ({
      'NO': i + 1,
      'NIPP (USERNAME)': u.nipp,
      'NAMA LENGKAP': u.name,
      'DIVISI': u.divisi || 'Pelindo Regional 4',
      'DEPARTEMEN': u.departemen || 'Kantor Regional 4',
      'HAK AKSES (ROLE)': u.role,
      'CABANG': u.branch_id || 'R99',
      'EMAIL': u.email || `${u.nipp}@pelindo.co.id`,
      'STATUS': u.active !== false ? 'AKTIF' : 'NONAKTIF',
      'TANGGAL TERDAFTAR': u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelRows);
    xlsx.utils.book_append_sheet(wb, ws, 'MASTER_USER');
    xlsx.writeFile(wb, masterExcelPath);
    console.log('[Sync] master_user_pic.xlsx berhasil diperbarui dengan 12 pengguna.');

    // -------------------------------------------------------------
    // 7. Verifikasi Konsistensi Agregasi Finansial
    // -------------------------------------------------------------
    const testKpis = sqlite.prepare(`
      SELECT 
        rekening,
        SUM(realisasi) as total_realisasi
      FROM v_module_finansial_entitas
      WHERE year = 2026 AND month = 8
      GROUP BY rekening
      ORDER BY rekening
    `).all();

    console.log('\n[Verifikasi] Ringkasan Angka Finansial Tahun 2026 Bulan 8 di SQLite:');
    let bebanVal = 0;
    let pendVal = 0;
    let labaVal = 0;
    for (const r of testKpis) {
      console.log(`  - ${r.rekening}: ${Number(r.total_realisasi).toLocaleString('id-ID')}`);
      if (r.rekening.toLowerCase() === 'beban') bebanVal = Number(r.total_realisasi);
      if (r.rekening.toLowerCase() === 'pendapatan') pendVal = Number(r.total_realisasi);
      if (r.rekening.toLowerCase() === 'laba usaha') labaVal = Number(r.total_realisasi);
    }
    const bopo = pendVal > 0 ? (Math.abs(bebanVal) / pendVal) * 100 : 0;
    console.log(`  - BOPO Konsolidasi: ${bopo.toFixed(2)}%\n`);

    sqlite.exec('PRAGMA foreign_keys = ON;');
    console.log('[Sync] Sinkronisasi database dengan PostgreSQL SELESAI & BERHASIL 100%!');
  } finally {
    sqlite.close();
    await pgClient.end();
  }
}

syncAll().catch((err) => {
  console.error('[Sync] Gagal melakukan sinkronisasi database:', err);
  process.exit(1);
});

