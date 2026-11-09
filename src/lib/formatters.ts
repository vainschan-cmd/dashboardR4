/**
 * Utility formatter untuk tampilan nilai Rupiah dan Nominal numerik:
 * - formatRupiahCompact: tampilan ringkas eksekutif (Rp 6,79 T / Rp 485,41 M) untuk kartu KPI.
 * - formatRupiahFull: tampilan nominal penuh hingga satuan Rupiah (Rp 6.794.956.407.643) untuk tooltip & modal detail.
 */

export function formatRupiahFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `Rp -${formatted}` : `Rp ${formatted}`;
}

export function formatRupiahCompact(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const sign = isNegative ? '-' : '';

  if (absVal >= 1_000_000_000_000) {
    return `Rp ${sign}${(absVal / 1_000_000_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} T`;
  }
  if (absVal >= 1_000_000_000) {
    return `Rp ${sign}${(absVal / 1_000_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} M`;
  }
  if (absVal >= 1_000_000) {
    return `Rp ${sign}${(absVal / 1_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Jt`;
  }
  return formatRupiahFull(val);
}

export function formatNominalFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `-${formatted}` : formatted;
}
