import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { DatabaseConfig } from '../types';
import { encryptSecret, decryptSecret } from '../secrets';
import { migrationStatus } from '../migrations';
import { SECRET_MASK, sanitizeSafeDataFilePath } from './helpers';
import { initSchema } from './schema';

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
        // Credentials are stored encrypted; callers always receive plaintext.
        pg_password: decryptSecret(parsed.pg_password),
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

/**
 * Migration status for the running database (`CODE-12`): what has been applied and
 * what the current code still expects. Exposed so an operator can answer "is this
 * database up to date?" without reading `schema_migrations` by hand.
 */
export function getMigrationStatus() {
  return migrationStatus(getDb());
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
  // Never write the database password as plaintext to disk.
  const filePayload = {
    ...updated,
    pg_password: updated.pg_password ? encryptSecret(updated.pg_password) : '',
  };
  fs.writeFileSync(configPath, JSON.stringify(filePayload, null, 2), 'utf8');

  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ('cfg_database', 'database_config', ?, ?)
    `).run(JSON.stringify(filePayload), updated.updated_at!);
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

// Helper to seed if empty
export function isDatabaseEmpty(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  return row.count === 0;
}
