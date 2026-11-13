import type {
  GoogleSheetsConfig,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from '../types';
import { getPool } from '../db/connection';
import { encryptSecret, decryptSecret } from '../secrets';
import { getDbConfig, saveDbConfig } from '../db/connection';

export const settingsRepository = {
  // Google Sheets Config
  getGoogleSheetsConfig: async (): Promise<GoogleSheetsConfig> => {
    try {
      const pool = getPool();
      const res = await pool.query("SELECT config_json FROM integration_settings WHERE service_name = 'google_sheets'");
      if (!res.rows[0]) {
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
      const raw = res.rows[0].config_json;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
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
  },

  saveGoogleSheetsConfig: async (cfg: GoogleSheetsConfig): Promise<void> => {
    const pool = getPool();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_gsheet', 'google_sheets', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(cfg), now]
    );
  },

  // System & Session Parameters
  getSystemParameters: async (): Promise<SystemParameters> => {
    const defaultParams: SystemParameters = {
      session_timeout_minutes: 30,
      auto_logout_idle: true,
      warning_before_minutes: 2,
      default_theme: 'light',
    };
    try {
      const pool = getPool();
      const res = await pool.query(
        "SELECT config_json FROM integration_settings WHERE service_name = 'system_parameters'"
      );
      if (!res.rows[0]) return defaultParams;
      const raw = res.rows[0].config_json;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...defaultParams, ...parsed };
    } catch {
      return defaultParams;
    }
  },

  saveSystemParameters: async (params: Partial<SystemParameters>): Promise<SystemParameters> => {
    const current = await settingsRepository.getSystemParameters();
    const updated: SystemParameters = {
      ...current,
      ...params,
      updated_at: new Date().toISOString(),
    };
    const pool = getPool();
    await pool.query(
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

  // Encrypted Integration Credentials
  getIntegrationCredentials: async (): Promise<IntegrationCredentials> => {
    const defaultCreds: IntegrationCredentials = {
      google_drive_email: 'regdashr@gmail.com',
      google_drive_file_path: 'data/input_data.xlsx',
      google_sheets_id: '',
      google_sheets_name: 'Input_Kinerja_Bulanan',
      google_api_key: '',
      api_gateway_url: 'https://api.pelindo.co.id/v1/r4',
      api_gateway_token: '',
    };
    try {
      const pool = getPool();
      const res = await pool.query(
        "SELECT config_json FROM integration_settings WHERE service_name = 'integration_credentials'"
      );
      if (!res.rows[0]) return defaultCreds;
      const raw = res.rows[0].config_json;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        ...defaultCreds,
        ...parsed,
        google_api_key: decryptSecret(parsed.google_api_key),
        api_gateway_token: decryptSecret(parsed.api_gateway_token),
      };
    } catch {
      return defaultCreds;
    }
  },

  saveIntegrationCredentials: async (
    creds: Partial<IntegrationCredentials>,
    updatedBy?: string
  ): Promise<IntegrationCredentials> => {
    const current = await settingsRepository.getIntegrationCredentials();
    const updated: IntegrationCredentials = {
      ...current,
      ...creds,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || 'Administrator',
    };
    const encryptedForStorage = {
      ...updated,
      google_api_key: updated.google_api_key ? encryptSecret(updated.google_api_key) : '',
      api_gateway_token: updated.api_gateway_token ? encryptSecret(updated.api_gateway_token) : '',
    };
    const pool = getPool();
    await pool.query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_credentials', 'integration_credentials', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(encryptedForStorage), updated.updated_at!]
    );
    return updated;
  },

  // Rate Limiting in PostgreSQL
  getRateLimitEntry: async (
    rateKey: string
  ): Promise<{ attempt_count: number; first_failed_at: number; locked_until: number } | null> => {
    try {
      const pool = getPool();
      const res = await pool.query(
        'SELECT attempt_count, first_failed_at, locked_until FROM auth_rate_limits WHERE rate_key = $1',
        [rateKey]
      );
      if (!res.rows[0]) return null;
      return {
        attempt_count: Number(res.rows[0].attempt_count || 0),
        first_failed_at: Number(res.rows[0].first_failed_at || 0),
        locked_until: Number(res.rows[0].locked_until || 0),
      };
    } catch {
      return null;
    }
  },

  upsertRateLimitEntry: async (
    rateKey: string,
    attemptCount: number,
    firstFailedAt: number,
    lockedUntil: number
  ): Promise<void> => {
    try {
      const pool = getPool();
      const now = Date.now();
      await pool.query(
        `INSERT INTO auth_rate_limits (rate_key, attempt_count, first_failed_at, locked_until, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (rate_key) DO UPDATE SET
           attempt_count = EXCLUDED.attempt_count,
           first_failed_at = EXCLUDED.first_failed_at,
           locked_until = EXCLUDED.locked_until,
           updated_at = EXCLUDED.updated_at`,
        [rateKey, attemptCount, firstFailedAt, lockedUntil, now]
      );
    } catch (e) {
      console.warn('[PG] Gagal mengupdate rate limit entry:', e);
    }
  },

  deleteRateLimitEntry: async (rateKey: string): Promise<void> => {
    try {
      const pool = getPool();
      await pool.query('DELETE FROM auth_rate_limits WHERE rate_key = $1', [rateKey]);
    } catch (e) {
      console.warn('[PG] Gagal menghapus rate limit entry:', e);
    }
  },
};
