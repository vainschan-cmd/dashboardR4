import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Secret-at-rest encryption.
 *
 * The module caches its key on `globalThis`, so each test resets the global and
 * re-imports with a fresh environment to exercise the different key sources.
 */
const KEY_HEX = 'a'.repeat(64); // 32 bytes as hex
const OTHER_KEY_HEX = 'b'.repeat(64);

async function loadModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  const g = globalThis as Record<string, unknown>;
  delete g.__portsightSecretsKey;
  delete g.__portsightEphemeralSecretsKey;
  delete g.__portsightSecretsFallbackWarned;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('@/lib/secrets');
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SECRETS_ENCRYPTION_KEY;
  delete process.env.JWT_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('encryptSecret / decryptSecret', () => {
  it('melakukan round-trip dengan kunci eksplisit', async () => {
    const { encryptSecret, decryptSecret } = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    const plaintext = 'PG-Rahasia-Sekali-2026';
    const ciphertext = encryptSecret(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it('menghasilkan ciphertext berbeda untuk plaintext yang sama (IV acak)', async () => {
    const { encryptSecret } = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    const a = encryptSecret('sama-persis');
    const b = encryptSecret('sama-persis');

    expect(a).not.toBe(b);
    expect(a.split(':').length).toBe(5); // enc / v1 / iv / tag / data
  });

  it('membiarkan string kosong tetap kosong', async () => {
    const { encryptSecret, decryptSecret } = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('idempoten: nilai yang sudah terenkripsi tidak dienkripsi dua kali', async () => {
    const { encryptSecret, decryptSecret } = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    const once = encryptSecret('jangan-double');
    const twice = encryptSecret(once);
    expect(twice).toBe(once);
    expect(decryptSecret(twice)).toBe('jangan-double');
  });

  it('menerima plaintext lama tanpa enkripsi (kompatibilitas upgrade)', async () => {
    const { decryptSecret, isEncryptedSecret } = await loadModule({
      SECRETS_ENCRYPTION_KEY: KEY_HEX,
    });
    expect(isEncryptedSecret('masih-plaintext')).toBe(false);
    expect(decryptSecret('masih-plaintext')).toBe('masih-plaintext');
  });

  it('menolak ciphertext dengan kunci berbeda', async () => {
    const encrypted = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    const ciphertext = encrypted.encryptSecret('rahasia-lintas-kunci');

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = await loadModule({ SECRETS_ENCRYPTION_KEY: OTHER_KEY_HEX });

    // Kunci salah tidak boleh membocorkan ciphertext sebagai "plaintext".
    expect(other.decryptSecret(ciphertext)).toBe('');
  });

  it('menolak ciphertext yang dimodifikasi (integritas GCM)', async () => {
    const mod = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    const ciphertext = mod.encryptSecret('integritas-terjaga');
    const parts = ciphertext.split(':');
    // Ubah satu karakter pada bagian data.
    const data = parts[4];
    parts[4] = (data[0] === 'A' ? 'B' : 'A') + data.slice(1);

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mod.decryptSecret(parts.join(':'))).toBe('');
  });

  it('menolak bentuk ciphertext yang cacat', async () => {
    const { decryptSecret } = await loadModule({ SECRETS_ENCRYPTION_KEY: KEY_HEX });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(decryptSecret('enc:v1:hanya-dua-bagian')).toBe('');
    expect(decryptSecret('enc:v1:::')).toBe('');
  });

  it('menurunkan kunci dari JWT_SECRET bila kunci khusus tidak ada', async () => {
    const mod = await loadModule({ JWT_SECRET: 'j'.repeat(40) });
    const ciphertext = mod.encryptSecret('kredensial-integrasi');
    expect(mod.decryptSecret(ciphertext)).toBe('kredensial-integrasi');
  });

  it('menolak kunci eksplisit yang terlalu pendek', async () => {
    const mod = await loadModule({ SECRETS_ENCRYPTION_KEY: 'pendek sekali' });
    // Validasi dilakukan saat kunci dipakai, bukan saat modul diimpor.
    expect(() => mod.getSecretsKey()).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('menolak start produksi tanpa bahan kunci', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadModule({ NODE_ENV: 'production' });
    expect(() => mod.getSecretsKey()).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('memakai kunci sementara di development agar tidak pernah menulis plaintext', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadModule({ NODE_ENV: 'development' });
    const ciphertext = mod.encryptSecret('dev-secret');
    expect(ciphertext.startsWith('enc:v1:')).toBe(true);
    expect(mod.decryptSecret(ciphertext)).toBe('dev-secret');
  });
});

describe('helper field', () => {
  it('encryptSecretFields hanya menyentuh field yang diminta', async () => {
    const { encryptSecretFields, decryptSecretFields } = await loadModule({
      SECRETS_ENCRYPTION_KEY: KEY_HEX,
    });
    const source = { host: 'localhost', pg_password: 'rahasia', jumlah: 3 };
    const encrypted = encryptSecretFields(source, ['pg_password']);

    expect(encrypted.host).toBe('localhost');
    expect(encrypted.jumlah).toBe(3);
    expect(String(encrypted.pg_password).startsWith('enc:v1:')).toBe(true);
    expect(decryptSecretFields(encrypted as Record<string, unknown>, ['pg_password'])).toEqual(
      source
    );
  });
});
