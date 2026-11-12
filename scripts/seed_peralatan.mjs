#!/usr/bin/env node
/**
 * Standalone Seeder & Parser untuk Modul Peralatan Pelabuhan (9 Kolom Standar)
 *
 * Penggunaan:
 *   node scripts/seed_peralatan.mjs                   (default: data/peralatan.xlsx)
 *   node scripts/seed_peralatan.mjs data/peralatan.csv
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
const { Pool } = require('pg');

const cwd = process.cwd();

// Muat .env bila belum disetel pada shell
const envPath = path.join(cwd, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const BRANCH_CODE_OVERRIDES = {
  tpkambon: 'R07',
  ambon: 'R07',
  mtibitung: 'R05',
  terminalpetikemasbitung: 'R06',
  tpkbitung: 'R06',
  bitung: 'R05',
  tpkjayapura: 'R09',
  jayapura: 'R09',
  tpkkendari: 'R13',
  kendari: 'R13',
  tpkmerauke: 'R16',
  merauke: 'R16',
  tpkpantoloan: 'R11',
  pantoloan: 'R11',
  tpksorong: 'R08',
  sorong: 'R08',
  tpktarakan: 'R10',
  tarakan: 'R10',
  tpkternate: 'R12',
  ternate: 'R12',
  terminalpetikemasmakassar: 'R02',
  tpkmakassar: 'R02',
  mtimakassar: 'R01',
  pmtmakassar: 'R01',
  makassarnewport: 'R24',
  makassar: 'R01',
  balikpapan: 'R04',
  samarinda: 'R03',
  parepare: 'R14',
  biak: 'R15',
  manokwari: 'R17',
  nunukan: 'R18',
  tgredeb: 'R19',
  gorontalo: 'R20',
  fakfak: 'R21',
  tolitoli: 'R22',
  kkt: 'R26',
};

function resolveBranchCode(namaCabang) {
  const cleaned = String(namaCabang || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return BRANCH_CODE_OVERRIDES[cleaned] || 'R99';
}

function slugKey(val) {
  return String(val || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Parser CSV sesuai RFC-4180: mendukung tanda kutip ganda "...",
 * escaped quotes (""), koma dalam sel, dan karakter newline (\n / \r\n) di dalam sel.
 */
function parseCsvRows(csvText) {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (i + 1 < cleanText.length && cleanText[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

function normalizeTanggalISO(val) {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const p = xlsx.SSF.parse_date_code(val);
    if (p) {
      return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    }
  }
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (/^\d{5}(\.\d+)?$/.test(raw)) return normalizeTanggalISO(Number(raw));
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  return '';
}

function normalizeKondisi(val) {
  const cleaned = String(val ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!cleaned) return 'READY';
  if (cleaned === 'READY') return 'READY';
  if (cleaned.includes('CATATAN')) return 'READY DENGAN CATATAN';
  if (cleaned.includes('BREAKDOWN') || cleaned.includes('RUSAK')) return 'BREAKDOWN';
  if (cleaned.includes('USUL') || cleaned.includes('PENGHAPUSAN')) return 'USUL/PROSES PENGHAPUSAN';
  return cleaned;
}

function normalizeNullableText(val) {
  if (val === null || val === undefined) return null;
  const text = String(val).replace(/\r\n/g, '\n').trim();
  if (!text || text === '-' || text === '—' || text === '--' || text.toLowerCase() === 'null') {
    return null;
  }
  return text;
}

function parseDatasetMatrix(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  let matrix;
  if (ext === '.csv') {
    matrix = parseCsvRows(fs.readFileSync(inputPath, 'utf8'));
  } else {
    const wb = xlsx.readFile(inputPath);
    const sheetName = wb.SheetNames.find((s) => ['alat', 'peralatan'].includes(s.toLowerCase())) || wb.SheetNames[0];
    matrix = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  }

  const nonEmpty = matrix.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
  let headerIdx = nonEmpty.findIndex((r) =>
    r.some((c) => String(c ?? '').trim().toLowerCase() === 'tanggal' || String(c ?? '').trim().toLowerCase() === 'grup / entitas')
  );
  if (headerIdx < 0) headerIdx = 0;

  const headers = (nonEmpty[headerIdx] || []).map((c) => String(c ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  const idxOf = (aliases, fallback) => {
    for (const a of aliases) {
      const i = headers.indexOf(a);
      if (i >= 0) return i;
    }
    return fallback;
  };

  const cTanggal = idxOf(['tanggal'], 0);
  const cGrup = idxOf(['grup / entitas', 'grup/entitas', 'grup_entitas'], 1);
  const cCabang = idxOf(['nama cabang', 'nama_cabang'], 2);
  const cNama = idxOf(['nama alat', 'nama_alat'], 3);
  const cJenis = idxOf(['jenis alat', 'jenis_alat'], 4);
  const cKat = idxOf(['kategori alat', 'kategori_alat'], 5);
  const cKondisi = idxOf(['kondisi'], 6);
  const cRusak = idxOf(['kerusakan'], 7);
  const cTindak = idxOf(['tindak lanjut', 'tindak_lanjut'], 8);

  const records = [];
  for (let i = headerIdx + 1; i < nonEmpty.length; i++) {
    const r = nonEmpty[i];
    const tanggal = normalizeTanggalISO(r[cTanggal]);
    if (!tanggal) continue;
    const namaCabang = String(r[cCabang] ?? '').trim();
    const namaAlat = String(r[cNama] ?? '').trim();
    if (!namaCabang || !namaAlat) continue;

    const branchCode = resolveBranchCode(namaCabang);
    const [yr, mo] = tanggal.split('-');
    const seq = records.length + 1;

    records.push({
      id: `mod_alat_${tanggal}_${slugKey(branchCode)}_${seq}`,
      monthlyRecordId: `rec_alat_rfu_${Number(yr)}_${Number(mo)}_${branchCode}`,
      branchCode,
      tanggal,
      grupEntitas: String(r[cGrup] ?? '').trim().toUpperCase() || 'R4',
      namaCabang,
      namaAlat,
      jenisAlat: String(r[cJenis] ?? '').trim() || 'Lainnya',
      kategoriAlat: String(r[cKat] ?? '').trim() || 'Alat CY',
      kondisi: normalizeKondisi(r[cKondisi]),
      kerusakan: normalizeNullableText(r[cRusak]),
      tindakLanjut: normalizeNullableText(r[cTindak]),
    });
  }
  return records;
}

async function main() {
  const argPath = process.argv[2];
  const inputPath = argPath
    ? path.resolve(cwd, argPath)
    : fs.existsSync(path.join(cwd, 'data', 'peralatan.xlsx'))
      ? path.join(cwd, 'data', 'peralatan.xlsx')
      : path.join(cwd, 'data', 'peralatan.csv');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Dataset peralatan tidak ditemukan: ${inputPath}`);
  }

  const records = parseDatasetMatrix(inputPath);
  console.log(`[Seeder Peralatan] Parsed ${records.length} baris dari ${inputPath}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const nowIso = new Date().toISOString();

  try {
    await client.query('BEGIN');

    // Pastikan tabel module_peralatan memiliki kolom standar baru
    const colCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'module_peralatan' AND column_name = 'grup_entitas'
      ) AS has_new_cols
    `);
    if (!colCheck.rows[0]?.has_new_cols) {
      console.log('[Seeder Peralatan] Skema lama terdeteksi, membuat ulang module_peralatan dari data/schema.sql...');
      await client.query('DROP TABLE IF EXISTS module_peralatan');
      await client.query(fs.readFileSync(path.join(cwd, 'data', 'schema.sql'), 'utf8'));
    }

    // Hapus seluruh data peralatan lama
    await client.query('DELETE FROM module_peralatan');

    const BATCH = 250;
    for (let start = 0; start < records.length; start += BATCH) {
      const chunk = records.slice(start, start + BATCH);
      const values = [];
      const params = [];
      let p = 1;
      for (const item of chunk) {
        values.push(
          `($${p++}, $${p++}, $${p++}, $${p++}::date, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 'peralatan_seed', 'verified', 'regdashr@gmail.com', $${p++}::timestamptz, 'bod_regional', $${p++}::timestamptz)`
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
      }
      await client.query(
        `INSERT INTO module_peralatan (
          id, monthly_record_id, branch_code, tanggal, grup_entitas, nama_cabang,
          nama_alat, jenis_alat, kategori_alat, kondisi, kerusakan, tindak_lanjut,
          source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
        ) VALUES ${values.join(', ')}`,
        params
      );
    }

    await client.query('COMMIT');
    console.log(`[Seeder Peralatan] Sukses mengimpor ${records.length} baris ke PostgreSQL module_peralatan.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Seeder Peralatan] Error:', err);
  process.exit(1);
});

