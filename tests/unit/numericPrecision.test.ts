import { describe, it, expect } from 'vitest';
import {
  roundTo,
  toDecimalString,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  safePercentage,
  numericEqual,
  parseSafeNumber,
} from '@/lib/numericPrecision';

describe('Numeric Precision (DATA-09)', () => {
  it('correctly rounds decimals without float drift', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(toDecimalString(1.2, 2)).toBe('1.20');
  });

  it('safely adds multiple numbers without drift', () => {
    expect(safeAdd(0.1, 0.2)).toBe(0.3);
    expect(safeAdd(10.1, 20.2, 30.3)).toBe(60.6);
  });

  it('safely subtracts numbers', () => {
    expect(safeSubtract(1.0, 0.9)).toBe(0.1);
  });

  it('safely multiplies numbers', () => {
    expect(safeMultiply(0.07, 100, 2)).toBe(7);
  });

  it('safely divides and handles divide-by-zero gracefully', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(1, 3, 2)).toBe(0.33);
  });

  it('calculates safe percentage achievement', () => {
    expect(safePercentage(80, 100)).toBe(80);
    expect(safePercentage(150, 100)).toBe(150);
    expect(safePercentage(50, 0)).toBe(0);
  });

  it('compares equality with epsilon', () => {
    expect(numericEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(numericEqual(1.000000001, 1.0, 1e-6)).toBe(true);
    expect(numericEqual(1.01, 1.0, 1e-6)).toBe(false);
  });

  it('parses strings and numbers safely', () => {
    expect(parseSafeNumber('1,234.56')).toBe(1234.56);
    expect(parseSafeNumber('invalid', 0)).toBe(0);
    expect(parseSafeNumber(null, 10)).toBe(10);
    expect(parseSafeNumber(42)).toBe(42);
  });
});

