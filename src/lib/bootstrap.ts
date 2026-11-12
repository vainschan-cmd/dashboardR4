import { randomBytes } from 'node:crypto';

/**
 * Minimum length for a bootstrap password supplied via environment variable.
 */
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;

/**
 * Passwords generated for development are cached per identifier so repeated
 * lookups within the same process return the same value.
 */
const generatedDevPasswords = new Map<string, string>();

/**
 * Resolve the initial password used when an account is created by seeding or by
 * spreadsheet import.
 *
 * - Production: `BOOTSTRAP_PIC_PASSWORD` is mandatory. Seeding fails closed so a
 *   deployment can never silently create accounts with a predictable password.
 * - Development / test: when the env var is absent, a random per-account password
 *   is generated once per process and printed to the server console.
 *
 * The legacy shared demo password is never used anywhere in the codebase; every
 * account starts from an explicit bootstrap value or a generated secret.
 */
export function resolveBootstrapPassword(identifier: string): string {
  const envPassword = process.env.BOOTSTRAP_PIC_PASSWORD?.trim();

  if (envPassword) {
    if (envPassword.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
      throw new Error(
        `Konfigurasi ditolak: BOOTSTRAP_PIC_PASSWORD harus minimal ${MIN_BOOTSTRAP_PASSWORD_LENGTH} karakter.`
      );
    }
    return envPassword;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Konfigurasi produksi ditolak: BOOTSTRAP_PIC_PASSWORD wajib diatur sebelum akun awal dibuat. ' +
        'Gunakan nilai acak minimal 12 karakter lalu ganti setelah login pertama.'
    );
  }

  const cached = generatedDevPasswords.get(identifier);
  if (cached) {
    return cached;
  }

  // base64url of 12 random bytes => 16 characters, no shell-hostile characters.
  const generated = randomBytes(12).toString('base64url');
  generatedDevPasswords.set(identifier, generated);
  console.warn(
    `[Bootstrap] Kata sandi sementara untuk "${identifier}" adalah: ${generated} ` +
      '(hanya ditampilkan sekali per proses; ganti setelah login pertama).'
  );
  return generated;
}

/**
 * Random password that can never be guessed. Used to neutralize accounts whose
 * stored credential is missing or invalid instead of silently assigning a weak default.
 */
export function generateUnguessablePassword(): string {
  return randomBytes(48).toString('base64url');
}
