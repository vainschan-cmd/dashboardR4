/**
 * Single source of truth for every number, date, and currency shown to a user.
 *
 * Why this exists (`COPY-03`): the interface showed `99.01` and `99,01` on the
 * same screen, and "Rp 3,19 T" next to "Billions". Both come from mixed habits —
 * `toFixed()` always emits a dot, while `toLocaleString('id-ID')` emits a comma.
 *
 * Rules:
 * - Indonesian formatting everywhere: `.` groups thousands, `,` marks decimals.
 * - `toFixed()` must never reach the screen; use these helpers instead.
 * - Percentages take a fraction-digit count so `99,0%` and `99,01%` both work.
 * - Dates use Indonesian month names, never `MM/DD/YYYY`.
 */

const LOCALE = 'id-ID';

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `1234567` → `1.234.567` */
export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (!isUsable(value)) return '0';
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * `99.0123` → `99,01%`. Returns an em dash for missing data so an absent figure
 * is never mistaken for zero.
 */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 2,
  { withSign = false, missing = '—' }: { withSign?: boolean; missing?: string } = {}
): string {
  if (!isUsable(value)) return missing;
  const body = value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const prefix = withSign && value > 0 ? '+' : '';
  return `${prefix}${body}%`;
}

/** Signed change against a 100-based index: `99.0` → `-1,0%`. */
export function formatPercentDelta(value: number | null | undefined, fractionDigits = 1): string {
  if (!isUsable(value)) return '—';
  const delta = value - 100;
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${sign}${Math.abs(delta).toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function formatRupiahFull(val: number | null | undefined): string {
  if (!isUsable(val)) return 'Rp 0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString(LOCALE);
  return isNegative ? `Rp -${formatted}` : `Rp ${formatted}`;
}

export function formatRupiahCompact(val: number | null | undefined): string {
  if (!isUsable(val)) return 'Rp 0';
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const sign = isNegative ? '-' : '';

  const scaled = (divisor: number, digits: number) =>
    (absVal / divisor).toLocaleString(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  if (absVal >= 1_000_000_000_000) return `Rp ${sign}${scaled(1_000_000_000_000, 2)} T`;
  if (absVal >= 1_000_000_000) return `Rp ${sign}${scaled(1_000_000_000, 2)} M`;
  if (absVal >= 1_000_000) return `Rp ${sign}${scaled(1_000_000, 1)} Jt`;
  return formatRupiahFull(val);
}

export function formatNominalFull(val: number | null | undefined): string {
  if (!isUsable(val)) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString(LOCALE);
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format khusus metrik Beban: **selalu** satuan Triliun (T) dengan pembulatan
 * besaran ke atas (ROUNDUP 2 desimal menjauhi nol), meskipun nominalnya di bawah
 * 1 Triliun — mis. `-293.827.270.311` → `- Rp 0,30 T`.
 *
 * Alasannya bukan kosmetik: nilai Beban dan Pendapatan dibandingkan berdampingan,
 * dan kalau Beban turun ke "Jt" sementara Pendapatan tetap "T", pembaca harus
 * mengonversi satuan di kepalanya sendiri untuk melihat selisihnya.
 */
export function formatBebanTriliun(
  nominal: number | null | undefined,
  options?: { includeCurrency?: boolean }
): string {
  const includeCurrency = options?.includeCurrency ?? true;
  if (!isUsable(nominal) || Math.abs(nominal) < 0.5) {
    return includeCurrency ? 'Rp 0,00 T' : '0,00 T';
  }

  // Membulatkan ke atas pada kelipatan 0,01 T (10 Miliar), dengan toleransi
  // 1e-11 supaya noise IEEE 754 tidak menaikkan angka yang sudah pas.
  const scaled = Math.abs(nominal) / 10_000_000_000;
  const floored = Math.floor(scaled);
  const absUnits = scaled - floored <= 1e-11 ? floored : Math.ceil(scaled);
  const absRounded = absUnits / 100;
  const isNegative = nominal < 0 && absRounded > 0;
  const formattedNumber = absRounded.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (includeCurrency) {
    return isNegative ? `- Rp ${formattedNumber} T` : `Rp ${formattedNumber} T`;
  }
  return isNegative ? `-${formattedNumber} T` : `${formattedNumber} T`;
}

/** `{ year: 2026, month: 9 }` → `September 2026` */
export function formatMonthYear(year: number, month: number): string {
  if (!isUsable(year) || !isUsable(month) || month < 1 || month > 12) return '—';
  return `${MONTH_NAMES_ID[month - 1]} ${year}`;
}

/** `2026-09-12T...` → `12 September 2026`. Returns `—` for unusable input. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTH_NAMES_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/** `2026-09-12T08:30:00Z` → `12 September 2026, 08.30` (Indonesian time notation). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)}, ${hh}.${mm}`;
}
