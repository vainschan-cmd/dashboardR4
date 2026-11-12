export const BERANDA_ENTITAS_ORDER = ['CABANG', 'PJM', 'PMT', 'PSL', 'PTP'] as const;

export type BerandaEntityKey = (typeof BERANDA_ENTITAS_ORDER)[number];

export const BERANDA_ENTITAS_COLORS: Record<BerandaEntityKey, string> = {
  CABANG: '#4472c4',
  PJM: '#ed7d31',
  PMT: '#a5a5a5',
  PSL: '#ffc000',
  PTP: '#70ad47',
};

export interface BerandaBranchOption {
  branchCode: string;
  nmCbg: string;
}

export interface BerandaKpiMetric {
  value: number;
  formatted: string;
  yoy: number | null;
  rka: number | null;
}

export interface BerandaSummaryKpis {
  labaArea: BerandaKpiMetric;
  pendapatan: BerandaKpiMetric;
  beban: BerandaKpiMetric;
  bopo: {
    value: number;
    formatted: string;
  };
}

export interface BerandaStackedBranchRow {
  nmCbg: string;
  branchCode: string;
  CABANG: number;
  PJM: number;
  PMT: number;
  PSL: number;
  PTP: number;
  total: number;
}

export interface BerandaBopoBranchRow {
  nmCbg: string;
  branchCode: string;
  bopo: number;
  pendapatan: number;
  beban: number;
}

export interface BerandaEntityShareRow {
  entitas: BerandaEntityKey;
  totalRealisasi: number;
  sliceValue: number;
  exactPct: number;
  roundedPct: number;
}

export interface BerandaPjmBottomRow {
  nmCbg: string;
  branchCode: string;
  realisasi: number;
  nilaiJt: number;
}

export interface BerandaSummaryResponse {
  success: boolean;
  filters: {
    tahun: number;
    bulan: number;
    selectedBranches: string[];
    availableYears: number[];
    availableMonths: number[];
    availableBranches: BerandaBranchOption[];
    verifiedOnly: boolean;
    isPicCabang: boolean;
    assignedBranchName: string | null;
  };
  verificationSummary: {
    verified: number;
    pending: number;
    revision: number;
  };
  kpis: BerandaSummaryKpis;
  charts: {
    top10LabaArea: BerandaStackedBranchRow[];
    top10PendapatanArea: BerandaStackedBranchRow[];
    bopoPerCabang: BerandaBopoBranchRow[];
    kontribusiLabaEntitas: BerandaEntityShareRow[];
    bottom10LabaPjm: BerandaPjmBottomRow[];
  };
}

export function formatIdDecimal2(val: number): string {
  const safe = Number.isFinite(val) ? (Math.abs(val) < 0.005 ? 0 : val) : 0;
  return safe.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatIdPercent2(val: number): string {
  return `${formatIdDecimal2(val)}%`;
}

export function formatBerandaSummaryRupiah(val: number): string {
  const safe = Number.isFinite(val) ? (Math.abs(val) < 0.005 ? 0 : val) : 0;
  const abs = Math.abs(safe);
  const prefix = safe < 0 ? '- Rp ' : 'Rp ';
  if (abs >= 1e12) {
    return `${prefix}${formatIdDecimal2(abs / 1e12)} T`;
  }
  if (abs >= 1e9) {
    return `${prefix}${formatIdDecimal2(abs / 1e9)} M`;
  }
  if (abs >= 1e6) {
    return `${prefix}${formatIdDecimal2(abs / 1e6)} Jt`;
  }
  return `${prefix}${Math.round(abs).toLocaleString('id-ID')}`;
}

export function formatBerandaJuta(valJt: number): string {
  return `${formatIdDecimal2(valJt)} Jt`;
}

export function formatBerandaMiliar(valM: number): string {
  return `Rp ${formatIdDecimal2(valM)} M`;
}

