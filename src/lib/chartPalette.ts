/**
 * Single source of truth for chart series and legend colors across PortSight.
 *
 * Entity palette (consistent across Beranda, Konsolidasi, Keuangan, & Peralatan):
 * - CABANG: Biru (#2563eb)
 * - PJM:    Hijau (#16a34a)
 * - PMT:    Abu-abu (#94a3b8)
 * - PSL:    Kuning tua (#ca8a04)
 * - PTP:    Orange (#f97316)
 */

export const ENTITY_CHART_COLORS = {
  CABANG: '#2563eb', // Biru
  PJM: '#16a34a',    // Hijau
  PMT: '#94a3b8',    // Abu-abu
  PSL: '#ca8a04',    // Kuning tua
  PTP: '#f97316',    // Orange
} as const;

export const CHART_METRIC_COLORS = {
  primary: '#2563eb',   // Biru (Pendapatan / BOR / TSD / BSH / Realisasi Aktif)
  positive: '#16a34a',  // Hijau (Laba Usaha / YOR / TGH)
  neutral: '#94a3b8',   // Abu-abu (Realisasi Tahun Sebelumnya / Baseline)
  warning: '#ca8a04',   // Kuning tua (Target RKAP / SOR / WTP)
  accent: '#f97316',    // Orange (Volume / BCH)
  negative: '#ef4444',  // Merah (Beban / Defisit)
} as const;

export const COMMODITY_CHART_COLORS: Record<string, string> = {
  KAPAL: '#2563eb',     // Biru
  BARANG: '#16a34a',    // Hijau
  'RUPA-RUPA': '#94a3b8', // Abu-abu
  PETIKEMAS: '#ca8a04', // Kuning tua
  PENUMPANG: '#f97316', // Orange
};

export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'var(--bg-dropdown)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  color: 'var(--text-main)',
  fontSize: '12px',
} as const;
