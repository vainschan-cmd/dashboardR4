/**
 * Precision and numeric calculation utilities (DATA-09).
 * Avoids floating-point drift in monetary and percentage calculations.
 */

const DEFAULT_EPSILON = 1e-9;

/**
 * Accurately round a number to specified decimal places without floating-point artifacts.
 * e.g., roundTo(1.005, 2) => 1.01 instead of 1.00
 */
export function roundTo(val: number, decimals = 2): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Format a number to fixed decimal string safely.
 */
export function toDecimalString(val: number, decimals = 2): string {
  return roundTo(val, decimals).toFixed(decimals);
}

/**
 * Safe addition of numbers avoiding floating-point drift.
 */
export function safeAdd(...nums: number[]): number {
  const sum = nums.reduce((acc, curr) => {
    if (!Number.isFinite(curr)) return acc;
    return acc + curr;
  }, 0);
  return roundTo(sum, 6);
}

/**
 * Safe subtraction: a - b
 */
export function safeSubtract(a: number, b: number): number {
  const valA = Number.isFinite(a) ? a : 0;
  const valB = Number.isFinite(b) ? b : 0;
  return roundTo(valA - valB, 6);
}

/**
 * Safe multiplication: a * b
 */
export function safeMultiply(a: number, b: number, decimals = 6): number {
  const valA = Number.isFinite(a) ? a : 0;
  const valB = Number.isFinite(b) ? b : 0;
  return roundTo(valA * valB, decimals);
}

/**
 * Safe division: a / b. Returns 0 if denominator is 0.
 */
export function safeDivide(a: number, b: number, decimals = 4): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return 0;
  }
  return roundTo(a / b, decimals);
}

/**
 * Calculate percentage achievement: (realization / target) * 100
 */
export function safePercentage(realization: number, target: number, decimals = 2): number {
  if (!Number.isFinite(realization) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  return roundTo((realization / target) * 100, decimals);
}

/**
 * Compare two numeric values with epsilon tolerance.
 */
export function numericEqual(a: number, b: number, epsilon = DEFAULT_EPSILON): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= epsilon;
}

/**
 * Parse numeric inputs safely from string or number; defaults to 0 on NaN.
 */
export function parseSafeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

