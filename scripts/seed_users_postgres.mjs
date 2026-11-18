import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { randomBytes, scryptSync } from 'crypto';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: environment variable DATABASE_URL wajib disetel.');
  process.exit(1);
}

function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const wb = xlsx.readFile('data/master_user_pic.xlsx');
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`Loaded ${rows.length} users from master_user_pic.xlsx`);

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || process.env.BOOTSTRAP_PIC_PASSWORD;
  if (!defaultPassword || defaultPassword.length < 12) {
    console.error(
      'Error: environment variable SEED_DEFAULT_PASSWORD atau BOOTSTRAP_PIC_PASSWORD wajib disetel (minimal 12 karakter).'
    );
    process.exit(1);
  }
  const mustChangePassword = process.env.BOOTSTRAP_TEST_READY !== 'true';

  for (const r of rows) {
    const nipp = String(r['NIPP (USERNAME)']).trim();
    const name = String(r['NAMA LENGKAP'] || nipp).trim();
    const divisi = String(r['DIVISI'] || '').trim();
    const departemen = String(r['DEPARTEMEN'] || '').trim();
    const role = String(r['HAK AKSES (ROLE)'] || 'viewer').trim();
    const branch_id = String(r['CABANG'] || 'R99').trim();
    const email = String(r['EMAIL'] || `${nipp}@pelindo.co.id`).trim();
    const id = `usr_${nipp}`;
    // SA-26: Unique per-user scrypt salt; never overwrite already-rotated production password_hash.
    const passwordHash = hashPassword(defaultPassword);

    await client.query(`
      INSERT INTO users (id, username, nipp, name, email, divisi, departemen, role, branch_id, password_hash, active, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
      ON CONFLICT (username) DO UPDATE SET
        nipp = EXCLUDED.nipp,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        divisi = EXCLUDED.divisi,
        departemen = EXCLUDED.departemen,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id
    `, [id, nipp, nipp, name, email, divisi, departemen, role, branch_id, passwordHash, mustChangePassword]);
  }

  const countRes = await client.query('SELECT count(*) FROM users');
  console.log(`Total users in PostgreSQL: ${countRes.rows[0].count}`);
  await client.end();
}

run().catch(console.error);

