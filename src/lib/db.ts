import type { AuditLog, ImportBatch, IntegrationCredentials, MonthlyRecord } from './types';
import { SECRET_MASK } from './db/helpers';
import { settingsRepository } from './repositories/settings';
import { masterRepository } from './repositories/master';
import { usersRepository } from './repositories/users';
import { recordsRepository } from './repositories/records';
import { auditRepository } from './repositories/audit';
import { authSessionsRepository } from './repositories/authSessions';
import { getPool, query, withTransaction } from './db/connection';

export { SECRET_MASK, sanitizeSafeDataFilePath, toSafeUser } from './db/helpers';
export {
  getDb,
  getDbConfig,
  getDbPath,
  getMigrationStatus,
  isDatabaseEmpty,
  saveDbConfig,
  toSafeDbConfig,
  withTransaction,
  getPool,
  query,
  isPostgresActive,
} from './db/connection';
export { maybeRunAuthHousekeeping } from './db/maintenance';
export { masterRepository } from './repositories/master';
export { usersRepository } from './repositories/users';
export { recordsRepository } from './repositories/records';
export { auditRepository } from './repositories/audit';
export { settingsRepository } from './repositories/settings';
export { authSessionsRepository } from './repositories/authSessions';

/**
 * Mask sensitive external API keys and tokens before returning in API responses.
 */
export function toSafeIntegrationCredentials(
  creds?: IntegrationCredentials
): IntegrationCredentials {
  const source = creds || {
    google_drive_email: 'regdashr@gmail.com',
    google_drive_file_path: 'data/input_data.xlsx',
    google_sheets_id: '',
    google_sheets_name: 'Input_Kinerja_Bulanan',
    api_gateway_url: 'https://api.pelindo.co.id/v1/r4',
  };
  return {
    ...source,
    google_api_key: source.google_api_key ? SECRET_MASK : '',
    api_gateway_token: source.api_gateway_token ? SECRET_MASK : '',
  };
}

/**
 * Flat query facade against PostgreSQL ed_dashboard.
 */
export const dbQueries = {
  ...masterRepository,
  ...usersRepository,
  ...recordsRepository,
  ...auditRepository,
  ...settingsRepository,
  ...authSessionsRepository,

  /** Atomic commit of imported records + batch metadata + audit log. */
  commitImportTransaction: async (params: {
    records: Omit<
      MonthlyRecord,
      'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'
    >[];
    batch: ImportBatch;
    auditLog: Omit<AuditLog, 'id' | 'timestamp'>;
  }): Promise<void> => {
    await recordsRepository.insertMonthlyRecords(params.records);
    await auditRepository.createImportBatch(params.batch);
    await auditRepository.createAuditLog(params.auditLog);
  },
};
