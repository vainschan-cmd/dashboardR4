/**
 * Utility formatter untuk tampilan nilai Rupiah dan Nominal numerik:
 * - formatRupiahCompact: tampilan ringkas eksekutif (Rp 6,79 T / Rp 485,41 M) untuk kartu KPI.
 * - formatRupiahFull: tampilan nominal penuh hingga satuan Rupiah (Rp 6.794.956.407.643) untuk tooltip & modal detail.
 */

export function formatRupiahFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  const safe = Math.abs(val) < 0.5 ? 0 : val;
  const isNegative = safe < 0;
  const absVal = Math.abs(Math.round(safe));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `- Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatRupiahCompact(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  const safe = Math.abs(val) < 0.005 ? 0 : val;
  const isNegative = safe < 0;
  const absVal = Math.abs(safe);
  const prefix = isNegative ? '- Rp ' : 'Rp ';

  if (absVal >= 1_000_000_000_000) {
    return `${prefix}${(absVal / 1_000_000_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} T`;
  }
  if (absVal >= 1_000_000_000) {
    return `${prefix}${(absVal / 1_000_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} M`;
  }
  if (absVal >= 1_000_000) {
    return `${prefix}${(absVal / 1_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Jt`;
  }
  return formatRupiahFull(safe);
}

export function formatNominalFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `-${formatted}` : formatted;
}
