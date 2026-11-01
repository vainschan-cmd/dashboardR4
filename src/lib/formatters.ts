/**
 * Utility formatter untuk tampilan nilai Rupiah dan Nominal numerik penuh
 * Sesuai format spreadsheet Google Drive (input_data.xlsx):
 * - Menampilkan besaran nominal penuh (full value) tanpa singkatan Miliar (M) / Juta (Jt).
 * - Menggunakan pemisah ribuan titik (.) sesuai standar Indonesia (misal: 170.176.612.011).
 */

export function formatRupiahFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  // Standard id-ID locale uses dot '.' for thousands separator
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `Rp -${formatted}` : `Rp ${formatted}`;
}

export function formatNominalFull(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const formatted = absVal.toLocaleString('id-ID');
  return isNegative ? `-${formatted}` : formatted;
}
