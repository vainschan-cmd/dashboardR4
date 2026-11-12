import type {
  GoogleSheetsConfig,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from '../types';
import { getDb } from '../db/connection';
import { encryptSecret, decryptSecret } from '../secrets';
import { SECRET_MASK, sanitizeSafeDataFilePath } from '../db/helpers';
import { getDbConfig, saveDbConfig } from '../db/connection';

/**
 * Settings and configuration (`CODE-03`): Google Sheets target, system
 * parameters, database configuration, and encrypted integration credentials.
 *
 * Credentials are decrypted on read and encrypted on write here and nowhere
 * else, so there is exactly one place to audit for plaintext leakage.
 */
export const settingsRepository = {
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
    const current = settingsRepository.getSystemParameters();
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
    const stored = JSON.parse(String(row.config_json)) as Record<string, unknown>;
    return {
      google_drive_email: 'regdashr@gmail.com',
      google_drive_file_path: 'data/input_data.xlsx',
      google_sheets_id: '1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data',
      google_sheets_name: 'Input_Kinerja_Bulanan',
      ...(stored as Partial<IntegrationCredentials>),
      // Credentials are stored encrypted; callers always receive plaintext.
      google_api_key: decryptSecret(stored.google_api_key),
      api_gateway_token: decryptSecret(stored.api_gateway_token),
    };
  },
  saveIntegrationCredentials: (creds: Partial<IntegrationCredentials>, updatedBy?: string): IntegrationCredentials => {
    const db = getDb();
    const current = settingsRepository.getIntegrationCredentials();
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
    // Encrypt before persisting; the returned object stays plaintext for callers.
    const persistedCredentials = {
      ...updated,
      google_api_key: updated.google_api_key ? encryptSecret(updated.google_api_key) : '',
      api_gateway_token: updated.api_gateway_token ? encryptSecret(updated.api_gateway_token) : '',
    };
    db.prepare(`
      INSERT OR REPLACE INTO integration_settings (id, service_name, config_json, updated_at)
      VALUES ('cfg_credentials', 'integration_credentials', ?, ?)
    `).run(JSON.stringify(persistedCredentials), updated.updated_at!);

    try {
      const currentGSheet = settingsRepository.getGoogleSheetsConfig();
      settingsRepository.saveGoogleSheetsConfig({
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
};
