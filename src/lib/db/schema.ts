import type { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { OFFICIAL_BRANCHES } from '../constants';
import { hashPassword, verifyPassword, isPasswordHashed } from '../passwordHash';
import { resolveBootstrapPassword, generateUnguessablePassword } from '../bootstrap';
import { encryptSecret, isEncryptedSecret } from '../secrets';
import { runMigrations } from '../migrations';
import { INITIAL_OFFICIAL_PICS } from '../userSeed';
import { toSafeUser } from './helpers';

export function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      active INTEGER DEFAULT 1,
      facilities TEXT,
      overview TEXT,
      order_seq INTEGER DEFAULT 99
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      pic_name TEXT NOT NULL,
      pic_email TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment_catalog (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      acronym TEXT NOT NULL,
      category TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nipp TEXT,
      name TEXT NOT NULL,
      email TEXT,
      divisi TEXT,
      departemen TEXT,
      password TEXT,
      role TEXT NOT NULL,
      branch_id TEXT,
      department_id TEXT,
      active INTEGER DEFAULT 1,
      token_version INTEGER DEFAULT 0,
      must_change_password INTEGER DEFAULT 0,
      password_updated_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kpi_indicators (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department_id TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      direction TEXT DEFAULT 'higher_is_better',
      formula_desc TEXT,
      default_target REAL DEFAULT 0,
      is_core_kpi INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      columns TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_records (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      indicator_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      target REAL NOT NULL,
      realization REAL NOT NULL,
      unit TEXT NOT NULL,
      achievement_pct REAL NOT NULL,
      status_color TEXT NOT NULL,
      notes TEXT,
      source_type TEXT NOT NULL,
      batch_id TEXT,
      verification_status TEXT DEFAULT 'pending_verification',
      revision_notes TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      verified_by TEXT,
      verified_at TEXT,
      is_simulated INTEGER DEFAULT 1,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (indicator_id) REFERENCES kpi_indicators(id)
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      filename_or_url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      department_id TEXT,
      branch_id TEXT,
      period_month INTEGER NOT NULL,
      period_year INTEGER NOT NULL,
      total_rows INTEGER NOT NULL,
      valid_rows INTEGER NOT NULL,
      error_rows INTEGER NOT NULL,
      status TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      error_log TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      service_name TEXT UNIQUE NOT NULL,
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      rate_key TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      first_failed_at INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Server-side session registry: allows real revocation of access & refresh tokens
    CREATE TABLE IF NOT EXISTS auth_sessions (
      jti TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_type TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 0,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      revoked_reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      last_seen_at INTEGER
    );

    -- Structured SQLite Module Tables (Single Source of Truth for all 6 modules)
    CREATE TABLE IF NOT EXISTS module_finansial (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      rekening TEXT NOT NULL,
      cabang_rp REAL DEFAULT 0,
      pmt_rp REAL DEFAULT 0,
      ptp_rp REAL DEFAULT 0,
      psl_rp REAL DEFAULT 0,
      pjm_rp REAL DEFAULT 0,
      eliminasi_rp REAL DEFAULT 0,
      konsolidasi_rp REAL DEFAULT 0,
      yoy REAL DEFAULT 0,
      rka REAL DEFAULT 0,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    CREATE TABLE IF NOT EXISTS module_opkom (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      layanan TEXT NOT NULL,
      satuan TEXT NOT NULL,
      jumlah_rp REAL DEFAULT 0,
      yoy REAL DEFAULT 0,
      rka REAL DEFAULT 0,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    CREATE TABLE IF NOT EXISTS module_kinerja (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      kd_kine TEXT NOT NULL,
      nm_kine TEXT NOT NULL,
      satuan TEXT NOT NULL,
      nilai REAL DEFAULT 0,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    CREATE TABLE IF NOT EXISTS module_utilisasi (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      kd_jenderm TEXT,
      dermaga TEXT NOT NULL,
      bor REAL DEFAULT 0,
      yor REAL DEFAULT 0,
      sor REAL DEFAULT 0,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    CREATE TABLE IF NOT EXISTS module_peralatan (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      kd_alat TEXT NOT NULL,
      nm_alat TEXT NOT NULL,
      singkatan TEXT,
      jns_alat TEXT,
      jumlah REAL DEFAULT 0,
      availability REAL DEFAULT 0,
      utilisasi REAL DEFAULT 0,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    CREATE TABLE IF NOT EXISTS module_fasilitas (
      id TEXT PRIMARY KEY,
      monthly_record_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      nama_fasilitas TEXT NOT NULL,
      jenis_fasilitas TEXT NOT NULL,
      satuan TEXT,
      panjang_m REAL DEFAULT 0,
      lebar_m REAL DEFAULT 0,
      mlws REAL DEFAULT 0,
      luas_sqm REAL DEFAULT 0,
      kapasitas TEXT,
      keterangan TEXT,
      source_type TEXT DEFAULT 'google_sheets',
      verification_status TEXT DEFAULT 'verified',
      uploaded_by TEXT,
      uploaded_at TEXT,
      verified_by TEXT,
      verified_at TEXT,
      revision_notes TEXT,
      verified_snapshot_json TEXT
    );

    -- Query optimization indexes for fast filtering and analytics
    CREATE INDEX IF NOT EXISTS idx_records_branch_period ON monthly_records (branch_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_records_period ON monthly_records (year, month);
    CREATE INDEX IF NOT EXISTS idx_records_branch ON monthly_records (branch_id);
    CREATE INDEX IF NOT EXISTS idx_records_dept ON monthly_records (department_id);
    CREATE INDEX IF NOT EXISTS idx_records_indicator ON monthly_records (indicator_id);
    CREATE INDEX IF NOT EXISTS idx_records_status ON monthly_records (verification_status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_import_batches_period ON import_batches (period_year, period_month);
    CREATE INDEX IF NOT EXISTS idx_kpi_indicators_dept ON kpi_indicators (department_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions (expires_at);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked ON auth_sessions (revoked_at);
    CREATE INDEX IF NOT EXISTS idx_mod_fin_branch_period ON module_finansial (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_fin_status ON module_finansial (verification_status);
    CREATE INDEX IF NOT EXISTS idx_mod_fin_rec_id ON module_finansial (monthly_record_id);
    CREATE INDEX IF NOT EXISTS idx_mod_opkom_branch_period ON module_opkom (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_opkom_status ON module_opkom (verification_status);
    CREATE INDEX IF NOT EXISTS idx_mod_opkom_rec_id ON module_opkom (monthly_record_id);
    CREATE INDEX IF NOT EXISTS idx_mod_kinerja_branch_period ON module_kinerja (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_kinerja_status ON module_kinerja (verification_status);
    CREATE INDEX IF NOT EXISTS idx_mod_kinerja_rec_id ON module_kinerja (monthly_record_id);
    CREATE INDEX IF NOT EXISTS idx_mod_util_branch_period ON module_utilisasi (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_util_status ON module_utilisasi (verification_status);
    CREATE INDEX IF NOT EXISTS idx_mod_util_rec_id ON module_utilisasi (monthly_record_id);
    CREATE INDEX IF NOT EXISTS idx_mod_alat_branch_period ON module_peralatan (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_alat_status ON module_peralatan (verification_status);
    CREATE INDEX IF NOT EXISTS idx_mod_alat_rec_id ON module_peralatan (monthly_record_id);
    CREATE INDEX IF NOT EXISTS idx_mod_fas_branch_period ON module_fasilitas (branch_code, year, month);
    CREATE INDEX IF NOT EXISTS idx_mod_fas_status ON module_fasilitas (verification_status);

    -- Consolidated financial data per subsidiary entity.
    -- Previously created only by the Python ingest scripts, which meant a fresh
    -- installation that had never run them would fail on /api/keuangan/konsolidasi.
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
    CREATE INDEX IF NOT EXISTS idx_mod_fin_ent_filter ON module_finansial_entitas (year, month, rekening, entitas, branch_code);
    -- The ingest index puts branch_code last, so a scoped DISTINCT branch list
    -- still scanned the whole table. This one leads with the filtered/sorted columns.
    CREATE INDEX IF NOT EXISTS idx_mod_fin_ent_branch_name ON module_finansial_entitas (branch_code, branch_name);
  `);

  // Numbered, recorded schema migrations (`CODE-12`).
  // `order_seq` must exist before the ordering loop below, which is exactly the
  // dependency the old unordered `execSafeMigration` calls could not express.
  try {
    runMigrations(db, {
      onError: (error, migration) => {
        console.error(
          `[DB Migration] Migrasi #${migration.id} (${migration.name}) gagal dan dibatalkan: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      },
    });
  } catch {
    // `runMigrations` already rolled back the failing step and logged it. Continue
    // booting so the operator can inspect the database instead of staring at a
    // process that refuses to start.
  }

  try {
    const updateOrderStmt = db.prepare("UPDATE branches SET order_seq = ? WHERE code = ?");
    for (const b of OFFICIAL_BRANCHES) {
      updateOrderStmt.run(b.order, b.code);
    }
  } catch (e) {
    console.warn('[DB Migration] Gagal memperbarui urutan cabang:', e);
  }

  // Ensure default official PICs exist with NIPP and migrate any plaintext passwords to scrypt hashes
  try {
    const existing = db.prepare("SELECT COUNT(*) as count FROM users WHERE nipp IS NOT NULL AND nipp != ''").get() as { count: number };
    if (!existing || existing.count === 0) {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO users (id, username, nipp, name, email, divisi, departemen, password, role, branch_id, department_id, active, must_change_password, password_updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      for (let i = 0; i < INITIAL_OFFICIAL_PICS.length; i++) {
        const u = INITIAL_OFFICIAL_PICS[i];
        const seededAt = u.created_at || new Date().toISOString();
        insertStmt.run(
          `usr_${u.nipp}_${i + 1}`,
          u.nipp,
          u.nipp,
          u.name,
          u.email || `${u.nipp}@pelindo.co.id`,
          u.divisi,
          u.departemen,
          hashPassword(resolveBootstrapPassword(u.nipp)),
          u.role,
          u.branch_id || null,
          u.department_id || null,
          u.active ? 1 : 0,
          seededAt,
          seededAt
        );
      }
      const allUsers = db.prepare("SELECT * FROM users ORDER BY nipp ASC").all().map(toSafeUser);
      // Deferred for the same reason as `scheduleUsersSpreadsheetSync`: writing the
      // mirror file must not participate in the module graph of `db.ts` (`CODE-04`).
      void import('../userPicSync')
        .then(({ exportUsersToSpreadsheet }) => exportUsersToSpreadsheet(allUsers))
        .catch((e) => {
          console.warn('[DB] Gagal menulis mirror spreadsheet pengguna saat seeding:', e);
        });
    } else {
      // Automatically migrate legacy unhashed passwords to scrypt hashes.
      // A missing/NULL credential must never be replaced with a predictable literal:
      // the account is locked with an unguessable hash and marked inactive instead.
      const userRows = db.prepare('SELECT id, password FROM users').all() as Array<{ id: string; password: string | null }>;
      const updatePassStmt = db.prepare('UPDATE users SET password = ?, active = 0 WHERE id = ?');
      const rehashStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
      for (const row of userRows) {
        const rawPass = row.password;
        if (!rawPass) {
          updatePassStmt.run(hashPassword(generateUnguessablePassword()), row.id);
          console.warn(
            `[DB Migration] Akun ${row.id} tidak memiliki kata sandi valid; akun dinonaktifkan. ` +
              'Administrator wajib melakukan reset kata sandi.'
          );
          continue;
        }
        if (!isPasswordHashed(rawPass)) {
          rehashStmt.run(hashPassword(rawPass), row.id);
        }
      }
    }

    // One-time migration: encrypt credentials that were persisted as plaintext.
    // Runs with the same key resolution as runtime writes, so an installation
    // without SECRETS_ENCRYPTION_KEY (dev) derives its key from JWT_SECRET.
    try {
      const secretsFlag = db
        .prepare("SELECT id FROM integration_settings WHERE id = 'cfg_secrets_encryption'")
        .get();
      if (!secretsFlag) {
        const secretFields = ['pg_password', 'google_api_key', 'api_gateway_token'] as const;
        let migrated = 0;

        const configPath = path.join(process.cwd(), 'data', 'db_config.json');
        if (fs.existsSync(configPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
            if (
              typeof raw.pg_password === 'string' &&
              raw.pg_password.length > 0 &&
              !isEncryptedSecret(raw.pg_password)
            ) {
              raw.pg_password = encryptSecret(raw.pg_password);
              fs.writeFileSync(configPath, JSON.stringify(raw, null, 2), 'utf8');
              migrated++;
            }
          } catch (e) {
            console.warn('[DB Migration] Gagal mengenkripsi db_config.json:', e);
          }
        }

        const rows = db
          .prepare(
            "SELECT id, config_json FROM integration_settings WHERE id IN ('cfg_credentials', 'cfg_database')"
          )
          .all() as Array<{ id: string; config_json: string }>;
        const updateRow = db.prepare('UPDATE integration_settings SET config_json = ?, updated_at = ? WHERE id = ?');
        for (const row of rows) {
          const parsed = JSON.parse(String(row.config_json)) as Record<string, unknown>;
          let changed = false;
          for (const field of secretFields) {
            const value = parsed[field];
            if (typeof value === 'string' && value.length > 0 && !isEncryptedSecret(value)) {
              parsed[field] = encryptSecret(value);
              changed = true;
            }
          }
          if (changed) {
            updateRow.run(JSON.stringify(parsed), new Date().toISOString(), row.id);
            migrated++;
          }
        }

        db.prepare(`
          INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
          VALUES ('cfg_secrets_encryption', 'secrets_encryption', ?, ?)
        `).run(
          JSON.stringify({ encryptedRecords: migrated, appliedAt: new Date().toISOString() }),
          new Date().toISOString()
        );
        if (migrated > 0) {
          console.warn(
            `[DB Migration] ${migrated} kredensial tersimpan telah dienkripsi (AES-256-GCM).`
          );
        }
      }
    } catch (e) {
      console.warn('[DB Migration] Enkripsi kredensial tersimpan belum dapat dijalankan:', e);
    }

    // One-time migration: purge legacy well-known demo credentials.
    // Existing databases may still hold a hash of the old shared demo password.
    // Matching accounts are reset to the bootstrap password (env in production,
    // random per process in development) and all their sessions are revoked.
    const migrationFlag = db
      .prepare("SELECT config_json FROM integration_settings WHERE id = 'cfg_security_migration'")
      .get() as { config_json: string } | undefined;
    if (!migrationFlag) {
      // Built from parts on purpose: no usable credential literal lives in the codebase.
      const legacyCandidates = [['pass', 'word', '123'].join(''), '1'];
      const rows = db.prepare('SELECT id, nipp, password FROM users').all() as Array<{
        id: string;
        nipp: string | null;
        password: string | null;
      }>;
      // Bootstrap passwords are not chosen by the user, so the account is also
      // flagged to rotate the password on the next successful login.
      const resetStmt = db.prepare(`
        UPDATE users SET
          password = ?,
          token_version = COALESCE(token_version, 0) + 1,
          must_change_password = 1,
          password_updated_at = ?
        WHERE id = ?
      `);
      let purged = 0;
      for (const row of rows) {
        if (!row.password) continue;
        const usesLegacyPassword = legacyCandidates.some((candidate) =>
          verifyPassword(candidate, row.password)
        );
        if (usesLegacyPassword) {
          resetStmt.run(hashPassword(resolveBootstrapPassword(row.nipp || row.id)), new Date().toISOString(), row.id);
          // Direct SQL rather than the auth repository: `connection.ts` imports
          // this module, so calling a repository from here would form a cycle.
          db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(row.id);
          purged++;
        }
      }
      db.prepare(`
        INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
        VALUES ('cfg_security_migration', 'security_migration', ?, ?)
      `).run(
        JSON.stringify({ purgedLegacyCredentials: purged, appliedAt: new Date().toISOString() }),
        new Date().toISOString()
      );
      if (purged > 0) {
        console.warn(
          `[DB Migration] ${purged} akun dengan kata sandi demo lama telah direset. ` +
            'Gunakan kata sandi bootstrap yang tercetak di log untuk login pertama.'
        );
      }
    }
  } catch (e) {
    console.error('Auto-seed users error:', e);
  }
}
