import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Secret-at-rest encryption (AES-256-GCM).
 *
 * Credentials stored in `data/db_config.json` and the `integration_settings`
 * table (`pg_password`, `google_api_key`, `api_gateway_token`) must never be
 * readable from a filesystem copy or a database dump. Values are encrypted with
 * a key that only exists in the process environment, so a stolen file is inert.
 *
 * Key resolution order:
 * 1. `SECRETS_ENCRYPTION_KEY` — preferred. 32-byte key as base64/hex or a
 *    passphrase of at least 32 characters.
 * 2. Derived from `JWT_SECRET` (scrypt, fixed domain-separation salt). This
 *    keeps single-secret deployments working, at the cost of coupling: rotating
 *    `JWT_SECRET` also requires re-entering the stored secrets.
 *
 * Legacy plaintext values are still readable (`decryptSecret` passes them
 * through) so an upgrade does not break a running installation. They are
 * rewritten as ciphertext by `migrateSecretsAtRest()`.
 */

const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_KEY_LENGTH = 32;
const DERIVATION_SALT = 'portsight::secrets-at-rest::v1';

const globalForSecrets = globalThis as unknown as {
  __portsightSecretsKey?: Buffer;
  __portsightEphemeralSecretsKey?: Buffer;
  __portsightSecretsFallbackWarned?: boolean;
};

function decodeKeyMaterial(material: string): Buffer | null {
  const trimmed = material.trim();
  if (!trimmed) return null;

  // 64 hex characters = 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  // base64 of 32 bytes
  if (/^[A-Za-z0-9+/]{43}=?$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  }
  return null;
}

function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, DERIVATION_SALT, 32);
}

/**
 * Resolve the AES key. Returns `null` when no key material exists, which lets
 * callers decide whether that is fatal (encrypting) or harmless (there is
 * nothing encrypted to read yet).
 */
export function getSecretsKey(): Buffer | null {
  if (globalForSecrets.__portsightSecretsKey) {
    return globalForSecrets.__portsightSecretsKey;
  }

  const explicit = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (explicit) {
    if (explicit.length < MIN_KEY_LENGTH && !decodeKeyMaterial(explicit)) {
      throw new Error(
        `Konfigurasi ditolak: SECRETS_ENCRYPTION_KEY harus berupa kunci 32 byte (hex/base64) atau minimal ${MIN_KEY_LENGTH} karakter.`
      );
    }
    const key = decodeKeyMaterial(explicit) || deriveKey(explicit);
    globalForSecrets.__portsightSecretsKey = key;
    return key;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret && jwtSecret.length >= MIN_KEY_LENGTH) {
    if (!globalForSecrets.__portsightSecretsFallbackWarned) {
      globalForSecrets.__portsightSecretsFallbackWarned = true;
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[Secrets] SECRETS_ENCRYPTION_KEY tidak diatur; kunci enkripsi diturunkan dari JWT_SECRET. ' +
            'Disarankan memakai kunci terpisah agar rotasi JWT tidak membuat secret tersimpan tidak terbaca.'
        );
      }
    }
    const key = deriveKey(jwtSecret);
    globalForSecrets.__portsightSecretsKey = key;
    return key;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Konfigurasi produksi ditolak: SECRETS_ENCRYPTION_KEY (atau JWT_SECRET ≥ 32 karakter) wajib tersedia untuk mengenkripsi secret tersimpan.'
    );
  }

  // Development fallback: ephemeral per-process key. Dev databases then never
  // hold plaintext credentials either; values become unreadable after restart,
  // which is correct for throwaway local secrets and forces a re-entry instead
  // of silently degrading to plaintext.
  if (!globalForSecrets.__portsightEphemeralSecretsKey) {
    globalForSecrets.__portsightEphemeralSecretsKey = randomBytes(32);
    console.warn(
      '[Secrets] Tidak ada SECRETS_ENCRYPTION_KEY/JWT_SECRET; memakai kunci sementara untuk proses ini. ' +
        'Kredensial tersimpan tidak akan terbaca setelah server dimulai ulang.'
    );
  }
  return globalForSecrets.__portsightEphemeralSecretsKey;
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypt a secret. Empty strings stay empty (a blank credential is not a secret).
 * Throws when no key material is available — silently storing plaintext would
 * defeat the purpose of this module.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  if (isEncryptedSecret(plain)) return plain;

  const key = getSecretsKey();
  if (!key) {
    throw new Error(
      'Tidak dapat mengenkripsi secret: SECRETS_ENCRYPTION_KEY belum dikonfigurasi.'
    );
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt a stored secret. Legacy plaintext passes through unchanged so an
 * upgrade does not lock an existing installation out of its own credentials.
 * A value that cannot be decrypted (wrong/rotated key) resolves to an empty
 * string instead of throwing, so a misconfigured key degrades integration
 * instead of breaking every settings request.
 */
export function decryptSecret(stored: unknown): string {
  if (typeof stored !== 'string' || stored.length === 0) return '';
  if (!isEncryptedSecret(stored)) return stored;

  const key = getSecretsKey();
  if (!key) return '';

  const payload = stored.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) return '';

  const [ivB64, tagB64, dataB64] = parts;
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return '';

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    console.warn(
      '[Secrets] Secret tersimpan tidak dapat didekripsi. Periksa SECRETS_ENCRYPTION_KEY/JWT_SECRET.'
    );
    return '';
  }
}

/** Encrypt the listed fields of a record, leaving everything else untouched. */
export function encryptSecretFields<T extends Record<string, unknown>>(
  record: T,
  fields: ReadonlyArray<keyof T & string>
): T {
  const result = { ...record };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value) {
      result[field] = encryptSecret(value) as T[keyof T & string];
    }
  }
  return result;
}

/** Decrypt the listed fields of a record, converting to `''` on failure. */
export function decryptSecretFields<T extends Record<string, unknown>>(
  record: T,
  fields: ReadonlyArray<keyof T & string>
): T {
  const result = { ...record };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value) {
      result[field] = decryptSecret(value) as T[keyof T & string];
    }
  }
  return result;
}
