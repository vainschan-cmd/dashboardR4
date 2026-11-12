import { describe, it, expect } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  MIN_DISTINCT_CHARACTERS,
  checkPasswordStrength,
  PASSWORD_HINT,
} from '@/lib/passwordPolicy';

describe('checkPasswordStrength', () => {
  it('menolak kata sandi kosong', () => {
    const result = checkPasswordStrength('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('menolak kata sandi lebih pendek dari batas minimum', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const result = checkPasswordStrength(short);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('menerima kata sandi tepat pada batas minimum bila karakternya beragam', () => {
    const exact = 'Abcdefgh123!';
    expect(exact).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(checkPasswordStrength(exact).valid).toBe(true);
  });

  it('menolak kata sandi yang hanya mengulang sedikit karakter', () => {
    // Panjang cukup, tetapi hanya 2 karakter berbeda.
    const repeated = 'abababababababab';
    expect(repeated.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(new Set(repeated).size).toBeLessThan(MIN_DISTINCT_CHARACTERS);
    const result = checkPasswordStrength(repeated);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('menolak spasi di awal atau akhir kata sandi', () => {
    expect(checkPasswordStrength(' Abcdefgh123!').valid).toBe(false);
    expect(checkPasswordStrength('Abcdefgh123! ').valid).toBe(false);
  });

  it('menerima spasi di tengah kata sandi', () => {
    expect(checkPasswordStrength('Abc def gh123!').valid).toBe(true);
  });

  it('menolak kata sandi yang melewati panjang maksimum', () => {
    const tooLong = `Aa1!${'x'.repeat(300)}`;
    const result = checkPasswordStrength(tooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('menjaga petunjuk kebijakan tetap sinkron dengan batas minimum', () => {
    expect(PASSWORD_HINT).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
