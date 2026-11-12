/**
 * Database facade (`CODE-03`).
 *
 * This file used to be a single 1,988-line module holding schema creation, the
 * connection lifecycle, and every query in the system. It is now a barrel: the
 * concrete work lives in small, singly-purposed modules so that a change to,
 * say, session revocation can no longer accidentally alter how financial
 * records are aggregated.
 *
 *   db/helpers.ts       — value sanitising (users, db config, credentials)
 *   db/schema.ts        — `initSchema`, table definitions and seed data
 *   db/connection.ts    — connection lifecycle, transactions, config storage
 *   db/maintenance.ts   — throttled housekeeping and background spreadsheet sync
 *   repositories/*.ts   — one module per data domain
 *
 * Everything that used to be exported from here is still exported from here,
 * so the ~28 consumers of `@/lib/db` did not have to change.
 */
import type { AuditLog, ImportBatch, IntegrationCredentials, MonthlyRecord } from './types';
import { SECRET_MASK } from './db/helpers';
import { settingsRepository } from './repositories/settings';
import { masterRepository } from './repositories/master';
import { usersRepository } from './repositories/users';
import { recordsRepository } from './repositories/records';
import { auditRepository } from './repositories/audit';
import { authSessionsRepository } from './repositories/authSessions';
import { getDb, withTransaction } from './db/connection';

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
  const source = creds || settingsRepository.getIntegrationCredentials();
  return {
    ...source,
    google_api_key: source.google_api_key ? SECRET_MASK : '',
    api_gateway_token: source.api_gateway_token ? SECRET_MASK : '',
  };
}

/**
 * Flat query facade.
 *
 * Kept as one object because that is how every caller already consumes it
 * (`dbQueries.getUsers()`, `dbQueries.insertMonthlyRecords()` …). The keys are
 * spread from the domain repositories above, so this object has no logic of its
 * own — only the transactional import commit, which by definition spans more
 * than one domain.
 */
export const dbQueries = {
  ...masterRepository,
  ...usersRepository,
  ...recordsRepository,
  ...auditRepository,
  ...settingsRepository,
  ...authSessionsRepository,

  /** Atomic commit of imported records + batch metadata + audit log. */
  commitImportTransaction: (params: {
    records: Omit<
      MonthlyRecord,
      'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'
    >[];
    batch: ImportBatch;
    auditLog: Omit<AuditLog, 'id' | 'timestamp'>;
  }): void => {
    const db = getDb();
    withTransaction(db, () => {
      recordsRepository.insertMonthlyRecords(params.records);
      auditRepository.createImportBatch(params.batch);
      auditRepository.createAuditLog(params.auditLog);
    });
  },
};
