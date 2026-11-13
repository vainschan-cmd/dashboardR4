import { hashPassword } from '../passwordHash';
import { generateUnguessablePassword } from '../bootstrap';
import { authSessionsRepository } from '../repositories/authSessions';

/**
 * Coalesced background export of the user master spreadsheet.
 *
 * `exportUsersToSpreadsheet` writes an .xlsx file with `fs` synchronously. Doing
 * that inside a request handler adds file I/O latency to every user mutation
 * (and the spreadsheet is only a convenience mirror, never the source of truth).
 * Scheduling it on the next tick coalesces bursts — creating ten accounts now
 * writes the file once — and keeps the HTTP response path free of disk writes.
 */
let pendingSpreadsheetSync: NodeJS.Timeout | null = null;

export function scheduleUsersSpreadsheetSync(): void {
  if (pendingSpreadsheetSync) return;
  pendingSpreadsheetSync = setTimeout(() => {
    pendingSpreadsheetSync = null;
    // Dynamic import: a static `import { exportUsersToSpreadsheet }` would
    // re-introduce the `db.ts` ↔ `userPicSync.ts` cycle (`CODE-04`).
    void Promise.all([import('../userPicSync'), import('../repositories/users')])
      .then(async ([{ exportUsersToSpreadsheet }, { usersRepository }]) => {
        const users = await usersRepository.getUsers();
        exportUsersToSpreadsheet(users);
      })
      .catch((e) => {
        console.warn('[DB] Gagal menyinkronkan spreadsheet pengguna di latar belakang:', e);
      });
  }, 250);
  // Do not keep the process alive solely for a mirror file.
  if (typeof pendingSpreadsheetSync.unref === 'function') {
    pendingSpreadsheetSync.unref();
  }
}

/**
 * Lazily created scrypt hash used only to equalize login timing for unknown NIPP.
 * It is never associated with an account and can never authenticate.
 */
let dummyPasswordHash: string | null = null;
export function getDummyPasswordHash(): string {
  if (!dummyPasswordHash) {
    dummyPasswordHash = hashPassword(generateUnguessablePassword());
  }
  return dummyPasswordHash;
}

/**
 * Throttled auth-table housekeeping.
 *
 * Expired sessions and stale rate-limit rows must be deleted eventually, but
 * deleting them is not urgent and must not run on every login. This keeps the
 * work to at most once per hour per process, in the background, and swallows
 * errors so maintenance can never break authentication.
 */
const globalForHousekeeping = globalThis as unknown as {
  __portsightLastAuthHousekeeping?: number;
};
const AUTH_HOUSEKEEPING_INTERVAL_MS = 60 * 60 * 1000;

export function maybeRunAuthHousekeeping(): void {
  const last = globalForHousekeeping.__portsightLastAuthHousekeeping ?? 0;
  const now = Date.now();
  if (now - last < AUTH_HOUSEKEEPING_INTERVAL_MS) return;
  globalForHousekeeping.__portsightLastAuthHousekeeping = now;

  authSessionsRepository
    .purgeStaleAuthData()
    .then((result) => {
      if (result.sessions > 0 || result.rateLimits > 0) {
        console.log(
          `[DB Housekeeping] ${result.sessions} sesi kedaluwarsa dan ${result.rateLimits} entri rate limit dibersihkan.`
        );
      }
    })
    .catch((e) => {
      console.warn('[DB Housekeeping] Pembersihan tabel autentikasi gagal:', e);
    });
}
