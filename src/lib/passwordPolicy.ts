/**
 * Password policy helpers shared by the UI and the API.
 * Keep the numeric minimums here so validation, hints, and DB guards never drift.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;
/** Minimum number of distinct characters to reject trivially weak repeated patterns. */
export const MIN_DISTINCT_CHARACTERS = 6;

export interface PasswordCheck {
  valid: boolean;
  /** First problem found, phrased as an instruction for the user. */
  error?: string;
}

export function checkPasswordStrength(password: string): PasswordCheck {
  const value = String(password ?? '');

  if (value.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.` };
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Kata sandi maksimal ${MAX_PASSWORD_LENGTH} karakter.` };
  }
  if (/^\s|\s$/.test(value)) {
    return { valid: false, error: 'Kata sandi tidak boleh diawali atau diakhiri spasi.' };
  }
  if (new Set(value).size < MIN_DISTINCT_CHARACTERS) {
    return {
      valid: false,
      error: 'Kata sandi terlalu mudah ditebak. Gunakan kombinasi karakter yang lebih beragam.',
    };
  }

  return { valid: true };
}

export const PASSWORD_HINT = `Minimal ${MIN_PASSWORD_LENGTH} karakter, hindari pola berulang atau kata yang mudah ditebak.`;
