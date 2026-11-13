import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  dbQueries,
  getDbPath,
  sanitizeSafeDataFilePath,
  toSafeDbConfig,
  toSafeIntegrationCredentials,
  query,
} from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { authorize } from '@/lib/policy';
import { requireAuth } from '@/lib/rbac';
import { systemParamsPayloadSchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'system_params:read' });
  if (!auth.authorized) return auth.response;

  try {
    const params = await dbQueries.getSystemParameters();
    const dbConfig = toSafeDbConfig(dbQueries.getDbConfig());
    const credentials = await toSafeIntegrationCredentials(await dbQueries.getIntegrationCredentials());

    const activeDbPath = getDbPath();
    const relativeDbPath = path.relative(process.cwd(), activeDbPath);
    let dbStats: Record<string, unknown> | null = null;
    try {
      const pgStats = await query('SELECT current_database(), current_user, version()');
      dbStats = {
        engine: 'postgres',
        connected: true,
        database: pgStats.rows[0]?.current_database || 'ed_dashboard',
        user: pgStats.rows[0]?.current_user || 'postgres',
      };
    } catch (err: unknown) {
      dbStats = {
        engine: 'postgres',
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return NextResponse.json({
      success: true,
      params,
      dbConfig,
      credentials,
      activeDbPath: relativeDbPath,
      dbStats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat parameter sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function validateDatabaseTarget(targetPath: string): string | null {
  if (!targetPath) return 'Jalur database tidak valid.';
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'system_params:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const rawBody = await req.json();
    const parsed = parseWithSchema(systemParamsPayloadSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Database path changes are a system-level operation: Super Admin only.
    // `system_params:manage` is also held by admin_regional, so it is not sufficient here.
    const touchesDatabasePath = body.action === 'validate_db_path' || Boolean(body.dbConfig);
    if (touchesDatabasePath) {
      // `system_params:manage` is also held by admin_regional, so the policy adds
      // the Super Admin requirement for this specific action.
      const decision = authorize(
        {
          sub: auth.session.sub,
          role: auth.session.role,
          branch_id: auth.session.branch_id,
          department_id: auth.session.department_id,
          nipp: auth.session.nipp,
        },
        'config:update_database'
      );
      if (!decision.allowed) {
        return NextResponse.json(
          { success: false, error: decision.reason, message: decision.reason, code: decision.code },
          { status: 403 }
        );
      }
    }

    // 1. Action: Validasi Path Database (Strictly confined to ./data directory)
    if (body.action === 'validate_db_path') {
      const targetPath = body.sqlite_path?.trim();
      if (!targetPath) {
        return NextResponse.json(
          {
            success: false,
            error: 'Lokasi path database tidak boleh kosong.',
          },
          { status: 400 }
        );
      }

      const { safeRelativePath, resolvedAbsolutePath } = sanitizeSafeDataFilePath(
        targetPath,
        'ed_dashboard.db',
        ['.db', '.sqlite', '.sqlite3']
      );

      const exists = fs.existsSync(resolvedAbsolutePath);
      const parentDir = path.dirname(resolvedAbsolutePath);

      let isWritable = false;
      try {
        fs.accessSync(parentDir, fs.constants.W_OK);
        isWritable = true;
      } catch {
        isWritable = false;
      }

      let sizeBytes = 0;
      if (exists) {
        try {
          sizeBytes = fs.statSync(resolvedAbsolutePath).size;
        } catch {
          sizeBytes = 0;
        }
      }

      return NextResponse.json({
        success: true,
        resolvedPath: safeRelativePath,
        exists,
        isWritable,
        sizeKb: Math.round(sizeBytes / 1024),
        message: exists
          ? `File database ditemukan di ${safeRelativePath} (${Math.round(sizeBytes / 1024)} KB) dan memiliki akses tulis.`
          : `Lokasi ${safeRelativePath} di direktori data tervalidasi dan siap digunakan.`,
      });
    }

    const session = auth.session;
    const userName = session.name;
    const userId = session.sub;
    const userRole = session.role;
    const clientIp = getClientIp(req);

    let updatedParams = null;
    let updatedDbConfig = null;
    let updatedCredentials = null;

    // 2. Simpan Database Configuration (Lokasi & Engine)
    if (body.dbConfig) {
      const dbCfg = body.dbConfig;
      const { safeRelativePath, resolvedAbsolutePath } = sanitizeSafeDataFilePath(
        typeof dbCfg.sqlite_path === 'string' ? dbCfg.sqlite_path : undefined,
        'ed_dashboard.db',
        ['.db', '.sqlite', '.sqlite3']
      );

      if (resolvedAbsolutePath !== getDbPath()) {
        const targetError = validateDatabaseTarget(resolvedAbsolutePath);
        if (targetError) {
          return NextResponse.json(
            { success: false, error: targetError, message: targetError },
            { status: 400 }
          );
        }
      }

      updatedDbConfig = await dbQueries.saveDbConfig(
        {
          engine: dbCfg.engine === 'postgres' ? 'postgres' : 'sqlite',
          sqlite_path: safeRelativePath,
          pg_host: typeof dbCfg.pg_host === 'string' && dbCfg.pg_host ? dbCfg.pg_host : 'localhost',
          pg_port: Number(dbCfg.pg_port) || 5432,
          pg_database: typeof dbCfg.pg_database === 'string' && dbCfg.pg_database ? dbCfg.pg_database : 'ed_dashboard',
          pg_user: typeof dbCfg.pg_user === 'string' && dbCfg.pg_user ? dbCfg.pg_user : 'postgres',
          pg_password: typeof dbCfg.pg_password === 'string' ? dbCfg.pg_password : undefined,
          pg_ssl: Boolean(dbCfg.pg_ssl),
          max_connections: Number(dbCfg.max_connections) || 10,
        },
        userName
      );

      try {
        dbQueries.createAuditLog({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          action: 'CONFIG_UPDATE',
          entity: 'DatabaseConfig',
          entity_id: 'cfg_database',
          details: `Pembaruan Konfigurasi Database: Engine: ${updatedDbConfig.engine}, Path SQLite: ${updatedDbConfig.sqlite_path}, Host PG: ${updatedDbConfig.pg_host}:${updatedDbConfig.pg_port}/${updatedDbConfig.pg_database}`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }
    }

    // 3. Simpan Kredensial & Integrasi (Google Drive, Sheets, API Gateway)
    if (body.credentials) {
      const creds = body.credentials;
      const { safeRelativePath: safeExcelPath } = sanitizeSafeDataFilePath(
        typeof creds.google_drive_file_path === 'string' ? creds.google_drive_file_path : undefined,
        'input_data.xlsx',
        ['.xlsx', '.xls', '.csv']
      );
      updatedCredentials = await dbQueries.saveIntegrationCredentials(
        {
          google_drive_email:
            typeof creds.google_drive_email === 'string' && creds.google_drive_email.trim()
              ? creds.google_drive_email.trim()
              : 'regdashr@gmail.com',
          google_drive_file_path: safeExcelPath,
          google_sheets_id:
            typeof creds.google_sheets_id === 'string' ? creds.google_sheets_id.trim() : '',
          google_sheets_name:
            typeof creds.google_sheets_name === 'string' && creds.google_sheets_name.trim()
              ? creds.google_sheets_name.trim()
              : 'Input_Kinerja_Bulanan',
          google_api_key: typeof creds.google_api_key === 'string' ? creds.google_api_key : undefined,
          api_gateway_url:
            typeof creds.api_gateway_url === 'string' && creds.api_gateway_url
              ? creds.api_gateway_url
              : 'https://api.pelindo.co.id/v1/r4',
          api_gateway_token:
            typeof creds.api_gateway_token === 'string' ? creds.api_gateway_token : undefined,
        },
        userName
      );

      try {
        await dbQueries.createAuditLog({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          action: 'CONFIG_UPDATE',
          entity: 'IntegrationCredentials',
          entity_id: 'cfg_credentials',
          details: `Pembaruan Kredensial Integrasi: Google Drive Email: ${updatedCredentials.google_drive_email}, Path Excel: ${updatedCredentials.google_drive_file_path}, Sheet ID: ${updatedCredentials.google_sheets_id}`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }
    }

    // 4. Simpan System & Session Parameters
    if (body.session_timeout_minutes !== undefined || body.params) {
      const p = body.params || body;
      let timeout = Number(p.session_timeout_minutes);
      if (isNaN(timeout) || timeout < 1) timeout = 30;
      if (timeout > 480) timeout = 480;

      let warning = Number(p.warning_before_minutes);
      if (isNaN(warning) || warning < 0) warning = 2;

      const autoLogout = p.auto_logout_idle !== false;
      const defaultTheme = p.default_theme === 'dark' ? 'dark' : 'light';

      updatedParams = await dbQueries.saveSystemParameters({
        session_timeout_minutes: timeout,
        auto_logout_idle: autoLogout,
        warning_before_minutes: warning,
        default_theme: defaultTheme,
        updated_by: userName,
      });

      try {
        await dbQueries.createAuditLog({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          action: 'CONFIG_UPDATE',
          entity: 'SystemParameters',
          entity_id: 'cfg_system_params',
          details: `Pembaruan Parameter Sistem: Timeout Sesi ${timeout} menit, Auto-logout idle: ${autoLogout ? 'Aktif' : 'Non-aktif'}, Peringatan: ${warning} menit, Tema Default: ${defaultTheme}`,
          ip_address: clientIp,
        });
      } catch {
        // ignore non-fatal audit error
      }
    }

    const currentParams = updatedParams || (await dbQueries.getSystemParameters());
    const currentCredentials = updatedCredentials || (await dbQueries.getIntegrationCredentials());

    return NextResponse.json({
      success: true,
      params: currentParams,
      dbConfig: toSafeDbConfig(updatedDbConfig || dbQueries.getDbConfig()),
      credentials: toSafeIntegrationCredentials(currentCredentials),
      message: 'Konfigurasi parameter sistem, kredensial, dan database telah disimpan.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan parameter sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
