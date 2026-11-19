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

export interface PasswordStrengthDetails {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Belum diisi' | 'Lemah' | 'Cukup' | 'Kuat' | 'Sangat Kuat';
  criteria: {
    minLength: boolean;
    distinctChars: boolean;
    noEdgeSpaces: boolean;
    mixedVariety: boolean;
  };
  valid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthDetails {
  const value = String(password ?? '');
  if (!value) {
    return {
      score: 0,
      label: 'Belum diisi',
      criteria: {
        minLength: false,
        distinctChars: false,
        noEdgeSpaces: true,
        mixedVariety: false,
      },
      valid: false,
    };
  }

  const minLength = value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
  const distinctChars = new Set(value).size >= MIN_DISTINCT_CHARACTERS;
  const noEdgeSpaces = !/^\s|\s$/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigitOrSymbol = /[\d\W_]/.test(value);
  const mixedVariety = hasLower && hasUpper && hasDigitOrSymbol;
  const check = checkPasswordStrength(value);

  let score: 0 | 1 | 2 | 3 | 4 = 1;
  if (check.valid) {
    score = 3;
    if (mixedVariety && value.length >= 14) {
      score = 4;
    } else if (!mixedVariety && value.length < 14) {
      score = 2;
    }
  } else if (value.length >= 8 && distinctChars) {
    score = 2;
  }

  const labels: Record<0 | 1 | 2 | 3 | 4, PasswordStrengthDetails['label']> = {
    0: 'Belum diisi',
    1: 'Lemah',
    2: 'Cukup',
    3: 'Kuat',
    4: 'Sangat Kuat',
  };

  return {
    score,
    label: labels[score],
    criteria: {
      minLength,
      distinctChars,
      noEdgeSpaces,
      mixedVariety,
    },
    valid: check.valid,
  };
}
