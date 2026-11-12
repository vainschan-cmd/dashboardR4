import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing, isolated from session logic.
 *
 * Why a separate module (`CODE-04`): `db.ts` needs `hashPassword` during schema
 * setup, and `auth.ts` needs `dbQueries` for the session registry — so `db.ts` ↔
 * `auth.ts` was a static import cycle. It worked only because both directions
 * were used inside functions rather than at module scope; the moment one side
 * gained a top-level initialiser, one import order would see `undefined`.
 *
 * This module depends on nothing but `node:crypto`, so both sides can import it
 * without forming a cycle.
 */

const SCRYPT_PREFIX = 'scrypt$';
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

/** Check whether a password string is already hashed with scrypt. */
export function isPasswordHashed(password?: string | null): boolean {
  return Boolean(password && password.startsWith(SCRYPT_PREFIX));
}

/**
 * Hash a plaintext password using Node's native `crypto.scryptSync`.
 *
 * Synchronous on purpose: used by schema setup and migrations that run outside the
 * request/response path. Request handlers use `hashPasswordAsync`, because scrypt
 * is intentionally expensive (~100 ms) and would block the whole process.
 */
export function hashPassword(plainPassword: string): string {
  if (isPasswordHashed(plainPassword)) return plainPassword;
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
}

/** Non-blocking password hash for request handlers. */
export async function hashPasswordAsync(plainPassword: string): Promise<string> {
  if (isPasswordHashed(plainPassword)) return plainPassword;
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(plainPassword, salt, KEY_LENGTH);
  return `${SCRYPT_PREFIX}${salt}$${derivedKey.toString('hex')}`;
}

function safeTimingEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(plainPassword: string, storedPassword?: string | null): boolean {
  if (!plainPassword || !storedPassword) return false;

  try {
    if (storedPassword.startsWith(SCRYPT_PREFIX)) {
      const parts = storedPassword.split('$');
      if (parts.length !== 3) return false;
      const [, salt, storedHashHex] = parts;
      if (!salt || !storedHashHex) return false;

      const derivedBuffer = scryptSync(plainPassword, salt, KEY_LENGTH);
      return safeTimingEqual(derivedBuffer, Buffer.from(storedHashHex, 'hex'));
    }

    // Legacy fallback for an unmigrated row (strict exact match, no universal bypass).
    return safeTimingEqual(Buffer.from(plainPassword, 'utf8'), Buffer.from(storedPassword, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Non-blocking verification for the login path. Same semantics as
 * `verifyPassword`, but the expensive derivation runs off the main thread so
 * concurrent logins do not serialise on each other.
 */
export async function verifyPasswordAsync(
  plainPassword: string,
  storedPassword?: string | null
): Promise<boolean> {
  if (!plainPassword || !storedPassword) return false;

  try {
    if (storedPassword.startsWith(SCRYPT_PREFIX)) {
      const parts = storedPassword.split('$');
      if (parts.length !== 3) return false;
      const [, salt, storedHashHex] = parts;
      if (!salt || !storedHashHex) return false;

      const derivedBuffer = await scryptAsync(plainPassword, salt, KEY_LENGTH);
      return safeTimingEqual(derivedBuffer, Buffer.from(storedHashHex, 'hex'));
    }

    return safeTimingEqual(Buffer.from(plainPassword, 'utf8'), Buffer.from(storedPassword, 'utf8'));
  } catch {
    return false;
  }
}
