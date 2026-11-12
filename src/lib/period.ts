/**
 * Single source of truth for period labels used across the dashboard.
 *
 * The UI keeps a human-readable label (e.g. "YTD Sep 2026") while every API
 * expects numeric year/month windows. Parsing in one place removes the scattered
 * hardcoded `month=9&year=2026` values that previously drifted from the UI filter.
 */

export interface PeriodRange {
  /** Label that produced this range, for display/debugging. */
  label: string;
  /** Inclusive start of the reporting window. */
  startYear: number;
  startMonth: number;
  /** Inclusive end of the reporting window (the "as of" period). */
  endYear: number;
  endMonth: number;
}

const MONTH_INDEX: Record<string, number> = {
  JAN: 1, JANUARI: 1, JANUARY: 1,
  FEB: 2, FEBRUARI: 2, FEBRUARY: 2,
  MAR: 3, MARET: 3, MARCH: 3,
  APR: 4, APRIL: 4,
  MEI: 5, MAY: 5,
  JUN: 6, JUNI: 6, JUNE: 6,
  JUL: 7, JULI: 7, JULY: 7,
  AGU: 8, AGT: 8, AGUSTUS: 8, AUG: 8, AUGUST: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OKT: 10, OCT: 10, OKTOBER: 10, OCTOBER: 10,
  NOV: 11, NOP: 11, NOVEMBER: 11, NOPEMBER: 11,
  DES: 12, DEC: 12, DESEMBER: 12, DECEMBER: 12,
};

function clampMonth(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(value)));
}

/**
 * Resolve a period label into an inclusive year/month range.
 *
 * Supported shapes:
 * - `"YTD Sep 2026"`  → Jan 2026 .. Sep 2026
 * - `"Full Year 2025"` / `"FY 2025"` → Jan 2025 .. Dec 2025
 * - `"Q3 2026"`       → Jul 2026 .. Sep 2026
 * - `"Sep 2026"`      → Sep 2026 .. Sep 2026
 * - `"2026-09"`       → Sep 2026 .. Sep 2026
 *
 * Unrecognised labels fall back to year-to-date of the fallback date instead of
 * silently using a stale hardcoded period.
 */
export function resolvePeriodRange(
  label?: string | null,
  fallback: Date = new Date()
): PeriodRange {
  const raw = String(label || '').trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, ' ');

  const fallbackYear = fallback.getFullYear();
  const fallbackMonth = fallback.getMonth() + 1;
  const fallbackRange: PeriodRange = {
    label: raw || `YTD ${fallbackMonth}/${fallbackYear}`,
    startYear: fallbackYear,
    startMonth: 1,
    endYear: fallbackYear,
    endMonth: fallbackMonth,
  };

  if (!normalized) return fallbackRange;

  // ISO-like "2026-09"
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = clampMonth(Number(isoMatch[2]));
    return { label: raw, startYear: year, startMonth: month, endYear: year, endMonth: month };
  }

  const yearMatch = normalized.match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;

  // Quarter: "Q3 2026"
  const quarterMatch = normalized.match(/Q([1-4])/);
  if (quarterMatch) {
    const quarter = Number(quarterMatch[1]);
    return {
      label: raw,
      startYear: year,
      startMonth: quarter * 3 - 2,
      endYear: year,
      endMonth: quarter * 3,
    };
  }

  // Month name lookup
  let month: number | null = null;
  for (const [token, index] of Object.entries(MONTH_INDEX)) {
    if (new RegExp(`\\b${token}\\b`).test(normalized)) {
      month = index;
      break;
    }
  }

  if (normalized.includes('FULL YEAR') || normalized.includes('FY') || normalized.includes('TAHUN')) {
    return {
      label: raw,
      startYear: year,
      startMonth: 1,
      endYear: year,
      endMonth: 12,
    };
  }

  if (month !== null) {
    const isYtd = normalized.includes('YTD') || normalized.includes('YT');
    return {
      label: raw,
      startYear: year,
      startMonth: isYtd ? 1 : month,
      endYear: year,
      endMonth: month,
    };
  }

  // Year-only label → full year
  if (/^\d{4}$/.test(normalized)) {
    return { label: raw, startYear: year, startMonth: 1, endYear: year, endMonth: 12 };
  }

  return { ...fallbackRange, label: raw };
}

/** Query string fragment for endpoints that accept a single year/month window. */
export function toSinglePeriodQuery(range: PeriodRange): { year: string; month: string } {
  return { year: String(range.endYear), month: String(range.endMonth) };
}

/** Query string fragment for endpoints that accept an explicit range. */
export function toRangeQuery(range: PeriodRange): Record<string, string> {
  return {
    startYear: String(range.startYear),
    startMonth: String(range.startMonth),
    endYear: String(range.endYear),
    endMonth: String(range.endMonth),
  };
}
