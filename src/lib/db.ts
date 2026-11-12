import { Pool, types, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';
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
import { hashPassword, verifyPassword, isPasswordHashed } from './auth';

// Normalize PostgreSQL driver type parsing so behavior aligns cleanly with JS types:
// - OID 20 (INT8 / BIGINT, e.g. COUNT(*)) -> JS number
// - OID 1700 (NUMERIC / DECIMAL) -> JS number
// - OID 1184 / 1114 (TIMESTAMPTZ / TIMESTAMP) -> ISO-8601 UTC string
types.setTypeParser(20, (val: string) => parseInt(val, 10));
types.setTypeParser(1700, (val: string) => parseFloat(val));
types.setTypeParser(1184, (val: string) => (val ? new Date(val).toISOString() : val));
types.setTypeParser(1114, (val: string) => (val ? new Date(val + 'Z').toISOString() : val));

export const SECRET_MASK = '••••••••';

// Ensure data folder exists (for spreadsheets / safe local uploads & config metadata)
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function parseJsonValue<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const s = String(val);
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? s : new Date(parsed).toISOString();
}

function toIsoStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  return toIsoString(val);
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
export function toSafeUser(raw: any): User {
  if (!raw) return raw;
  const { password: _removedPassword, password_hash: _removedPasswordHash, ...rest } = raw;
  return {
    ...rest,
    nipp: raw.nipp || raw.username,
    username: raw.username || raw.nipp,
    active: Boolean(raw.active),
    created_at: raw.created_at ? toIsoString(raw.created_at) : undefined,
  };
}

/**
 * Mask sensitive database credentials before returning in API responses.
 */
export function toSafeDbConfig(cfg?: DatabaseConfig): DatabaseConfig {
  const source = cfg || getDbConfig();
  const hasEnvPassword = Boolean(getEnvDatabaseUrl() || process.env.PGPASSWORD);
  return {
    ...source,
    pg_password: source.pg_password || hasEnvPassword ? SECRET_MASK : '',
  };
}

/**
 * Mask sensitive external API keys and tokens before returning in API responses.
 */
export function toSafeIntegrationCredentials(creds: IntegrationCredentials): IntegrationCredentials {
  return {
    ...creds,
    google_api_key: creds.google_api_key ? SECRET_MASK : '',
    api_gateway_token: creds.api_gateway_token ? SECRET_MASK : '',
  };
}

function getEnvDatabaseUrl(): string | null {
  const raw = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (!raw || raw.startsWith('file:')) return null;
  if (raw.startsWith('postgresql://') || raw.startsWith('postgres://')) {
    return raw;
  }
  return null;
}

// Database location & configuration management
export function getDbConfig(): DatabaseConfig {
  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  const envUrl = getEnvDatabaseUrl();

  let parsedFromFile: Partial<DatabaseConfig> = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      parsedFromFile = JSON.parse(content);
    } catch (e) {
      console.error('Error reading db_config.json:', e);
    }
  }

  let envHost: string | undefined;
  let envPort: number | undefined;
  let envDb: string | undefined;
  let envUser: string | undefined;
  let envSsl: boolean | undefined;

  if (envUrl) {
    try {
      const u = new URL(envUrl);
      envHost = u.hostname || undefined;
      envPort = u.port ? Number(u.port) : undefined;
      envDb = u.pathname ? u.pathname.replace(/^\//, '') : undefined;
      envUser = u.username ? decodeURIComponent(u.username) : undefined;
      envSsl = u.searchParams.get('sslmode') === 'require' || undefined;
    } catch {
      // ignore invalid URL parse for display fields
    }
  }

  const { safeRelativePath } = sanitizeSafeDataFilePath(parsedFromFile.sqlite_path, 'ed_dashboard.db');

  return {
    engine: envUrl ? 'postgres' : (parsedFromFile.engine === 'sqlite' ? 'sqlite' : 'postgres'),
    sqlite_path: safeRelativePath,
    pg_host: envHost || process.env.PGHOST || parsedFromFile.pg_host || 'localhost',
    pg_port: envPort || (process.env.PGPORT ? Number(process.env.PGPORT) : undefined) || parsedFromFile.pg_port || 5432,
    pg_database: envDb || process.env.PGDATABASE || parsedFromFile.pg_database || 'ed_dashboard',
    pg_user: envUser || process.env.PGUSER || parsedFromFile.pg_user || 'postgres',
    pg_password: parsedFromFile.pg_password || '',
    pg_ssl: envSsl ?? parsedFromFile.pg_ssl ?? false,
    max_connections: parsedFromFile.max_connections || 10,
    updated_at: parsedFromFile.updated_at,
    updated_by: parsedFromFile.updated_by,
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

function buildPgPoolConfig(cfg?: DatabaseConfig): PoolConfig {
  const effectiveCfg = cfg || getDbConfig();
  const envUrl = getEnvDatabaseUrl();

  if (envUrl) {
    return {
      connectionString: envUrl,
      max: Number(effectiveCfg.max_connections) || 10,
      ssl: effectiveCfg.pg_ssl ? { rejectUnauthorized: false } : undefined,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    host: effectiveCfg.pg_host || process.env.PGHOST || 'localhost',
    port: Number(effectiveCfg.pg_port) || Number(process.env.PGPORT) || 5432,
    database: effectiveCfg.pg_database || process.env.PGDATABASE || 'ed_dashboard',
    user: effectiveCfg.pg_user || process.env.PGUSER || 'postgres',
    password: effectiveCfg.pg_password || process.env.PGPASSWORD || '',
    max: Number(effectiveCfg.max_connections) || 10,
    ssl: effectiveCfg.pg_ssl ? { rejectUnauthorized: false } : undefined,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const globalForPg = globalThis as unknown as {
  __edDashboardPgPool?: Pool;
  __edDashboardPgInitPromise?: Promise<void>;
};

export function getPool(): Pool {
  if (!globalForPg.__edDashboardPgPool) {
    globalForPg.__edDashboardPgPool = new Pool(buildPgPoolConfig());
  }
  return globalForPg.__edDashboardPgPool;
}

async function initPgSchema(pool: Pool): Promise<void> {
  // Fast check: if schema tables already exist (e.g., migrated database), verify normalized module_finansial & module_peralatan columns too
  const tblCheck = await pool.query(
    `SELECT
       to_regclass('public.branches') AS branches_tbl,
       to_regclass('public.users') AS users_tbl,
       to_regclass('public.module_finansial') AS mod_fin_tbl,
       to_regclass('public.module_peralatan') AS mod_alat_tbl,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'module_finansial' AND column_name = 'entitas'
       ) AS has_fin_entitas,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'module_peralatan' AND column_name = 'grup_entitas'
       ) AS has_alat_entitas`
  );
  const row = tblCheck.rows[0];
  const needsFinRecreation = Boolean(row?.mod_fin_tbl) && !row?.has_fin_entitas;
  const needsAlatRecreation = Boolean(row?.mod_alat_tbl) && !row?.has_alat_entitas;
  const needsSchema =
    !row?.branches_tbl ||
    !row?.users_tbl ||
    !row?.mod_fin_tbl ||
    !row?.mod_alat_tbl ||
    needsFinRecreation ||
    needsAlatRecreation;

  if (needsFinRecreation) {
    await pool.query('DROP TABLE IF EXISTS module_finansial');
  }
  if (needsAlatRecreation) {
    await pool.query('DROP TABLE IF EXISTS module_peralatan');
  }

  if (needsSchema) {
    const schemaPath = path.join(process.cwd(), 'data', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
    }
  }

  // Ensure users exist if running against an empty database
  try {
    const existing = await pool.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE nipp IS NOT NULL AND nipp != ''"
    );
    const count = Number(existing.rows[0]?.count ?? 0);

    if (count === 0) {
      const { INITIAL_OFFICIAL_PICS, exportUsersToSpreadsheet } = await import('./userPicSync');
      for (let i = 0; i < INITIAL_OFFICIAL_PICS.length; i++) {
        const u = INITIAL_OFFICIAL_PICS[i];
        await pool.query(
          `INSERT INTO users (id, username, nipp, name, email, divisi, departemen, password_hash, role, branch_id, department_id, active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)
           ON CONFLICT (id) DO UPDATE SET
             username = EXCLUDED.username,
             nipp = EXCLUDED.nipp,
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             divisi = EXCLUDED.divisi,
             departemen = EXCLUDED.departemen,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             branch_id = EXCLUDED.branch_id,
             department_id = EXCLUDED.department_id,
             active = EXCLUDED.active`,
          [
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
            Boolean(u.active),
            u.created_at || new Date().toISOString(),
          ]
        );
      }
      const allUsersRes = await pool.query('SELECT * FROM users ORDER BY nipp ASC');
      exportUsersToSpreadsheet(allUsersRes.rows.map(toSafeUser));
    } else {
      const userRowsRes = await pool.query('SELECT id, password_hash FROM users');
      for (const userRow of userRowsRes.rows) {
        const rawPass = userRow.password_hash || 'password123';
        if (!isPasswordHashed(rawPass)) {
          await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
            hashPassword(rawPass),
            userRow.id,
          ]);
        }
      }
    }
  } catch (e) {
    console.error('[PG] Auto-seed users check warning:', e);
  }
}

export async function ensureInitialized(): Promise<void> {
  if (!globalForPg.__edDashboardPgInitPromise) {
    const pool = getPool();
    globalForPg.__edDashboardPgInitPromise = initPgSchema(pool).catch((err) => {
      globalForPg.__edDashboardPgInitPromise = undefined;
      throw err;
    });
  }
  await globalForPg.__edDashboardPgInitPromise;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  await ensureInitialized();
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureInitialized();
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
      console.error('[PG] Gagal melakukan rollback transaksi:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
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
    sqlite_path: safePath,
    pg_password: resolvedPgPassword,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || 'Administrator',
  };

  // Persist non-secret metadata to db_config.json (never persist plaintext pg_password to json file)
  const fileSnapshot: DatabaseConfig = {
    ...updated,
    pg_password: '',
  };
  const configPath = path.join(process.cwd(), 'data', 'db_config.json');
  fs.writeFileSync(configPath, JSON.stringify(fileSnapshot, null, 2), 'utf8');

  try {
    await query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_database', 'database_config', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(fileSnapshot), updated.updated_at!]
    );
  } catch (e) {
    console.warn('[PG] Gagal menyimpan konfigurasi database ke integration_settings:', e);
  }

  return updated;
}

// Helper to check if database is empty
export async function isDatabaseEmpty(): Promise<boolean> {
  const res = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM branches');
  return Number(res.rows[0]?.count ?? 0) === 0;
}

// Database query helpers
export const dbQueries = {
  // Branches
  getBranches: async (): Promise<Branch[]> => {
    const res = await query('SELECT * FROM branches ORDER BY order_seq ASC, code ASC');
    return res.rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
      order_seq: r.order_seq !== undefined && r.order_seq !== null ? Number(r.order_seq) : 99,
      facilities: parseJsonValue(r.facilities, {}),
    }));
  },
  getBranchById: async (id: string): Promise<Branch | null> => {
    const res = await query('SELECT * FROM branches WHERE id = $1', [id]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      ...r,
      active: Boolean(r.active),
      order_seq: r.order_seq !== undefined && r.order_seq !== null ? Number(r.order_seq) : 99,
      facilities: parseJsonValue(r.facilities, {}),
    };
  },

  // Departments
  getDepartments: async (): Promise<Department[]> => {
    const res = await query('SELECT * FROM departments ORDER BY code ASC');
    return res.rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
    }));
  },

  // Equipment Catalog
  getEquipmentCatalog: async (): Promise<EquipmentItem[]> => {
    const res = await query('SELECT * FROM equipment_catalog ORDER BY code ASC');
    return res.rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
    }));
  },

  // Users / PIC (Always sanitized via toSafeUser so password hash is never exposed)
  getUsers: async (): Promise<User[]> => {
    const res = await query('SELECT * FROM users ORDER BY nipp ASC, name ASC');
    return res.rows.map(toSafeUser);
  },
  getUserByNipp: async (nipp: string): Promise<User | null> => {
    const res = await query('SELECT * FROM users WHERE nipp = $1 OR username = $1', [nipp]);
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },
  getUserByUsername: async (username: string): Promise<User | null> => {
    const res = await query('SELECT * FROM users WHERE username = $1 OR nipp = $1', [username]);
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },
  getUserById: async (id: string): Promise<User | null> => {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },
  createUser: async (data: {
    nipp: string;
    name: string;
    divisi: string;
    departemen: string;
    password?: string;
    role?: UserRole;
    email?: string;
    branch_id?: string | null;
    department_id?: string | null;
  }): Promise<User> => {
    const cleanNipp = String(data.nipp).trim();
    const id = `usr_${cleanNipp}_${Date.now()}`;
    const role: UserRole = data.role || 'pic_cabang';
    const email = data.email || `${cleanNipp}@pelindo.co.id`;
    const hashedPassword = hashPassword(data.password || 'password123');
    const createdAt = new Date().toISOString();

    await query(
      `INSERT INTO users (id, username, nipp, name, email, divisi, departemen, password_hash, role, branch_id, department_id, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12::timestamptz)`,
      [
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
        createdAt,
      ]
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

    try {
      const { exportUsersToSpreadsheet } = await import('./userPicSync');
      exportUsersToSpreadsheet(await dbQueries.getUsers());
    } catch (e) {
      console.error('Failed to sync to spreadsheet on createUser:', e);
    }

    return newUser;
  },
  updateUser: async (id: string, data: Partial<User>): Promise<User | null> => {
    const existingRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    const existing = existingRes.rows[0];
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : existing.name;
    const cleanNipp = data.nipp !== undefined ? String(data.nipp).trim() : (existing.nipp || existing.username);
    const divisi = data.divisi !== undefined ? data.divisi : existing.divisi;
    const departemen = data.departemen !== undefined ? data.departemen : existing.departemen;
    const role = data.role !== undefined ? data.role : existing.role;
    const branch_id = data.branch_id !== undefined ? data.branch_id : existing.branch_id;
    const department_id = data.department_id !== undefined ? data.department_id : existing.department_id;
    const email = data.email !== undefined ? data.email : (existing.email || `${cleanNipp}@pelindo.co.id`);
    const active = data.active !== undefined ? Boolean(data.active) : Boolean(existing.active);
    const currentHash = existing.password_hash || existing.password || '';
    const passwordHash =
      data.password && data.password.trim().length > 0
        ? hashPassword(data.password.trim())
        : isPasswordHashed(currentHash)
          ? currentHash
          : hashPassword(currentHash || 'password123');

    await query(
      `UPDATE users
       SET name = $1, username = $2, nipp = $3, divisi = $4, departemen = $5,
           role = $6, branch_id = $7, department_id = $8, email = $9, active = $10, password_hash = $11
       WHERE id = $12`,
      [name, cleanNipp, cleanNipp, divisi, departemen, role, branch_id, department_id, email, active, passwordHash, id]
    );

    try {
      const { exportUsersToSpreadsheet } = await import('./userPicSync');
      exportUsersToSpreadsheet(await dbQueries.getUsers());
    } catch (e) {
      console.warn('[PG] Gagal mengekspor daftar pengguna ke spreadsheet pada updateUser:', e);
    }

    return dbQueries.getUserById(id);
  },
  deleteUser: async (id: string): Promise<boolean> => {
    await query('DELETE FROM users WHERE id = $1', [id]);
    try {
      const { exportUsersToSpreadsheet } = await import('./userPicSync');
      exportUsersToSpreadsheet(await dbQueries.getUsers());
    } catch (e) {
      console.warn('[PG] Gagal mengekspor daftar pengguna ke spreadsheet pada deleteUser:', e);
    }
    return true;
  },
  authenticateUser: async (nipp: string, password: string): Promise<User | null> => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp || !password) return null;

    const res = await query('SELECT * FROM users WHERE nipp = $1 OR username = $1', [cleanNipp]);
    const rawRow = res.rows[0];
    if (!rawRow) return null;

    const storedPassword = rawRow.password_hash || rawRow.password || '';
    if (!verifyPassword(password, storedPassword)) {
      return null;
    }

    if (!isPasswordHashed(storedPassword)) {
      try {
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), rawRow.id]);
      } catch (e) {
        console.warn('[PG] Gagal memutakhirkan hash kata sandi:', e);
      }
    }

    return toSafeUser(rawRow);
  },

  // Indicators
  getIndicators: async (departmentId?: string): Promise<KPIIndicator[]> => {
    const res = departmentId
      ? await query('SELECT * FROM kpi_indicators WHERE department_id = $1 ORDER BY code ASC', [departmentId])
      : await query('SELECT * FROM kpi_indicators ORDER BY department_id ASC, code ASC');
    return res.rows.map((r) => ({
      ...r,
      default_target: Number(r.default_target ?? 0),
      is_core_kpi: Boolean(r.is_core_kpi),
      active: Boolean(r.active),
    }));
  },

  // Templates
  getTemplates: async (): Promise<TemplateConfig[]> => {
    const res = await query('SELECT * FROM templates ORDER BY department_id ASC');
    return res.rows.map((r) => ({
      ...r,
      columns: parseJsonValue(r.columns, []),
      updated_at: toIsoString(r.updated_at),
    }));
  },
  getTemplateByDept: async (deptId: string): Promise<TemplateConfig | null> => {
    const res = await query('SELECT * FROM templates WHERE department_id = $1', [deptId]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      ...r,
      columns: parseJsonValue(r.columns, []),
      updated_at: toIsoString(r.updated_at),
    };
  },
  saveTemplate: async (template: TemplateConfig): Promise<void> => {
    await query(
      `INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         department_id = EXCLUDED.department_id,
         version = EXCLUDED.version,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         columns = EXCLUDED.columns,
         updated_at = EXCLUDED.updated_at`,
      [
        template.id,
        template.department_id,
        template.version,
        template.name,
        template.description,
        JSON.stringify(template.columns),
        new Date().toISOString(),
      ]
    );
  },

  // Monthly Records
  getMonthlyRecords: async (filter: {
    branch_id?: string;
    department_id?: string;
    month?: number;
    year?: number;
    verified_only?: boolean;
    verification_status?: string;
  }): Promise<MonthlyRecord[]> => {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.branch_id && filter.branch_id !== 'ALL') {
      if (filter.branch_id === 'NONE') {
        conditions.push('1 = 0');
      } else {
        const tokens = filter.branch_id
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.length === 1) {
          const p = `$${paramIndex++}`;
          conditions.push(`(r.branch_id = ${p} OR UPPER(b.code) = UPPER(${p}))`);
          params.push(tokens[0]);
        } else if (tokens.length > 1) {
          const orParts = tokens.map((tok) => {
            const p = `$${paramIndex++}`;
            params.push(tok);
            return `(r.branch_id = ${p} OR UPPER(b.code) = UPPER(${p}))`;
          });
          conditions.push(`(${orParts.join(' OR ')})`);
        }
      }
    }
    if (filter.department_id && filter.department_id !== 'ALL') {
      conditions.push(`r.department_id = $${paramIndex++}`);
      params.push(filter.department_id);
    }
    if (filter.month) {
      conditions.push(`r.month = $${paramIndex++}`);
      params.push(filter.month);
    }
    if (filter.year) {
      conditions.push(`r.year = $${paramIndex++}`);
      params.push(filter.year);
    }
    if (filter.verified_only) {
      conditions.push("r.verification_status = 'verified'");
    } else if (filter.verification_status && filter.verification_status !== 'ALL') {
      conditions.push(`r.verification_status = $${paramIndex++}`);
      params.push(filter.verification_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT r.*,
             b.name AS branch_name, b.code AS branch_code,
             d.name AS department_name,
             k.name AS indicator_name, k.code AS indicator_code, k.direction
      FROM monthly_records r
      JOIN branches b ON r.branch_id = b.id
      JOIN departments d ON r.department_id = d.id
      JOIN kpi_indicators k ON r.indicator_id = k.id
      ${whereClause}
      ORDER BY r.year DESC, r.month DESC, b.code ASC, k.code ASC
    `;

    const res = await query(sql, params);
    return res.rows.map((r) => ({
      ...r,
      month: Number(r.month),
      year: Number(r.year),
      target: Number(r.target),
      realization: Number(r.realization),
      achievement_pct: Number(r.achievement_pct),
      uploaded_at: toIsoString(r.uploaded_at),
      verified_at: toIsoStringOrNull(r.verified_at),
      is_simulated: Boolean(r.is_simulated),
    }));
  },

  getMonthlyRecordsByIds: async (recordIds: string[]): Promise<MonthlyRecord[]> => {
    if (!recordIds || recordIds.length === 0) return [];
    const res = await query('SELECT * FROM monthly_records WHERE id = ANY($1::varchar[])', [recordIds]);
    return res.rows.map((r) => ({
      ...r,
      month: Number(r.month),
      year: Number(r.year),
      target: Number(r.target),
      realization: Number(r.realization),
      achievement_pct: Number(r.achievement_pct),
      uploaded_at: toIsoString(r.uploaded_at),
      verified_at: toIsoStringOrNull(r.verified_at),
      is_simulated: Boolean(r.is_simulated),
    }));
  },

  // Update record verification across monthly_records and all module_* tables
  updateRecordVerification: async (
    recordIds: string[],
    status: 'verified' | 'revision_needed',
    verifiedBy: string,
    revisionNotes?: string
  ): Promise<void> => {
    if (!recordIds || recordIds.length === 0) return;
    const now = new Date().toISOString();

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE monthly_records
         SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4
         WHERE id = ANY($5::varchar[])`,
        [status, verifiedBy, now, revisionNotes || null, recordIds]
      );

      const moduleTables = [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ];

      for (const table of moduleTables) {
        const sql =
          status === 'verified'
            ? `UPDATE ${table}
               SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4, verified_snapshot_json = NULL
               WHERE id = ANY($5::varchar[]) OR monthly_record_id = ANY($5::varchar[])`
            : `UPDATE ${table}
               SET verification_status = $1, verified_by = $2, verified_at = $3::timestamptz, revision_notes = $4
               WHERE id = ANY($5::varchar[]) OR monthly_record_id = ANY($5::varchar[])`;
        await client.query(sql, [status, verifiedBy, now, revisionNotes || null, recordIds]);
      }
    });
  },

  // Save imported records
  insertMonthlyRecords: async (
    records: Omit<
      MonthlyRecord,
      'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'
    >[]
  ): Promise<void> => {
    if (!records || records.length === 0) return;

    await withTransaction(async (client) => {
      const upsertSql = `
        INSERT INTO monthly_records (
          id, branch_id, department_id, indicator_id, month, year,
          target, realization, unit, achievement_pct, status_color, notes,
          source_type, batch_id, verification_status, revision_notes,
          uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18::timestamptz, $19, $20::timestamptz, $21
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
          is_simulated = EXCLUDED.is_simulated
      `;

      for (const r of records) {
        await client.query(upsertSql, [
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
          r.uploaded_at || new Date().toISOString(),
          r.verified_by || null,
          r.verified_at || null,
          Boolean(r.is_simulated),
        ]);
      }
    });
  },

  // Import Batches
  createImportBatch: async (batch: ImportBatch): Promise<void> => {
    await query(
      `INSERT INTO import_batches (
        id, filename_or_url, source_type, department_id, branch_id,
        period_month, period_year, total_rows, valid_rows, error_rows,
        status, uploaded_by, uploaded_at, error_log
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::jsonb)
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
        batch.uploaded_at || new Date().toISOString(),
        batch.error_log ? JSON.stringify(batch.error_log) : null,
      ]
    );
  },
  getImportBatches: async (): Promise<ImportBatch[]> => {
    const res = await query('SELECT * FROM import_batches ORDER BY uploaded_at DESC LIMIT 50');
    return res.rows.map((r) => ({
      ...r,
      uploaded_at: toIsoString(r.uploaded_at),
      error_log: parseJsonValue(r.error_log, null),
    }));
  },

  // Audit Log
  createAuditLog: async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    const id = 'aud_' + Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();
    await query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10)`,
      [
        id,
        log.user_id,
        log.user_name,
        log.user_role,
        log.action,
        log.entity,
        log.entity_id || null,
        log.details,
        timestamp,
        log.ip_address || '127.0.0.1',
      ]
    );
  },
  getAuditLogs: async (limit = 100): Promise<AuditLog[]> => {
    const res = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    return res.rows.map((r) => ({
      ...r,
      timestamp: toIsoString(r.timestamp),
    })) as AuditLog[];
  },

  // Google Sheets Config
  getGoogleSheetsConfig: async (): Promise<GoogleSheetsConfig> => {
    const res = await query(
      "SELECT config_json FROM integration_settings WHERE service_name = 'google_sheets'"
    );
    const row = res.rows[0];
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
        auto_sync_enabled: false,
      };
    }
    return parseJsonValue<GoogleSheetsConfig>(row.config_json, {
      id: 'cfg_gsheet',
      spreadsheet_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
      sheet_name: 'Input_Kinerja_Bulanan',
      range: 'A2:L200',
      service_account_email: 'regdashr@gmail.com',
      api_key_configured: false,
      status: 'ready_for_credentials',
      last_sync_at: null,
      auto_sync_enabled: false,
    });
  },
  saveGoogleSheetsConfig: async (cfg: GoogleSheetsConfig): Promise<void> => {
    const now = new Date().toISOString();
    await query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ($1, 'google_sheets', $2::jsonb, $3::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      ['cfg_gsheet', JSON.stringify(cfg), now]
    );
  },

  // System & Session Parameters
  getSystemParameters: async (): Promise<SystemParameters> => {
    const defaults: SystemParameters = {
      session_timeout_minutes: 30,
      auto_logout_idle: true,
      warning_before_minutes: 2,
      default_theme: 'light',
    };
    const res = await query(
      "SELECT config_json FROM integration_settings WHERE service_name = 'system_parameters'"
    );
    const row = res.rows[0];
    if (!row) return defaults;
    return {
      ...defaults,
      ...parseJsonValue<Partial<SystemParameters>>(row.config_json, {}),
    };
  },
  saveSystemParameters: async (params: Partial<SystemParameters>): Promise<SystemParameters> => {
    const current = await dbQueries.getSystemParameters();
    const updated: SystemParameters = {
      ...current,
      ...params,
      updated_at: new Date().toISOString(),
    };
    await query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_system_params', 'system_parameters', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(updated), updated.updated_at!]
    );
    return updated;
  },

  // Database Location & Connection Configuration
  getDbConfig: (): DatabaseConfig => {
    return getDbConfig();
  },
  saveDbConfig: async (cfg: Partial<DatabaseConfig>, updatedBy?: string): Promise<DatabaseConfig> => {
    return saveDbConfig(cfg, updatedBy);
  },

  // External Integration Credentials (Google Drive, Sheets, Gateway)
  getIntegrationCredentials: async (): Promise<IntegrationCredentials> => {
    const defaults: IntegrationCredentials = {
      google_drive_email: 'regdashr@gmail.com',
      google_drive_file_path: 'data/input_data.xlsx',
      google_sheets_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
      google_sheets_name: 'Input_Kinerja_Bulanan',
      google_api_key: '',
      api_gateway_url: 'https://api.pelindo.co.id/v1/r4',
      api_gateway_token: '',
    };
    const res = await query(
      "SELECT config_json FROM integration_settings WHERE service_name = 'integration_credentials'"
    );
    const row = res.rows[0];
    if (!row) return defaults;
    return {
      ...defaults,
      ...parseJsonValue<Partial<IntegrationCredentials>>(row.config_json, {}),
    };
  },
  saveIntegrationCredentials: async (
    creds: Partial<IntegrationCredentials>,
    updatedBy?: string
  ): Promise<IntegrationCredentials> => {
    const current = await dbQueries.getIntegrationCredentials();
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

    await query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_credentials', 'integration_credentials', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(updated), updated.updated_at!]
    );

    try {
      const currentGSheet = await dbQueries.getGoogleSheetsConfig();
      await dbQueries.saveGoogleSheetsConfig({
        ...currentGSheet,
        spreadsheet_id: updated.google_sheets_id || currentGSheet.spreadsheet_id,
        sheet_name: updated.google_sheets_name || currentGSheet.sheet_name,
        service_account_email: updated.google_drive_email || currentGSheet.service_account_email,
      });
    } catch (e) {
      console.warn('[PG] Gagal menyinkronkan konfigurasi Google Sheets:', e);
    }

    return updated;
  },
};
