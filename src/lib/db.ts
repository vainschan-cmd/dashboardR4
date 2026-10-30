import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import {
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
} from './types';
import { OFFICIAL_BRANCHES } from './constants';

// Ensure data folder exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ed_dashboard.db');
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initSchema(dbInstance);
  }
  return dbInstance;
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
  `);

  try {
    db.exec("ALTER TABLE branches ADD COLUMN order_seq INTEGER DEFAULT 99;");
  } catch {}
  try {
    db.exec("UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
    db.exec("DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");
  } catch {}
  try {
    const updateOrderStmt = db.prepare("UPDATE branches SET order_seq = ? WHERE code = ?");
    for (const b of OFFICIAL_BRANCHES) {
      updateOrderStmt.run(b.order, b.code);
    }
  } catch {}

  // User table migrations
  try { db.exec("ALTER TABLE users ADD COLUMN nipp TEXT;"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN divisi TEXT;"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN departemen TEXT;"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN password TEXT;"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN created_at TEXT;"); } catch {}
  try {
    db.exec("DELETE FROM users WHERE id IN ('usr_pic_nmk', 'usr_viewer', 'usr_super', 'usr_pic_ops', 'usr_adminreg') OR username IN ('pic_nmk', 'bod_regional', 'superadmin', 'pic_ops', 'adminreg');");
  } catch {}

  // Ensure default official PICs exist with NIPP
  try {
    const existing = db.prepare("SELECT COUNT(*) as count FROM users WHERE nipp IS NOT NULL AND nipp != ''").get() as { count: number };
    if (!existing || existing.count === 0) {
      const { INITIAL_OFFICIAL_PICS, exportUsersToSpreadsheet } = require('./userPicSync');
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
          u.password || 'password123',
          u.role,
          u.branch_id || null,
          u.department_id || null,
          u.active ? 1 : 0,
          u.created_at || new Date().toISOString()
        );
      }
      const allUsers = db.prepare("SELECT * FROM users ORDER BY nipp ASC").all() as any[];
      exportUsersToSpreadsheet(allUsers);
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
    const rows = getDb().prepare('SELECT * FROM branches ORDER BY order_seq ASC, code ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      active: Boolean(r.active),
      facilities: r.facilities ? JSON.parse(r.facilities) : {}
    }));
  },
  getBranchById: (id: string): Branch | null => {
    const r = getDb().prepare('SELECT * FROM branches WHERE id = ?').get(id) as any;
    if (!r) return null;
    return {
      ...r,
      active: Boolean(r.active),
      facilities: r.facilities ? JSON.parse(r.facilities) : {}
    };
  },

  // Departments
  getDepartments: (): Department[] => {
    const rows = getDb().prepare('SELECT * FROM departments ORDER BY code ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      active: Boolean(r.active)
    }));
  },

  // Equipment Catalog
  getEquipmentCatalog: (): EquipmentItem[] => {
    const rows = getDb().prepare('SELECT * FROM equipment_catalog ORDER BY code ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      active: Boolean(r.active)
    }));
  },

  // Users / PIC
  getUsers: (): User[] => {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY nipp ASC, name ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      nipp: r.nipp || r.username,
      active: Boolean(r.active)
    }));
  },
  getUserByNipp: (nipp: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE nipp = ? OR username = ?').get(nipp, nipp) as any;
    if (!r) return null;
    return { ...r, nipp: r.nipp || r.username, active: Boolean(r.active) };
  },
  getUserByUsername: (username: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE username = ? OR nipp = ?').get(username, username) as any;
    if (!r) return null;
    return { ...r, nipp: r.nipp || r.username, active: Boolean(r.active) };
  },
  createUser: (data: {
    nipp: string;
    name: string;
    divisi: string;
    departemen: string;
    password?: string;
    role?: UserRole;
    email?: string;
    branch_id?: string | null;
    department_id?: string | null;
  }): User => {
    const db = getDb();
    const cleanNipp = String(data.nipp).trim();
    const id = `usr_${cleanNipp}_${Date.now()}`;
    const role: UserRole = data.role || 'pic_cabang';
    const email = data.email || `${cleanNipp}@pelindo.co.id`;
    const password = data.password || 'password123';
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
      password,
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
      const { exportUsersToSpreadsheet } = require('./userPicSync');
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {
      console.error('Failed to sync to spreadsheet on createUser:', e);
    }

    return newUser;
  },
  updateUser: (id: string, data: Partial<User>): User | null => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : existing.name;
    const divisi = data.divisi !== undefined ? data.divisi : existing.divisi;
    const departemen = data.departemen !== undefined ? data.departemen : existing.departemen;
    const role = data.role !== undefined ? data.role : existing.role;
    const branch_id = data.branch_id !== undefined ? data.branch_id : existing.branch_id;
    const active = data.active !== undefined ? (data.active ? 1 : 0) : existing.active;

    db.prepare(`
      UPDATE users SET name = ?, divisi = ?, departemen = ?, role = ?, branch_id = ?, active = ?
      WHERE id = ?
    `).run(name, divisi, departemen, role, branch_id, active, id);

    try {
      const { exportUsersToSpreadsheet } = require('./userPicSync');
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {}

    return dbQueries.getUserByUsername(existing.username);
  },
  deleteUser: (id: string): boolean => {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    try {
      const { exportUsersToSpreadsheet } = require('./userPicSync');
      exportUsersToSpreadsheet(dbQueries.getUsers());
    } catch (e) {}
    return true;
  },
  authenticateUser: (nipp: string, password: string): User | null => {
    const cleanNipp = String(nipp).trim();
    const user = dbQueries.getUserByNipp(cleanNipp);
    if (!user) return null;
    // Check password if set
    if (user.password && user.password !== password) {
      return null;
    }
    return user;
  },

  // Indicators
  getIndicators: (departmentId?: string): KPIIndicator[] => {
    const db = getDb();
    let rows: any[];
    if (departmentId) {
      rows = db.prepare('SELECT * FROM kpi_indicators WHERE department_id = ? ORDER BY code ASC').all(departmentId);
    } else {
      rows = db.prepare('SELECT * FROM kpi_indicators ORDER BY department_id ASC, code ASC').all();
    }
    return rows.map(r => ({
      ...r,
      is_core_kpi: Boolean(r.is_core_kpi),
      active: Boolean(r.active)
    }));
  },

  // Templates
  getTemplates: (): TemplateConfig[] => {
    const rows = getDb().prepare('SELECT * FROM templates ORDER BY department_id ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      columns: JSON.parse(r.columns)
    }));
  },
  getTemplateByDept: (deptId: string): TemplateConfig | null => {
    const r = getDb().prepare('SELECT * FROM templates WHERE department_id = ?').get(deptId) as any;
    if (!r) return null;
    return {
      ...r,
      columns: JSON.parse(r.columns)
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
    const params: any[] = [];

    if (filter.branch_id && filter.branch_id !== 'ALL') {
      conditions.push('r.branch_id = ?');
      params.push(filter.branch_id);
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

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      ...r,
      is_simulated: Boolean(r.is_simulated)
    }));
  },

  // Update record verification
  updateRecordVerification: (
    recordIds: string[],
    status: 'verified' | 'revision_needed',
    verifiedBy: string,
    revisionNotes?: string
  ) => {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE monthly_records
      SET verification_status = ?, verified_by = ?, verified_at = ?, revision_notes = ?
      WHERE id = ?
    `);
    for (const id of recordIds) {
      stmt.run(status, verifiedBy, now, revisionNotes || null, id);
    }
  },

  // Save imported records
  insertMonthlyRecords: (records: Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>[]) => {
    const db = getDb();
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
    const rows = getDb().prepare('SELECT * FROM import_batches ORDER BY uploaded_at DESC LIMIT 50').all() as any[];
    return rows.map(r => ({
      ...r,
      error_log: r.error_log ? JSON.parse(r.error_log) : null
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
    return getDb().prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as AuditLog[];
  },

  // Google Sheets Config
  getGoogleSheetsConfig: (): GoogleSheetsConfig => {
    const row = getDb().prepare("SELECT config_json FROM integration_settings WHERE service_name = 'google_sheets'").get() as any;
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
    return JSON.parse(row.config_json);
  },
  saveGoogleSheetsConfig: (cfg: GoogleSheetsConfig) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES (?, 'google_sheets', ?, ?)
    `).run('cfg_gsheet', JSON.stringify(cfg), now);
  }
};
