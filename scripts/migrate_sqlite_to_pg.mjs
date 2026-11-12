import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set in environment or .env');
  process.exit(1);
}

const sqlitePath = path.join(cwd, 'data', 'ed_dashboard.db');
if (!fs.existsSync(sqlitePath)) {
  console.error(`ERROR: SQLite file not found at ${sqlitePath}`);
  process.exit(1);
}

function toBool(val, fallback = true) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 't' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'f' || s === 'no' || s === '') return false;
  return fallback;
}

function toJsonbString(val, fallback = null) {
  if (val === null || val === undefined || val === '') {
    return fallback === null ? null : JSON.stringify(fallback);
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify({ raw: val });
    }
  }
  return JSON.stringify(val);
}

function toNullableTs(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;
  return s;
}

async function migrate() {
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log('Connected to PostgreSQL and SQLite. Starting migration...');
    await client.query('BEGIN');

    // 1. branches
    const branches = sqlite.prepare('SELECT * FROM branches').all();
    for (const r of branches) {
      await client.query(
        `INSERT INTO branches (id, code, name, region, address, phone, email, active, facilities, overview, order_seq)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           region = EXCLUDED.region,
           address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           active = EXCLUDED.active,
           facilities = EXCLUDED.facilities,
           overview = EXCLUDED.overview,
           order_seq = EXCLUDED.order_seq`,
        [
          r.id,
          r.code,
          r.name,
          r.region,
          r.address ?? null,
          r.phone ?? null,
          r.email ?? null,
          toBool(r.active, true),
          toJsonbString(r.facilities, {}),
          r.overview ?? null,
          r.order_seq ?? 99,
        ]
      );
    }

    // 2. departments
    const departments = sqlite.prepare('SELECT * FROM departments').all();
    for (const r of departments) {
      await client.query(
        `INSERT INTO departments (id, code, name, pic_name, pic_email, active, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           pic_name = EXCLUDED.pic_name,
           pic_email = EXCLUDED.pic_email,
           active = EXCLUDED.active,
           description = EXCLUDED.description`,
        [r.id, r.code, r.name, r.pic_name, r.pic_email, toBool(r.active, true), r.description ?? null]
      );
    }

    // 3. equipment_catalog
    const equipment = sqlite.prepare('SELECT * FROM equipment_catalog').all();
    for (const r of equipment) {
      await client.query(
        `INSERT INTO equipment_catalog (id, code, name, acronym, category, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           acronym = EXCLUDED.acronym,
           category = EXCLUDED.category,
           active = EXCLUDED.active`,
        [r.id, r.code, r.name, r.acronym, r.category, toBool(r.active, true)]
      );
    }

    // 4. users (maps SQLite `password` -> PG `password_hash`)
    const users = sqlite.prepare('SELECT * FROM users').all();
    for (const r of users) {
      await client.query(
        `INSERT INTO users (id, username, nipp, password_hash, name, email, divisi, departemen, role, branch_id, department_id, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, CURRENT_TIMESTAMP))
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           nipp = EXCLUDED.nipp,
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           divisi = EXCLUDED.divisi,
           departemen = EXCLUDED.departemen,
           role = EXCLUDED.role,
           branch_id = EXCLUDED.branch_id,
           department_id = EXCLUDED.department_id,
           active = EXCLUDED.active,
           created_at = EXCLUDED.created_at`,
        [
          r.id,
          r.username,
          r.nipp ?? r.username,
          r.password ?? null,
          r.name,
          r.email,
          r.divisi ?? null,
          r.departemen ?? null,
          r.role,
          r.branch_id ?? null,
          r.department_id ?? null,
          toBool(r.active, true),
          toNullableTs(r.created_at),
        ]
      );
    }

    // 5. kpi_indicators
    const indicators = sqlite.prepare('SELECT * FROM kpi_indicators').all();
    for (const r of indicators) {
      await client.query(
        `INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, formula_desc, default_target, is_core_kpi, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           department_id = EXCLUDED.department_id,
           category = EXCLUDED.category,
           unit = EXCLUDED.unit,
           direction = EXCLUDED.direction,
           formula_desc = EXCLUDED.formula_desc,
           default_target = EXCLUDED.default_target,
           is_core_kpi = EXCLUDED.is_core_kpi,
           active = EXCLUDED.active`,
        [
          r.id,
          r.code,
          r.name,
          r.department_id,
          r.category,
          r.unit,
          r.direction ?? 'higher_is_better',
          r.formula_desc ?? null,
          Number(r.default_target ?? 0),
          toBool(r.is_core_kpi, false),
          toBool(r.active, true),
        ]
      );
    }

    // 6. templates
    const templates = sqlite.prepare('SELECT * FROM templates').all();
    for (const r of templates) {
      await client.query(
        `INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, CURRENT_TIMESTAMP))
         ON CONFLICT (id) DO UPDATE SET
           department_id = EXCLUDED.department_id,
           version = EXCLUDED.version,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           columns = EXCLUDED.columns,
           updated_at = EXCLUDED.updated_at`,
        [
          r.id,
          r.department_id,
          r.version,
          r.name,
          r.description ?? null,
          toJsonbString(r.columns, []),
          toNullableTs(r.updated_at),
        ]
      );
    }

    // 7. import_batches
    const batches = sqlite.prepare('SELECT * FROM import_batches').all();
    for (const r of batches) {
      await client.query(
        `INSERT INTO import_batches (id, filename_or_url, source_type, department_id, branch_id, period_month, period_year, total_rows, valid_rows, error_rows, status, uploaded_by, uploaded_at, error_log)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, CURRENT_TIMESTAMP), $14::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           filename_or_url = EXCLUDED.filename_or_url,
           source_type = EXCLUDED.source_type,
           department_id = EXCLUDED.department_id,
           branch_id = EXCLUDED.branch_id,
           period_month = EXCLUDED.period_month,
           period_year = EXCLUDED.period_year,
           total_rows = EXCLUDED.total_rows,
           valid_rows = EXCLUDED.valid_rows,
           error_rows = EXCLUDED.error_rows,
           status = EXCLUDED.status,
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = EXCLUDED.uploaded_at,
           error_log = EXCLUDED.error_log`,
        [
          r.id,
          r.filename_or_url,
          r.source_type,
          r.department_id ?? null,
          r.branch_id ?? null,
          Number(r.period_month),
          Number(r.period_year),
          Number(r.total_rows),
          Number(r.valid_rows),
          Number(r.error_rows),
          r.status,
          r.uploaded_by,
          toNullableTs(r.uploaded_at),
          r.error_log ? toJsonbString(r.error_log, null) : null,
        ]
      );
    }

    // 8. monthly_records
    const records = sqlite.prepare('SELECT * FROM monthly_records').all();
    for (const r of records) {
      await client.query(
        `INSERT INTO monthly_records (
          id, branch_id, department_id, indicator_id, month, year,
          target, realization, unit, achievement_pct, status_color, notes,
          source_type, batch_id, verification_status, revision_notes,
          uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, COALESCE($18::timestamptz, CURRENT_TIMESTAMP), $19, $20::timestamptz, $21
        )
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
          source_type = EXCLUDED.source_type,
          batch_id = EXCLUDED.batch_id,
          verification_status = EXCLUDED.verification_status,
          revision_notes = EXCLUDED.revision_notes,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          is_simulated = EXCLUDED.is_simulated`,
        [
          r.id,
          r.branch_id,
          r.department_id,
          r.indicator_id,
          Number(r.month),
          Number(r.year),
          Number(r.target),
          Number(r.realization),
          r.unit,
          Number(r.achievement_pct),
          r.status_color,
          r.notes ?? null,
          r.source_type,
          r.batch_id ?? null,
          r.verification_status ?? 'pending_verification',
          r.revision_notes ?? null,
          r.uploaded_by,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          toBool(r.is_simulated, true),
        ]
      );
    }

    // 9. audit_logs
    const audits = sqlite.prepare('SELECT * FROM audit_logs').all();
    for (const r of audits) {
      await client.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, CURRENT_TIMESTAMP), $10)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           user_name = EXCLUDED.user_name,
           user_role = EXCLUDED.user_role,
           action = EXCLUDED.action,
           entity = EXCLUDED.entity,
           entity_id = EXCLUDED.entity_id,
           details = EXCLUDED.details,
           timestamp = EXCLUDED.timestamp,
           ip_address = EXCLUDED.ip_address`,
        [
          r.id,
          r.user_id,
          r.user_name,
          r.user_role,
          r.action,
          r.entity,
          r.entity_id ?? null,
          r.details,
          toNullableTs(r.timestamp),
          r.ip_address ?? null,
        ]
      );
    }

    // 10. integration_settings
    const settings = sqlite.prepare('SELECT * FROM integration_settings').all();
    for (const r of settings) {
      let configJsonStr = toJsonbString(r.config_json, {});
      if (r.service_name === 'database_config') {
        try {
          const parsed = JSON.parse(configJsonStr);
          parsed.engine = 'postgres';
          parsed.pg_host = parsed.pg_host || 'localhost';
          parsed.pg_port = parsed.pg_port || 5432;
          parsed.pg_database = parsed.pg_database || 'ed_dashboard';
          parsed.pg_user = parsed.pg_user || 'postgres';
          parsed.pg_password = '';
          parsed.updated_at = new Date().toISOString();
          configJsonStr = JSON.stringify(parsed);
        } catch {
          // keep original json
        }
      }
      await client.query(
        `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
         VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, CURRENT_TIMESTAMP))
         ON CONFLICT (id) DO UPDATE SET
           service_name = EXCLUDED.service_name,
           config_json = EXCLUDED.config_json,
           updated_at = EXCLUDED.updated_at`,
        [r.id, r.service_name, configJsonStr, toNullableTs(r.updated_at)]
      );
    }

    // 11. module_finansial
    const modFin = sqlite.prepare('SELECT * FROM module_finansial').all();
    for (const r of modFin) {
      await client.query(
        `INSERT INTO module_finansial (
          id, monthly_record_id, year, month, branch_code, branch_name, rekening,
          cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp, yoy, rka,
          source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::timestamptz,$21,$22::timestamptz,$23,$24::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          rekening = EXCLUDED.rekening,
          cabang_rp = EXCLUDED.cabang_rp,
          pmt_rp = EXCLUDED.pmt_rp,
          ptp_rp = EXCLUDED.ptp_rp,
          psl_rp = EXCLUDED.psl_rp,
          pjm_rp = EXCLUDED.pjm_rp,
          eliminasi_rp = EXCLUDED.eliminasi_rp,
          konsolidasi_rp = EXCLUDED.konsolidasi_rp,
          yoy = EXCLUDED.yoy,
          rka = EXCLUDED.rka,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.rekening,
          Number(r.cabang_rp ?? 0),
          Number(r.pmt_rp ?? 0),
          Number(r.ptp_rp ?? 0),
          Number(r.psl_rp ?? 0),
          Number(r.pjm_rp ?? 0),
          Number(r.eliminasi_rp ?? 0),
          Number(r.konsolidasi_rp ?? 0),
          Number(r.yoy ?? 0),
          Number(r.rka ?? 0),
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    // 12. module_opkom
    const modOpkom = sqlite.prepare('SELECT * FROM module_opkom').all();
    for (const r of modOpkom) {
      await client.query(
        `INSERT INTO module_opkom (
          id, monthly_record_id, year, month, branch_code, branch_name, layanan, satuan,
          jumlah_rp, yoy, rka, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz,$16,$17::timestamptz,$18,$19::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          layanan = EXCLUDED.layanan,
          satuan = EXCLUDED.satuan,
          jumlah_rp = EXCLUDED.jumlah_rp,
          yoy = EXCLUDED.yoy,
          rka = EXCLUDED.rka,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.layanan,
          r.satuan,
          Number(r.jumlah_rp ?? 0),
          Number(r.yoy ?? 0),
          Number(r.rka ?? 0),
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    // 13. module_kinerja
    const modKinerja = sqlite.prepare('SELECT * FROM module_kinerja').all();
    for (const r of modKinerja) {
      await client.query(
        `INSERT INTO module_kinerja (
          id, monthly_record_id, year, month, branch_code, branch_name, kd_kine, nm_kine, satuan,
          nilai, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,$15,$16::timestamptz,$17,$18::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          kd_kine = EXCLUDED.kd_kine,
          nm_kine = EXCLUDED.nm_kine,
          satuan = EXCLUDED.satuan,
          nilai = EXCLUDED.nilai,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.kd_kine,
          r.nm_kine,
          r.satuan,
          Number(r.nilai ?? 0),
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    // 14. module_utilisasi
    const modUtil = sqlite.prepare('SELECT * FROM module_utilisasi').all();
    for (const r of modUtil) {
      await client.query(
        `INSERT INTO module_utilisasi (
          id, monthly_record_id, year, month, branch_code, branch_name, kd_jenderm, dermaga,
          bor, yor, sor, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz,$16,$17::timestamptz,$18,$19::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          kd_jenderm = EXCLUDED.kd_jenderm,
          dermaga = EXCLUDED.dermaga,
          bor = EXCLUDED.bor,
          yor = EXCLUDED.yor,
          sor = EXCLUDED.sor,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.kd_jenderm ?? null,
          r.dermaga,
          Number(r.bor ?? 0),
          Number(r.yor ?? 0),
          Number(r.sor ?? 0),
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    // 15. module_peralatan
    const modAlat = sqlite.prepare('SELECT * FROM module_peralatan').all();
    for (const r of modAlat) {
      await client.query(
        `INSERT INTO module_peralatan (
          id, monthly_record_id, year, month, branch_code, branch_name, kd_alat, nm_alat, singkatan, jns_alat,
          jumlah, availability, utilisasi, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::timestamptz,$18,$19::timestamptz,$20,$21::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          kd_alat = EXCLUDED.kd_alat,
          nm_alat = EXCLUDED.nm_alat,
          singkatan = EXCLUDED.singkatan,
          jns_alat = EXCLUDED.jns_alat,
          jumlah = EXCLUDED.jumlah,
          availability = EXCLUDED.availability,
          utilisasi = EXCLUDED.utilisasi,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.kd_alat,
          r.nm_alat,
          r.singkatan ?? null,
          r.jns_alat ?? null,
          Number(r.jumlah ?? 0),
          Number(r.availability ?? 0),
          Number(r.utilisasi ?? 0),
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    // 16. module_fasilitas
    const modFas = sqlite.prepare('SELECT * FROM module_fasilitas').all();
    for (const r of modFas) {
      await client.query(
        `INSERT INTO module_fasilitas (
          id, monthly_record_id, year, month, branch_code, branch_name, nama_fasilitas, jenis_fasilitas, satuan,
          panjang_m, lebar_m, mlws, luas_sqm, kapasitas, keterangan,
          source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at, revision_notes, verified_snapshot_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::timestamptz,$20,$21::timestamptz,$22,$23::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          monthly_record_id = EXCLUDED.monthly_record_id,
          year = EXCLUDED.year,
          month = EXCLUDED.month,
          branch_code = EXCLUDED.branch_code,
          branch_name = EXCLUDED.branch_name,
          nama_fasilitas = EXCLUDED.nama_fasilitas,
          jenis_fasilitas = EXCLUDED.jenis_fasilitas,
          satuan = EXCLUDED.satuan,
          panjang_m = EXCLUDED.panjang_m,
          lebar_m = EXCLUDED.lebar_m,
          mlws = EXCLUDED.mlws,
          luas_sqm = EXCLUDED.luas_sqm,
          kapasitas = EXCLUDED.kapasitas,
          keterangan = EXCLUDED.keterangan,
          source_type = EXCLUDED.source_type,
          verification_status = EXCLUDED.verification_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          revision_notes = EXCLUDED.revision_notes,
          verified_snapshot_json = EXCLUDED.verified_snapshot_json`,
        [
          r.id,
          r.monthly_record_id ?? null,
          Number(r.year),
          Number(r.month),
          r.branch_code,
          r.branch_name,
          r.nama_fasilitas,
          r.jenis_fasilitas,
          r.satuan ?? null,
          Number(r.panjang_m ?? 0),
          Number(r.lebar_m ?? 0),
          Number(r.mlws ?? 0),
          Number(r.luas_sqm ?? 0),
          r.kapasitas ?? null,
          r.keterangan ?? null,
          r.source_type ?? 'google_sheets',
          r.verification_status ?? 'verified',
          r.uploaded_by ?? null,
          toNullableTs(r.uploaded_at),
          r.verified_by ?? null,
          toNullableTs(r.verified_at),
          r.revision_notes ?? null,
          r.verified_snapshot_json ? toJsonbString(r.verified_snapshot_json, null) : null,
        ]
      );
    }

    await client.query('COMMIT');
    console.log('\nMigration committed successfully! Verifying row counts...\n');

    const tables = [
      'branches',
      'departments',
      'users',
      'kpi_indicators',
      'templates',
      'import_batches',
      'monthly_records',
      'audit_logs',
      'integration_settings',
      'equipment_catalog',
      'module_finansial',
      'module_opkom',
      'module_kinerja',
      'module_utilisasi',
      'module_peralatan',
      'module_fasilitas',
    ];

    let allMatch = true;
    const summaryRows = [];
    for (const table of tables) {
      const sqliteCount = Number(sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c);
      const pgRes = await client.query(`SELECT COUNT(*)::int as c FROM ${table}`);
      const pgCount = Number(pgRes.rows[0].c);
      const match = sqliteCount === pgCount;
      if (!match) allMatch = false;
      summaryRows.push({ table, sqlite: sqliteCount, postgresql: pgCount, status: match ? 'MATCH' : 'MISMATCH' });
    }

    console.table(summaryRows);
    if (!allMatch) {
      console.error('ERROR: Row count mismatch detected!');
      process.exitCode = 1;
    } else {
      console.log('ALL 16 TABLES MATCHED 100%!');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed and rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
