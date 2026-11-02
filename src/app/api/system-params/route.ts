import { NextRequest, NextResponse } from 'next/server';
import { dbQueries, getDbPath } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const params = dbQueries.getSystemParameters();
    const dbConfig = dbQueries.getDbConfig();
    const credentials = dbQueries.getIntegrationCredentials();

    const activeDbPath = getDbPath();
    let dbStats: any = null;
    if (fs.existsSync(activeDbPath)) {
      try {
        const stat = fs.statSync(activeDbPath);
        dbStats = {
          exists: true,
          sizeBytes: stat.size,
          sizeKb: Math.round(stat.size / 1024),
          sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
          lastModified: stat.mtime.toISOString(),
          absolutePath: path.resolve(activeDbPath),
        };
      } catch (e) {}
    } else {
      dbStats = {
        exists: false,
        absolutePath: path.resolve(activeDbPath),
      };
    }

    return NextResponse.json({
      success: true,
      params,
      dbConfig,
      credentials,
      activeDbPath,
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
  try {
    const body = await req.json();

    // 1. Action: Validasi Path Database
    if (body.action === 'validate_db_path') {
      const targetPath = body.sqlite_path?.trim();
      if (!targetPath) {
        return NextResponse.json({
          success: false,
          error: 'Lokasi path database tidak boleh kosong.',
        });
      }

      const resolved = path.isAbsolute(targetPath)
        ? targetPath
        : path.join(process.cwd(), targetPath);

      const exists = fs.existsSync(resolved);
      const parentDir = path.dirname(resolved);
      const parentExists = fs.existsSync(parentDir);

      let isWritable = false;
      try {
        if (!parentExists) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        // Test write permission
        const testFile = path.join(parentDir, `.test_write_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        isWritable = true;
      } catch (e) {
        isWritable = false;
      }

      let sizeBytes = 0;
      if (exists) {
        try {
          sizeBytes = fs.statSync(resolved).size;
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        resolvedPath: resolved,
        exists,
        isWritable,
        sizeKb: Math.round(sizeBytes / 1024),
        message: exists
          ? `File database ditemukan (${Math.round(sizeBytes / 1024)} KB) dan folder memiliki akses tulis.`
          : `File belum ada, namun folder tujuan ${parentDir} siap dan dapat ditulis.`,
      });
    }

    const userName = body.user_name || 'Admin Regional';
    const userId = body.user_id || 'admin_sys';
    const userRole = body.user_role || 'admin_regional';
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    let updatedParams = null;
    let updatedDbConfig = null;
    let updatedCredentials = null;

    // 2. Simpan Database Configuration (Lokasi & Engine)
    if (body.dbConfig) {
      const dbCfg = body.dbConfig;
      updatedDbConfig = dbQueries.saveDbConfig({
        engine: dbCfg.engine || 'sqlite',
        sqlite_path: dbCfg.sqlite_path ? dbCfg.sqlite_path.trim() : 'data/ed_dashboard.db',
        pg_host: dbCfg.pg_host || 'localhost',
        pg_port: Number(dbCfg.pg_port) || 5432,
        pg_database: dbCfg.pg_database || 'ed_dashboard',
        pg_user: dbCfg.pg_user || 'postgres',
        pg_password: dbCfg.pg_password || '',
        pg_ssl: Boolean(dbCfg.pg_ssl),
        max_connections: Number(dbCfg.max_connections) || 10,
      }, userName);

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
      } catch (e) {}
    }

    // 3. Simpan Kredensial & Integrasi (Google Drive, Sheets, API Gateway)
    if (body.credentials) {
      const creds = body.credentials;
      updatedCredentials = dbQueries.saveIntegrationCredentials({
        google_drive_email: creds.google_drive_email ? creds.google_drive_email.trim() : 'regdashr@gmail.com',
        google_drive_file_path: creds.google_drive_file_path ? creds.google_drive_file_path.trim() : 'data/input_data.xlsx',
        google_sheets_id: creds.google_sheets_id ? creds.google_sheets_id.trim() : '',
        google_sheets_name: creds.google_sheets_name ? creds.google_sheets_name.trim() : 'Input_Kinerja_Bulanan',
        google_api_key: creds.google_api_key || '',
        api_gateway_url: creds.api_gateway_url || 'https://api.pelindo.co.id/v1/r4',
        api_gateway_token: creds.api_gateway_token || '',
      }, userName);

      try {
        dbQueries.createAuditLog({
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

      updatedParams = dbQueries.saveSystemParameters({
        session_timeout_minutes: timeout,
        auto_logout_idle: autoLogout,
        warning_before_minutes: warning,
        default_theme: defaultTheme,
        updated_by: userName,
      });

      try {
        dbQueries.createAuditLog({
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
      params: updatedParams || dbQueries.getSystemParameters(),
      dbConfig: updatedDbConfig || dbQueries.getDbConfig(),
      credentials: updatedCredentials || dbQueries.getIntegrationCredentials(),
      message: 'Seluruh konfigurasi parameter sistem, kredensial, dan database berhasil disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
