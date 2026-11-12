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

/**
 * Format khusus metrik Beban agar selalu ditampilkan dalam satuan Triliun (T)
 * dengan pembulatan besaran ke atas (ROUNDUP 2 desimal menjauhi 0),
 * meskipun nominal berada di bawah 1 Triliun (contoh: -293.827.270.311 -> - Rp 0,30 T / -0,30 T).
 */
export function formatBebanTriliun(
  nominal: number | null | undefined,
  options?: { includeCurrency?: boolean }
): string {
  const includeCurrency = options?.includeCurrency ?? true;
  if (
    nominal === null ||
    nominal === undefined ||
    !Number.isFinite(nominal) ||
    Math.abs(nominal) < 0.5
  ) {
    return includeCurrency ? 'Rp 0,00 T' : '0,00 T';
  }

  // Pembulatan besaran ke atas pada kelipatan 0,01 T (10 Miliar) menghindari noise IEEE 754
  const scaled = Math.abs(nominal) / 10_000_000_000;
  const floored = Math.floor(scaled);
  const absUnits = scaled - floored <= 1e-11 ? floored : Math.ceil(scaled);
  const absRounded = absUnits / 100;
  const isNegative = nominal < 0 && absRounded > 0;
  const formattedNumber = absRounded.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (includeCurrency) {
    return isNegative ? `- Rp ${formattedNumber} T` : `Rp ${formattedNumber} T`;
  }
  return isNegative ? `-${formattedNumber} T` : `${formattedNumber} T`;
}

export function formatNominalFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `-${formatted}` : formatted;
}
