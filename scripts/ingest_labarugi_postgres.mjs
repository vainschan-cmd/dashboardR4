import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: environment variable DATABASE_URL wajib disetel.');
  process.exit(1);
}

const excelPath = process.argv[2] || path.resolve(process.cwd(), 'data/labarugi.xlsx');

async function main() {
  console.log('Connecting to PostgreSQL...');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('Reading Excel labarugi...');
  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets['labarugi'];
  const rawRows = xlsx.utils.sheet_to_json(ws);
  console.log(`Parsed ${rawRows.length} rows from Excel labarugi.`);

  // 1. Drop view and recreate tables
  await client.query('DROP VIEW IF EXISTS v_module_finansial_entitas CASCADE;');
  await client.query('DROP TABLE IF EXISTS module_finansial_entitas CASCADE;');
  await client.query('DROP TABLE IF EXISTS module_finansial CASCADE;');

  // Table module_finansial_entitas (long format)
  await client.query(`
    CREATE TABLE module_finansial_entitas (
      id VARCHAR(160) PRIMARY KEY,
      year INT NOT NULL,
      month INT NOT NULL,
      branch_code VARCHAR(32) NOT NULL,
      branch_name VARCHAR(255) NOT NULL,
      rekening VARCHAR(128) NOT NULL,
      entitas VARCHAR(64) NOT NULL,
      realisasi DOUBLE PRECISION NOT NULL DEFAULT 0,
      rka DOUBLE PRECISION,
      yoy DOUBLE PRECISION,
      source_type VARCHAR(32) DEFAULT 'labarugi_xlsx',
      verification_status VARCHAR(32) DEFAULT 'verified',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_mfe_lookup ON module_finansial_entitas (year, month, rekening, entitas, branch_code);
    CREATE INDEX idx_mfe_status ON module_finansial_entitas (verification_status);
  `);

  // Table module_finansial (wide format)
  await client.query(`
    CREATE TABLE module_finansial (
      id VARCHAR(160) PRIMARY KEY,
      monthly_record_id VARCHAR(160),
      year INT NOT NULL,
      month INT NOT NULL,
      branch_code VARCHAR(32) NOT NULL,
      branch_name VARCHAR(255) NOT NULL,
      rekening VARCHAR(128) NOT NULL,
      cabang_rp DOUBLE PRECISION DEFAULT 0,
      pmt_rp DOUBLE PRECISION DEFAULT 0,
      ptp_rp DOUBLE PRECISION DEFAULT 0,
      psl_rp DOUBLE PRECISION DEFAULT 0,
      pjm_rp DOUBLE PRECISION DEFAULT 0,
      eliminasi_rp DOUBLE PRECISION DEFAULT 0,
      konsolidasi_rp DOUBLE PRECISION DEFAULT 0,
      rka DOUBLE PRECISION,
      yoy DOUBLE PRECISION,
      source_type VARCHAR(32) DEFAULT 'labarugi_xlsx',
      verification_status VARCHAR(32) DEFAULT 'verified',
      uploaded_by VARCHAR(128),
      uploaded_at TIMESTAMP WITH TIME ZONE,
      verified_by VARCHAR(128),
      verified_at TIMESTAMP WITH TIME ZONE,
      revision_notes TEXT,
      verified_snapshot_json JSONB
    );
    CREATE INDEX idx_mf_period_branch ON module_finansial (year, month, branch_code);
    CREATE INDEX idx_mf_status ON module_finansial (verification_status);
  `);

  // View v_module_finansial_entitas
  await client.query(`
    CREATE OR REPLACE VIEW v_module_finansial_entitas AS
    SELECT * FROM module_finansial_entitas;
  `);

  // 2. Insert into module_finansial_entitas & aggregate wide
  const wideMap = new Map();

  await client.query('BEGIN');

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const year = parseInt(r['TAHUN'], 10);
    const month = parseInt(r['BULAN'], 10);
    const branch_code = String(r['KODE_CBG'] || '').trim();
    const branch_name = String(r['NM_CBG'] || '').trim();
    const rekening = String(r['REKENING'] || '').trim();
    const entitas = String(r['ENTITAS'] || '').trim().toUpperCase();

    const rawReal = r[' REALISASI '] ?? r['REALISASI'] ?? 0;
    const realisasi = typeof rawReal === 'number' ? rawReal : (parseFloat(String(rawReal).replace(/,/g, '')) || 0);

    const rawRka = r[' RKA '] ?? r['RKA'];
    const rka = rawRka !== undefined && rawRka !== null && rawRka !== '' ? Number(rawRka) : null;

    const rawYoy = r[' YOY '] ?? r['YOY'];
    const yoy = rawYoy !== undefined && rawYoy !== null && rawYoy !== '' ? Number(rawYoy) : null;

    const id = `mfe_${year}_${month}_${branch_code}_${rekening}_${entitas}_${i}`;

    await client.query(`
      INSERT INTO module_finansial_entitas (
        id, year, month, branch_code, branch_name, rekening, entitas,
        realisasi, rka, yoy, source_type, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'labarugi_xlsx', 'verified')
    `, [id, year, month, branch_code, branch_name, rekening, entitas, realisasi, rka, yoy]);

    // Aggregate into wideMap
    const wideKey = `${year}_${month}_${branch_code}_${rekening}`;
    if (!wideMap.has(wideKey)) {
      wideMap.set(wideKey, {
        id: `mf_${wideKey}`,
        year,
        month,
        branch_code,
        branch_name,
        rekening,
        cabang_rp: 0,
        pmt_rp: 0,
        ptp_rp: 0,
        psl_rp: 0,
        pjm_rp: 0,
        eliminasi_rp: 0,
        konsolidasi_rp: 0,
        rka,
        yoy,
      });
    }

    const rec = wideMap.get(wideKey);
    if (entitas === 'CABANG') rec.cabang_rp = realisasi;
    else if (entitas === 'PMT') rec.pmt_rp = realisasi;
    else if (entitas === 'PTP') rec.ptp_rp = realisasi;
    else if (entitas === 'PSL') rec.psl_rp = realisasi;
    else if (entitas === 'PJM') rec.pjm_rp = realisasi;
    else if (entitas === 'ELIMINASI') rec.eliminasi_rp = realisasi;

    rec.konsolidasi_rp += realisasi;
  }

  // Insert wide rows
  for (const w of wideMap.values()) {
    await client.query(`
      INSERT INTO module_finansial (
        id, year, month, branch_code, branch_name, rekening,
        cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp,
        rka, yoy, source_type, verification_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, 'labarugi_xlsx', 'verified'
      )
    `, [
      w.id, w.year, w.month, w.branch_code, w.branch_name, w.rekening,
      w.cabang_rp, w.pmt_rp, w.ptp_rp, w.psl_rp, w.pjm_rp, w.eliminasi_rp, w.konsolidasi_rp,
      w.rka, w.yoy
    ]);
  }

  await client.query('COMMIT');

  console.log(`Successfully ingested ${rawRows.length} entitas rows and ${wideMap.size} wide rows into PostgreSQL!`);
  await client.end();
}

main().catch(console.error);

