import { NextRequest, NextResponse } from 'next/server';
import {
  dbQueries,
  getDbPath,
  query,
  sanitizeSafeDataFilePath,
  toSafeDbConfig,
  toSafeIntegrationCredentials,
} from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
  if (!auth.authorized) return auth.response;

  try {
    const params = await dbQueries.getSystemParameters();
    const dbConfig = toSafeDbConfig(dbQueries.getDbConfig());
    const credentials = toSafeIntegrationCredentials(await dbQueries.getIntegrationCredentials());

    const activeDbPath = getDbPath();
    const relativeDbPath = path.relative(process.cwd(), activeDbPath);
    let dbStats: any = null;
    if (dbConfig.engine === 'postgres') {
      try {
        const sizeRes = await query<{ size_bytes: number }>(
          'SELECT pg_database_size(current_database())::bigint AS size_bytes'
        );
        const sizeBytes = Number(sizeRes.rows[0]?.size_bytes || 0);
        dbStats = {
          exists: true,
          engine: 'postgres',
          sizeBytes,
          sizeKb: Math.round(sizeBytes / 1024),
          sizeMb: (sizeBytes / (1024 * 1024)).toFixed(2),
          lastModified: new Date().toISOString(),
          absolutePath: `postgresql://${dbConfig.pg_host}:${dbConfig.pg_port}/${dbConfig.pg_database}`,
        };
      } catch {
        dbStats = {
          exists: false,
          engine: 'postgres',
          absolutePath: `postgresql://${dbConfig.pg_host}:${dbConfig.pg_port}/${dbConfig.pg_database}`,
        };
      }
    } else if (fs.existsSync(activeDbPath)) {
      try {
        const stat = fs.statSync(activeDbPath);
        dbStats = {
          exists: true,
          sizeBytes: stat.size,
          sizeKb: Math.round(stat.size / 1024),
          sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
          lastModified: stat.mtime.toISOString(),
          absolutePath: relativeDbPath,
        };
      } catch (e) {}
    } else {
      dbStats = {
        exists: false,
        absolutePath: relativeDbPath,
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { allowedRoles: ['super_admin'] });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();

    // 1. Action: Validasi Path Database (Strictly confined to ./data directory)
    if (body.action === 'validate_db_path') {
      const targetPath = body.sqlite_path?.trim();
      if (!targetPath) {
        return NextResponse.json({
          success: false,
          error: 'Lokasi path database tidak boleh kosong.',
        }, { status: 400 });
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
        } catch (e) {}
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
      const { safeRelativePath } = sanitizeSafeDataFilePath(
        dbCfg.sqlite_path,
        'ed_dashboard.db',
        ['.db', '.sqlite', '.sqlite3']
      );
      updatedDbConfig = await dbQueries.saveDbConfig({
        engine: dbCfg.engine || 'sqlite',
        sqlite_path: safeRelativePath,
        pg_host: dbCfg.pg_host || 'localhost',
        pg_port: Number(dbCfg.pg_port) || 5432,
        pg_database: dbCfg.pg_database || 'ed_dashboard',
        pg_user: dbCfg.pg_user || 'postgres',
        pg_password: dbCfg.pg_password,
        pg_ssl: Boolean(dbCfg.pg_ssl),
        max_connections: Number(dbCfg.max_connections) || 10,
      }, userName);

      try {
        await dbQueries.createAuditLog({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          action: 'CONFIG_UPDATE',
          entity: 'DatabaseConfig',
          entity_id: 'cfg_database',
          details: `Pembaruan Konfigurasi Database: Engine: ${updatedDbConfig.engine}, Path SQLite: ${updatedDbConfig.sqlite_path}, Host PG: ${updatedDbConfig.pg_host}:${updatedDbConfig.pg_port}/${updatedDbConfig.pg_database}`,
          ip_address: clientIp,
        });
      } catch (e) {}
    }

    // 3. Simpan Kredensial & Integrasi (Google Drive, Sheets, API Gateway)
    if (body.credentials) {
      const creds = body.credentials;
      const { safeRelativePath: safeExcelPath } = sanitizeSafeDataFilePath(
        creds.google_drive_file_path,
        'input_data.xlsx',
        ['.xlsx', '.xls', '.csv']
      );
      updatedCredentials = await dbQueries.saveIntegrationCredentials({
        google_drive_email: creds.google_drive_email ? creds.google_drive_email.trim() : 'regdashr@gmail.com',
        google_drive_file_path: safeExcelPath,
        google_sheets_id: creds.google_sheets_id ? creds.google_sheets_id.trim() : '',
        google_sheets_name: creds.google_sheets_name ? creds.google_sheets_name.trim() : 'Input_Kinerja_Bulanan',
        google_api_key: creds.google_api_key,
        api_gateway_url: creds.api_gateway_url || 'https://api.pelindo.co.id/v1/r4',
        api_gateway_token: creds.api_gateway_token,
      }, userName);

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
      } catch (e) {}
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
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      params: updatedParams || (await dbQueries.getSystemParameters()),
      dbConfig: toSafeDbConfig(updatedDbConfig || dbQueries.getDbConfig()),
      credentials: toSafeIntegrationCredentials(updatedCredentials || (await dbQueries.getIntegrationCredentials())),
      message: 'Konfigurasi parameter sistem, kredensial, dan database telah disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
