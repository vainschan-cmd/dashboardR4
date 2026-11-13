import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import path from 'path';
import fs from 'fs';
import type { DatabaseConfig } from '../types';
import { decryptSecret, encryptSecret } from '../secrets';
import { SECRET_MASK, sanitizeSafeDataFilePath } from './helpers';

// Configure PostgreSQL type parsers so numeric/date fields align with JS types
types.setTypeParser(20, (val: string) => parseInt(val, 10)); // INT8 / BIGINT -> number
types.setTypeParser(1700, (val: string) => parseFloat(val)); // NUMERIC / DECIMAL -> number
types.setTypeParser(1184, (val: string) => (val ? new Date(val).toISOString() : val)); // TIMESTAMPTZ -> string
types.setTypeParser(1114, (val: string) => (val ? new Date(val + 'Z').toISOString() : val)); // TIMESTAMP -> string

let pgPoolInstance: Pool | null = null;

function getEnvDatabaseUrl(): string | null {
  const raw = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (!raw || raw.startsWith('file:')) return null;
  if (raw.startsWith('postgresql://') || raw.startsWith('postgres://')) {
    return raw;
  }
  return null;
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

// Database location & configuration management
export function getDbConfig(): DatabaseConfig {
  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  let parsed: Partial<DatabaseConfig> = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Error reading db_config.json:', e);
    }
  }

  const envUrl = getEnvDatabaseUrl();
  let envHost: string | undefined;
  let envPort: number | undefined;
  let envDb: string | undefined;
  let envUser: string | undefined;
  let envPass: string | undefined;
  let envSsl: boolean | undefined;

  if (envUrl) {
    try {
      const u = new URL(envUrl);
      envHost = u.hostname || undefined;
      envPort = u.port ? Number(u.port) : undefined;
      envDb = u.pathname ? u.pathname.replace(/^\//, '') : undefined;
      envUser = u.username ? decodeURIComponent(u.username) : undefined;
      envPass = u.password ? decodeURIComponent(u.password) : undefined;
      envSsl = u.searchParams.get('sslmode') === 'require' || undefined;
    } catch {}
  }

  const effectivePassword = envPass || (parsed.pg_password ? decryptSecret(parsed.pg_password) : 'ictpi4');

  return {
    engine: 'postgres',
    sqlite_path: 'data/ed_dashboard.db',
    pg_host: envHost || process.env.PGHOST || parsed.pg_host || 'localhost',
    pg_port: envPort || (process.env.PGPORT ? Number(process.env.PGPORT) : undefined) || parsed.pg_port || 5432,
    pg_database: envDb || process.env.PGDATABASE || parsed.pg_database || 'ed_dashboard',
    pg_user: envUser || process.env.PGUSER || parsed.pg_user || 'postgres',
    pg_password: effectivePassword,
    pg_ssl: envSsl ?? parsed.pg_ssl ?? false,
    max_connections: parsed.max_connections || 10,
    updated_at: parsed.updated_at,
    updated_by: parsed.updated_by,
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

export function isPostgresActive(): boolean {
  return true;
}

export function getPool(): Pool {
  if (!pgPoolInstance) {
    const envUrl = getEnvDatabaseUrl();
    const cfg = getDbConfig();

    if (envUrl) {
      pgPoolInstance = new Pool({
        connectionString: envUrl,
        max: Number(cfg.max_connections) || 10,
        ssl: cfg.pg_ssl ? { rejectUnauthorized: false } : undefined,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      pgPoolInstance = new Pool({
        host: cfg.pg_host || 'localhost',
        port: Number(cfg.pg_port) || 5432,
        database: cfg.pg_database || 'ed_dashboard',
        user: cfg.pg_user || 'postgres',
        password: cfg.pg_password || 'ictpi4',
        max: Number(cfg.max_connections) || 10,
        ssl: cfg.pg_ssl ? { rejectUnauthorized: false } : undefined,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    pgPoolInstance.on('error', (err) => {
      console.error('[PG Pool Error]', err);
    });
  }
  return pgPoolInstance;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params: readonly unknown[] = []
): Promise<{ rows: T[] }> {
  const pool = getPool();
  const res = await pool.query<T>(text, params as any[]);
  return { rows: res.rows };
}

export async function withTransaction<T>(
  firstArg: any,
  secondArg?: any
): Promise<T> {
  const fn =
    typeof secondArg === 'function'
      ? secondArg
      : typeof firstArg === 'function'
        ? firstArg
        : null;
  if (!fn) throw new Error('Transaction callback is required');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[PG] Transaksi rollback gagal:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fallback blocker: SQLite telah dihapus.
 * Fungsi ini melempar Exception keras jika ada pemanggilan tak terduga.
 */
export function getDb(): any {
  throw new Error('Basis data SQLite tidak lagi digunakan. Seluruh query diarahkan murni ke PostgreSQL ed_dashboard.');
}

export function getMigrationStatus() {
  return {
    applied: 7,
    pending: 0,
    currentVersion: 7,
    engine: 'postgres',
  };
}

export async function saveDbConfig(cfg: Partial<DatabaseConfig>, updatedBy?: string): Promise<DatabaseConfig> {
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
    engine: 'postgres',
    sqlite_path: safePath,
    pg_password: resolvedPgPassword,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || 'Administrator',
  };

  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  const filePayload = {
    ...updated,
    pg_password: updated.pg_password ? encryptSecret(updated.pg_password) : '',
  };
  fs.writeFileSync(configPath, JSON.stringify(filePayload, null, 2), 'utf8');

  try {
    await query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_database', 'database_config', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(filePayload), updated.updated_at!]
    );
  } catch (e) {
    console.warn('[DB] Gagal menyimpan konfigurasi database ke PostgreSQL:', e);
  }

  if (pgPoolInstance) {
    try {
      await pgPoolInstance.end();
    } catch {}
    pgPoolInstance = null;
  }

  return updated;
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const res = await query<{ count: number }>('SELECT COUNT(*)::int as count FROM branches');
  return Number(res.rows[0]?.count ?? 0) === 0;
}
