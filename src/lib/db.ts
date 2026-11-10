import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import path from 'path';
import fs from 'fs';
import type {
  Branch,
  Department,
  EquipmentItem,
  User,
  UserRole,
  KPIIndicator,
  TemplateConfig,
  MonthlyRecord,
  ImportBatch,
  AuditLog,
  GoogleSheetsConfig,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from './types';
import { OFFICIAL_BRANCHES } from './constants';
import { hashPassword, verifyPassword, isPasswordHashed } from './auth';
import { exportUsersToSpreadsheet, INITIAL_OFFICIAL_PICS } from './userPicSync';

export const SECRET_MASK = '••••••••';

// Ensure data folder exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Strictly confine file paths inside the workspace `./data` directory to prevent Path Traversal / Arbitrary File Creation.
 */
export function sanitizeSafeDataFilePath(
  rawPath: string | undefined | null,
  defaultFileName: string = 'ed_dashboard.db',
  allowedExtensions: string[] = ['.db', '.sqlite', '.sqlite3']
): { safeRelativePath: string; resolvedAbsolutePath: string } {
  const cleaned = String(rawPath || '').trim();
  let baseName = cleaned ? path.basename(cleaned) : defaultFileName;
  // Strip any null bytes or unsafe characters
  baseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!baseName || baseName === '.' || baseName === '..') {
    baseName = defaultFileName;
  }
  const ext = path.extname(baseName).toLowerCase();
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
    baseName = `${baseName}${allowedExtensions[0]}`;
  }
  const safeRelativePath = path.posix.join('data', baseName);
  const resolvedAbsolutePath = path.join(process.cwd(), 'data', baseName);
  return { safeRelativePath, resolvedAbsolutePath };
}

/**
 * Strip password hash/plaintext from a User record before returning to callers or API responses.
 */
export function toSafeUser(raw: Record<string, unknown> | User): User {
  if (!raw) return raw as User;
  const rawRecord = raw as Record<string, unknown>;
  const { password: _removedPassword, ...rest } = rawRecord;
  void _removedPassword;
  return {
    ...(rest as unknown as User),
    nipp: String(rawRecord.nipp || rawRecord.username || ''),
    username: String(rawRecord.username || rawRecord.nipp || ''),
    active: Boolean(rawRecord.active),
  };
}

/**
 * Mask sensitive database credentials before returning in API responses.
 */
export function toSafeDbConfig(cfg?: DatabaseConfig): DatabaseConfig {
  const source = cfg || getDbConfig();
  return {
    ...source,
    pg_password: source.pg_password ? SECRET_MASK : '',
  };
}

/**
 * Mask sensitive external API keys and tokens before returning in API responses.
 */
export function toSafeIntegrationCredentials(creds?: IntegrationCredentials): IntegrationCredentials {
  const source = creds || dbQueries.getIntegrationCredentials();
  return {
    ...source,
    google_api_key: source.google_api_key ? SECRET_MASK : '',
    api_gateway_token: source.api_gateway_token ? SECRET_MASK : '',
  };
}

// Database location & configuration management
export function getDbConfig(): DatabaseConfig {
  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      const { safeRelativePath } = sanitizeSafeDataFilePath(parsed.sqlite_path, 'ed_dashboard.db');
      return {
        ...parsed,
        sqlite_path: safeRelativePath,
      };
    } catch (e) {
      console.error('Error reading db_config.json:', e);
    }
  }
  return {
    engine: 'sqlite',
    sqlite_path: 'data/ed_dashboard.db',
    pg_host: 'localhost',
    pg_port: 5432,
    pg_database: 'ed_dashboard',
    pg_user: 'postgres',
    pg_password: '',
    pg_ssl: false,
    max_connections: 10,
  };
}

export function getDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return sanitizeSafeDataFilePath(process.env.DATABASE_PATH, 'ed_dashboard.db').resolvedAbsolutePath;
  }
  const cfg = getDbConfig();
  if (cfg.sqlite_path) {
    return sanitizeSafeDataFilePath(cfg.sqlite_path, 'ed_dashboard.db').resolvedAbsolutePath;
  }
  return path.join(process.cwd(), 'data', 'ed_dashboard.db');
}

let dbInstance: DatabaseSync | null = null;
let transactionDepth = 0;

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  const isNested = transactionDepth > 0;
  const savepointName = `sp_${transactionDepth}`;
  transactionDepth++;
  try {
    if (isNested) {
      db.exec(`SAVEPOINT ${savepointName}`);
    } else {
      db.exec('BEGIN IMMEDIATE');
    }
    const result = fn();
    if (isNested) {
      db.exec(`RELEASE SAVEPOINT ${savepointName}`);
    } else {
      db.exec('COMMIT');
    }
    return result;
  } catch (err) {
    try {
      if (isNested) {
        db.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } else {
        db.exec('ROLLBACK');
      }
    } catch (rollbackErr) {
      console.error('[DB] Gagal melakukan rollback transaksi:', rollbackErr);
    }
    throw err;
  } finally {
    transactionDepth = Math.max(0, transactionDepth - 1);
  }
}

function execSafeMigration(db: DatabaseSync, sql: string) {
  try {
    db.exec(sql);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('duplicate column name')) {
      console.warn('[DB Migration] Peringatan eksekusi migrasi:', msg);
    }
  }
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const activePath = getDbPath();
    const dir = path.dirname(activePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new DatabaseSync(activePath);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function saveDbConfig(cfg: Partial<DatabaseConfig>, updatedBy?: string): DatabaseConfig {
  const current = getDbConfig();
  const safePath = cfg.sqlite_path
    ? sanitizeSafeDataFilePath(cfg.sqlite_path, 'ed_dashboard.db').safeRelativePath
    : current.sqlite_path;
  const resolvedPgPassword =
    cfg.pg_password === SECRET_MASK || cfg.pg_password === undefined
      ? current.pg_password || ''
      : cfg.pg_password;

  const updated: DatabaseConfig = {
    ...current,
    ...cfg,
    sqlite_path: safePath,
    pg_password: resolvedPgPassword,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || 'Administrator',
  };
  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');

  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ('cfg_database', 'database_config', ?, ?)
    `).run(JSON.stringify(updated), updated.updated_at!);
  } catch (e) {
    console.warn('[DB] Gagal menyimpan konfigurasi database ke integration_settings:', e);
  }

  if (safePath && safePath !== current.sqlite_path) {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (e) {
        console.warn('[DB] Gagal menutup koneksi SQLite lama:', e);
      }
      dbInstance = null;
    }
  }

  return updated;
}

function initSchema(db: DatabaseSync) {
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
  `);

  execSafeMigration(db, "ALTER TABLE branches ADD COLUMN order_seq INTEGER DEFAULT 99;");
  execSafeMigration(db, "UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
  execSafeMigration(db, "DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");

  try {
    const updateOrderStmt = db.prepare("UPDATE branches SET order_seq = ? WHERE code = ?");
    for (const b of OFFICIAL_BRANCHES) {
      updateOrderStmt.run(b.order, b.code);
    }
  } catch (e) {
    console.warn('[DB Migration] Gagal memperbarui urutan cabang:', e);
  }

  // User table migrations
  execSafeMigration(db, "ALTER TABLE users ADD COLUMN nipp TEXT;");
  execSafeMigration(db, "ALTER TABLE users ADD COLUMN divisi TEXT;");
  execSafeMigration(db, "ALTER TABLE users ADD COLUMN departemen TEXT;");
  execSafeMigration(db, "ALTER TABLE users ADD COLUMN password TEXT;");
  execSafeMigration(db, "ALTER TABLE users ADD COLUMN created_at TEXT;");
  execSafeMigration(
    db,
    "DELETE FROM users WHERE id IN ('usr_pic_nmk', 'usr_viewer', 'usr_super', 'usr_pic_ops', 'usr_adminreg') OR username IN ('pic_nmk', 'bod_regional', 'superadmin', 'pic_ops', 'adminreg');"
  );

  // Ensure default official PICs exist with NIPP and migrate any plaintext passwords to scrypt hashes
  try {
    const existing = db.prepare("SELECT COUNT(*) as count FROM users WHERE nipp IS NOT NULL AND nipp != ''").get() as { count: number };
    if (!existing || existing.count === 0) {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO users (id, username, nipp, name, email, divisi, departemen, password, role, branch_id, department_id, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < INITIAL_OFFICIAL_PICS.length; i++) {
        const u = INITIAL_OFFICIAL_PICS[i];
        insertStmt.run(
          `usr_${u.nipp}_${i + 1}`,
          u.nipp,
          u.nipp,
          u.name,
          u.email || `${u.nipp}@pelindo.co.id`,
          u.divisi,
          u.departemen,
          hashPassword(u.password || 'password123'),
          u.role,
          u.branch_id || null,
          u.department_id || null,
          u.active ? 1 : 0,
          u.created_at || new Date().toISOString()
        );
      }
      const allUsers = db.prepare("SELECT * FROM users ORDER BY nipp ASC").all().map(toSafeUser);
      exportUsersToSpreadsheet(allUsers);
    } else {
      // Automatically migrate any legacy unhashed passwords in the database to scrypt hashes
      const userRows = db.prepare("SELECT id, password FROM users").all() as Array<{ id: string; password: string | null }>;
      const updatePassStmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");
      for (const row of userRows) {
        const rawPass = row.password || 'password123';
        if (!isPasswordHashed(rawPass)) {
          updatePassStmt.run(hashPassword(rawPass), row.id);
        }
      }
    }
  } catch (e) {
    console.error('Auto-seed users error:', e);
  }
}

// Helper to seed if empty
export function isDatabaseEmpty(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  return row.count === 0;
}

// Database query helpers
export const dbQueries = {
  // Branches
  getBranches: (): Branch[] => {
    const rows = getDb().prepare('SELECT * FROM branches ORDER BY order_seq ASC, code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as Branch),
      active: Boolean(r.active),
      facilities: typeof r.facilities === 'string' && r.facilities ? JSON.parse(r.facilities) : {}
    }));
  },
  getBranchById: (id: string): Branch | null => {
    const r = getDb().prepare('SELECT * FROM branches WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...(r as unknown as Branch),
      active: Boolean(r.active),
      facilities: typeof r.facilities === 'string' && r.facilities ? JSON.parse(r.facilities) : {}
    };
  },

  // Departments
  getDepartments: (): Department[] => {
    const rows = getDb().prepare('SELECT * FROM departments ORDER BY code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as Department),
      active: Boolean(r.active)
    }));
  },

  // Equipment Catalog
  getEquipmentCatalog: (): EquipmentItem[] => {
    const rows = getDb().prepare('SELECT * FROM equipment_catalog ORDER BY code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as EquipmentItem),
      active: Boolean(r.active)
    }));
  },

  // Users / PIC (Always sanitized via toSafeUser so password hash is never exposed)
  getUsers: (): User[] => {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY nipp ASC, name ASC').all();
    return rows.map(toSafeUser);
  },
  getUserByNipp: (nipp: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE nipp = ? OR username = ?').get(nipp, nipp);
    if (!r) return null;
    return toSafeUser(r);
  },
  getUserByUsername: (username: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE username = ? OR nipp = ?').get(username, username);
    if (!r) return null;
    return toSafeUser(r);
  },
  getUserById: (id: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!r) return null;
    return toSafeUser(r);
  },
  createUser: (data: {
    nipp: string;
    name: string;
    divisi: string;
    departemen: string;
    password: string;
    role?: UserRole;
    email?: string;
    branch_id?: string | null;
    department_id?: string | null;
  }): User => {
    const db = getDb();
    const cleanNipp = String(data.nipp).trim();
    const rawPassword = String(data.password || '').trim();
    if (!rawPassword || rawPassword.length < 8) {
      throw new Error('Kata sandi wajib diisi dengan minimal 8 karakter.');
    }
    const id = `usr_${cleanNipp}_${Date.now()}`;
    const role: UserRole = data.role || 'pic_cabang';
    const email = data.email || `${cleanNipp}@pelindo.co.id`;
    const hashedPassword = hashPassword(rawPassword);
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO users (id, username, nipp, name, email, divisi, departemen, password, role, branch_id, department_id, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    stmt.run(
      id,
      cleanNipp,
      cleanNipp,
      data.name.trim(),
      email,
      data.divisi.trim(),
      data.departemen.trim(),
      hashedPassword,
      role,
      data.branch_id || null,
      data.department_id || null,
      createdAt
    );

    const newUser: User = {
      id,
      username: cleanNipp,
      nipp: cleanNipp,
      name: data.name.trim(),
      email,
      divisi: data.divisi.trim(),
      departemen: data.departemen.trim(),
      role,
      branch_id: data.branch_id || null,
      department_id: data.department_id || null,
      active: true,
      created_at: createdAt,
    };

    // Automatically sync master spreadsheet in My Drive
    try {
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {
      console.error('Failed to sync to spreadsheet on createUser:', e);
    }

    return newUser;
  },
  updateUser: (id: string, data: Partial<User>): User | null => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : String(existing.name || '');
    const cleanNipp = data.nipp !== undefined ? String(data.nipp).trim() : String(existing.nipp || existing.username || '');
    const divisi = data.divisi !== undefined ? data.divisi : String(existing.divisi || '');
    const departemen = data.departemen !== undefined ? data.departemen : String(existing.departemen || '');
    const role = (data.role !== undefined ? data.role : existing.role) as UserRole;
    const branch_id = data.branch_id !== undefined ? data.branch_id : (existing.branch_id as string | null);
    const department_id = data.department_id !== undefined ? data.department_id : (existing.department_id as string | null);
    const email = data.email !== undefined ? data.email : (String(existing.email || '') || `${cleanNipp}@pelindo.co.id`);
    const active = data.active !== undefined ? (data.active ? 1 : 0) : Number(existing.active ?? 1);
    const existingPwd = String(existing.password || '');
    const password =
      data.password && data.password.trim().length > 0
        ? hashPassword(data.password.trim())
        : isPasswordHashed(existingPwd)
          ? existingPwd
          : hashPassword(existingPwd || randomBytes(16).toString('hex'));

    db.prepare(`
      UPDATE users 
      SET name = ?, username = ?, nipp = ?, divisi = ?, departemen = ?, role = ?, branch_id = ?, department_id = ?, email = ?, active = ?, password = ?
      WHERE id = ?
    `).run(name, cleanNipp, cleanNipp, divisi, departemen, role, branch_id, department_id, email, active, password, id);

    try {
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {
      console.warn('[DB] Gagal mengekspor daftar pengguna ke spreadsheet pada updateUser:', e);
    }

    return dbQueries.getUserById(id);
  },
  deleteUser: (id: string): boolean => {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    try {
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {
      console.warn('[DB] Gagal mengekspor daftar pengguna ke spreadsheet pada deleteUser:', e);
    }
    return true;
  },
  authenticateUser: (nipp: string, password: string): User | null => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp || !password) return null;

    const db = getDb();
    const rawRow = db.prepare('SELECT * FROM users WHERE nipp = ? OR username = ?').get(cleanNipp, cleanNipp);
    if (!rawRow) return null;

    const storedPassword = String(rawRow.password || '');
    if (!verifyPassword(password, storedPassword)) {
      return null;
    }

    // Upgrade to scrypt hash if row was somehow not yet hashed
    if (!isPasswordHashed(storedPassword)) {
      try {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), String(rawRow.id));
      } catch (e) {
        console.warn('[DB] Gagal memutakhirkan hash kata sandi:', e);
      }
    }

    return toSafeUser(rawRow);
  },

  // Indicators
  getIndicators: (departmentId?: string): KPIIndicator[] => {
    const db = getDb();
    let rows: Record<string, unknown>[];
    if (departmentId) {
      rows = db.prepare('SELECT * FROM kpi_indicators WHERE department_id = ? ORDER BY code ASC').all(departmentId);
    } else {
      rows = db.prepare('SELECT * FROM kpi_indicators ORDER BY department_id ASC, code ASC').all();
    }
    return rows.map(r => ({
      ...(r as unknown as KPIIndicator),
      is_core_kpi: Boolean(r.is_core_kpi),
      active: Boolean(r.active)
    }));
  },

  // Templates
  getTemplates: (): TemplateConfig[] => {
    const rows = getDb().prepare('SELECT * FROM templates ORDER BY department_id ASC').all();
    return rows.map(r => ({
      ...(r as unknown as TemplateConfig),
      columns: JSON.parse(String(r.columns || '[]'))
    }));
  },
  getTemplateByDept: (deptId: string): TemplateConfig | null => {
    const r = getDb().prepare('SELECT * FROM templates WHERE department_id = ?').get(deptId);
    if (!r) return null;
    return {
      ...(r as unknown as TemplateConfig),
      columns: JSON.parse(String(r.columns || '[]'))
    };
  },
  saveTemplate: (template: TemplateConfig) => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(template.id);
    if (existing) {
      db.prepare(`
        UPDATE templates 
        SET department_id = ?, version = ?, name = ?, description = ?, columns = ?, updated_at = ?
        WHERE id = ?
      `).run(
        template.department_id,
        template.version,
        template.name,
        template.description,
        JSON.stringify(template.columns),
        new Date().toISOString(),
        template.id
      );
    } else {
      db.prepare(`
        INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        template.id,
        template.department_id,
        template.version,
        template.name,
        template.description,
        JSON.stringify(template.columns),
        new Date().toISOString()
      );
    }
  },

  // Monthly Records
  getMonthlyRecords: (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
  }): MonthlyRecord[] => {
    const db = getDb();
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter.branch_id && filter.branch_id !== 'ALL') {
      if (filter.branch_id === 'NONE') {
        conditions.push('1 = 0');
      } else {
        const tokens = filter.branch_id
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        if (tokens.length === 1) {
          conditions.push('(r.branch_id = ? OR UPPER(b.code) = UPPER(?))');
          params.push(tokens[0], tokens[0]);
        } else if (tokens.length > 1) {
          const placeholders = tokens.map(() => '(r.branch_id = ? OR UPPER(b.code) = UPPER(?))').join(' OR ');
          conditions.push(`(${placeholders})`);
          for (const tok of tokens) {
            params.push(tok, tok);
          }
        }
      }
    }
    if (filter.department_id && filter.department_id !== 'ALL') {
      conditions.push('r.department_id = ?');
      params.push(filter.department_id);
    }
    if (filter.month) {
      conditions.push('r.month = ?');
      params.push(filter.month);
    }
    if (filter.year) {
      conditions.push('r.year = ?');
      params.push(filter.year);
    }
    if (filter.verified_only) {
      conditions.push("r.verification_status = 'verified'");
    } else if (filter.verification_status && filter.verification_status !== 'ALL') {
      conditions.push('r.verification_status = ?');
      params.push(filter.verification_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT r.*, 
             b.name as branch_name, b.code as branch_code,
             d.name as department_name,
             k.name as indicator_name, k.code as indicator_code, k.direction
      FROM monthly_records r
      JOIN branches b ON r.branch_id = b.id
      JOIN departments d ON r.department_id = d.id
      JOIN kpi_indicators k ON r.indicator_id = k.id
      ${whereClause}
      ORDER BY r.year DESC, r.month DESC, b.code ASC, k.code ASC
    `;

    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({
      ...(r as unknown as MonthlyRecord),
      is_simulated: Boolean(r.is_simulated)
    }));
  },

  getMonthlyRecordsByIds: (recordIds: string[]): MonthlyRecord[] => {
    if (!recordIds || recordIds.length === 0) return [];
    const db = getDb();
    const placeholders = recordIds.map(() => '?').join(', ');
    const rows = db
      .prepare(`SELECT * FROM monthly_records WHERE id IN (${placeholders})`)
      .all(...recordIds);
    return rows.map(r => ({
      ...(r as unknown as MonthlyRecord),
      is_simulated: Boolean(r.is_simulated),
    }));
  },

  // Update record verification across monthly_records and all module_* tables
  updateRecordVerification: (
    recordIds: string[],
    status: 'verified' | 'revision_needed',
    verifiedBy: string,
    revisionNotes?: string
  ) => {
    if (!recordIds || recordIds.length === 0) return;
    const db = getDb();
    const now = new Date().toISOString();
    withTransaction(db, () => {
      const stmt = db.prepare(`
        UPDATE monthly_records
        SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?
        WHERE id = ?
      `);
      const moduleTables = [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ];
      const moduleStmts = moduleTables.map(table =>
        db.prepare(
          status === 'verified'
            ? `UPDATE ${table}
               SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?, verified_snapshot_json = NULL
               WHERE id = ? OR monthly_record_id = ?`
            : `UPDATE ${table}
               SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?
               WHERE id = ? OR monthly_record_id = ?`
        )
      );

      for (const id of recordIds) {
        stmt.run(status, verifiedBy, now, revisionNotes || null, id);
        for (const modStmt of moduleStmts) {
          modStmt.run(status, verifiedBy, now, revisionNotes || null, id, id);
        }
      }
    });
  },

  // Save imported records
  insertMonthlyRecords: (records: Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>[]) => {
    if (!records || records.length === 0) return;
    const db = getDb();
    withTransaction(db, () => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO monthly_records (
          id, branch_id, department_id, indicator_id, month, year,
          target, realization, unit, achievement_pct, status_color, notes,
          source_type, batch_id, verification_status, revision_notes,
          uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const r of records) {
        stmt.run(
          r.id,
          r.branch_id,
          r.department_id,
          r.indicator_id,
          r.month,
          r.year,
          r.target,
          r.realization,
          r.unit,
          r.achievement_pct,
          r.status_color,
          r.notes || '',
          r.source_type,
          r.batch_id || null,
          r.verification_status,
          r.revision_notes || null,
          r.uploaded_by,
          r.uploaded_at,
          r.verified_by || null,
          r.verified_at || null,
          r.is_simulated ? 1 : 0
        );
      }
    });
  },

  // Import Batches
  createImportBatch: (batch: ImportBatch) => {
    const db = getDb();
    db.prepare(`
      INSERT INTO import_batches (
        id, filename_or_url, source_type, department_id, branch_id,
        period_month, period_year, total_rows, valid_rows, error_rows,
        status, uploaded_by, uploaded_at, error_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batch.id,
      batch.filename_or_url,
      batch.source_type,
      batch.department_id || null,
      batch.branch_id || null,
      batch.period_month,
      batch.period_year,
      batch.total_rows,
      batch.valid_rows,
      batch.error_rows,
      batch.status,
      batch.uploaded_by,
      batch.uploaded_at,
      batch.error_log ? JSON.stringify(batch.error_log) : null
    );
  },
  getImportBatches: (): ImportBatch[] => {
    const rows = getDb().prepare('SELECT * FROM import_batches ORDER BY uploaded_at DESC LIMIT 50').all();
    return rows.map(r => ({
      ...(r as unknown as ImportBatch),
      error_log: typeof r.error_log === 'string' && r.error_log ? JSON.parse(r.error_log) : null
    }));
  },

  // Audit Log
  createAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const db = getDb();
    const id = 'aud_' + Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.user_id,
      log.user_name,
      log.user_role,
      log.action,
      log.entity,
      log.entity_id || null,
      log.details,
      timestamp,
      log.ip_address || '127.0.0.1'
    );
  },
  getAuditLogs: (limit = 100): AuditLog[] => {
    return getDb().prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as unknown as AuditLog[];
  },

  // Google Sheets Config
  getGoogleSheetsConfig: (): GoogleSheetsConfig => {
    const row = getDb().prepare("SELECT config_json FROM integration_settings WHERE service_name = 'google_sheets'").get();
    if (!row) {
      return {
        id: 'cfg_gsheet',
        spreadsheet_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
        sheet_name: 'Input_Kinerja_Bulanan',
        range: 'A2:L200',
        service_account_email: 'regdashr@gmail.com',
        api_key_configured: false,
        status: 'ready_for_credentials',
        last_sync_at: null,
        auto_sync_enabled: false
      };
    }
    return JSON.parse(String(row.config_json));
  },
  saveGoogleSheetsConfig: (cfg: GoogleSheetsConfig) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES (?, 'google_sheets', ?, ?)
    `).run('cfg_gsheet', JSON.stringify(cfg), now);
  },

  // System & Session Parameters
  getSystemParameters: (): SystemParameters => {
    const row = getDb().prepare("SELECT config_json FROM integration_settings WHERE service_name = 'system_parameters'").get();
    if (!row) {
      return {
        session_timeout_minutes: 30,
        auto_logout_idle: true,
        warning_before_minutes: 2,
        default_theme: 'light',
      };
    }
    return {
      session_timeout_minutes: 30,
      auto_logout_idle: true,
      warning_before_minutes: 2,
      default_theme: 'light',
      ...JSON.parse(String(row.config_json)),
    };
  },
  saveSystemParameters: (params: Partial<SystemParameters>): SystemParameters => {
    const db = getDb();
    const current = dbQueries.getSystemParameters();
    const updated: SystemParameters = {
      ...current,
      ...params,
      updated_at: new Date().toISOString(),
    };
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ('cfg_system_params', 'system_parameters', ?, ?)
    `).run(JSON.stringify(updated), updated.updated_at!);
    return updated;
  },

  // Database Location & Connection Configuration
  getDbConfig: (): DatabaseConfig => {
    return getDbConfig();
  },
  saveDbConfig: (cfg: Partial<DatabaseConfig>, updatedBy?: string): DatabaseConfig => {
    return saveDbConfig(cfg, updatedBy);
  },

  // External Integration Credentials (Google Drive, Sheets, Gateway)
  getIntegrationCredentials: (): IntegrationCredentials => {
    const row = getDb().prepare("SELECT config_json FROM integration_settings WHERE service_name = 'integration_credentials'").get();
    if (!row) {
      return {
        google_drive_email: 'regdashr@gmail.com',
        google_drive_file_path: 'data/input_data.xlsx',
        google_sheets_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
        google_sheets_name: 'Input_Kinerja_Bulanan',
        google_api_key: '',
        api_gateway_url: 'https://api.pelindo.co.id/v1/r4',
        api_gateway_token: '',
      };
    }
    return {
      google_drive_email: 'regdashr@gmail.com',
      google_drive_file_path: 'data/input_data.xlsx',
      google_sheets_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
      google_sheets_name: 'Input_Kinerja_Bulanan',
      ...JSON.parse(String(row.config_json)),
    };
  },
  saveIntegrationCredentials: (creds: Partial<IntegrationCredentials>, updatedBy?: string): IntegrationCredentials => {
    const db = getDb();
    const current = dbQueries.getIntegrationCredentials();
    const safeDrivePath = creds.google_drive_file_path
      ? sanitizeSafeDataFilePath(creds.google_drive_file_path, 'input_data.xlsx', ['.xlsx', '.xls', '.csv']).safeRelativePath
      : current.google_drive_file_path || 'data/input_data.xlsx';
    const resolvedApiKey =
      creds.google_api_key === SECRET_MASK || creds.google_api_key === undefined
        ? current.google_api_key || ''
        : creds.google_api_key;
    const resolvedGatewayToken =
      creds.api_gateway_token === SECRET_MASK || creds.api_gateway_token === undefined
        ? current.api_gateway_token || ''
        : creds.api_gateway_token;

    const updated: IntegrationCredentials = {
      ...current,
      ...creds,
      google_drive_file_path: safeDrivePath,
      google_api_key: resolvedApiKey,
      api_gateway_token: resolvedGatewayToken,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || 'Administrator',
    };
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ('cfg_credentials', 'integration_credentials', ?, ?)
    `).run(JSON.stringify(updated), updated.updated_at!);

    try {
      const currentGSheet = dbQueries.getGoogleSheetsConfig();
      dbQueries.saveGoogleSheetsConfig({
        ...currentGSheet,
        spreadsheet_id: updated.google_sheets_id || currentGSheet.spreadsheet_id,
        sheet_name: updated.google_sheets_name || currentGSheet.sheet_name,
        service_account_email: updated.google_drive_email || currentGSheet.service_account_email,
      });
    } catch (e) {
      console.warn('[DB] Gagal menyinkronkan konfigurasi Google Sheets:', e);
    }

    return updated;
  },

  // Persistent Shared Login Rate Limit Storage (SQLite WAL for multi-instance & restart resilience)
  getRateLimitEntry: (rateKey: string): { attempt_count: number; first_failed_at: number; locked_until: number } | null => {
    const db = getDb();
    const row = db
      .prepare('SELECT attempt_count, first_failed_at, locked_until FROM auth_rate_limits WHERE rate_key = ?')
      .get(rateKey) as { attempt_count: number; first_failed_at: number; locked_until: number } | undefined;
    return row || null;
  },
  upsertRateLimitEntry: (rateKey: string, attemptCount: number, firstFailedAt: number, lockedUntil: number): void => {
    const db = getDb();
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO auth_rate_limits (rate_key, attempt_count, first_failed_at, locked_until, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(rate_key) DO UPDATE SET
        attempt_count = excluded.attempt_count,
        first_failed_at = excluded.first_failed_at,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    `).run(rateKey, attemptCount, firstFailedAt, lockedUntil, nowIso);
  },
  deleteRateLimitEntry: (rateKey: string): void => {
    const db = getDb();
    db.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').run(rateKey);
  },

  // Atomic transactional commit for imported records + batch metadata + audit log
  commitImportTransaction: (params: {
    records: Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>[];
    batch: ImportBatch;
    auditLog: Omit<AuditLog, 'id' | 'timestamp'>;
  }): void => {
    const db = getDb();
    withTransaction(db, () => {
      dbQueries.insertMonthlyRecords(params.records);
      dbQueries.createImportBatch(params.batch);
      dbQueries.createAuditLog(params.auditLog);
    });
  },
};
