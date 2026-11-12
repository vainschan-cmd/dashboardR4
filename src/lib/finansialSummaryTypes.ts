import type { FinansialRecord, FinansialRekening } from '@/lib/types';

export interface FinansialConsolidatedAccountMetric {
  realisasi: number;
  formatted: string;
  formattedFull: string;
  rka: number | null;
  yoy: number | null;
  rowCount: number;
}

export interface FinansialConsolidatedKpis {
  pendapatan: FinansialConsolidatedAccountMetric;
  beban: FinansialConsolidatedAccountMetric;
  labaUsaha: FinansialConsolidatedAccountMetric;
  labaBersih: FinansialConsolidatedAccountMetric;
  bopo: {
    value: number;
    formatted: string;
  };
  isConsolidation: boolean;
  verificationSummary: {
    verified: number;
    pending: number;
    revision: number;
  };
}

export interface FinansialPeriodTrendPoint {
  periode: string;
  PendapatanM: number;
  BebanM: number;
  LabaUsahaM: number;
  LabaBersihM: number;
  pendapatanRp: number;
  bebanRp: number;
  labaUsahaRp: number;
  labaBersihRp: number;
}

export interface FinansialEntityBreakdownPoint {
  entitas: string;
  PendapatanM: number;
  BebanM: number;
  LabaUsahaM: number;
  pendapatanRp: number;
  bebanRp: number;
  labaUsahaRp: number;
}

export interface FinansialTopBranchPoint {
  kode: string;
  name: string;
  fullName: string;
  PendapatanM: number;
  LabaUsahaM: number;
  pendapatanRp: number;
  labaUsahaRp: number;
  rkaLabel: string;
  yoyLabel: string;
}

export interface FinansialModuleBranchOption {
  kode: string;
  nama: string;
}

export interface FinansialModuleSummaryResponse {
  success: boolean;
  filters: {
    tahun: number | 'ALL';
    bulan: number | 'ALL';
    entitas: string;
    nmCbg: string;
    rekening: FinansialRekening | 'ALL';
    availableYears: number[];
    availableMonths: number[];
    availableEntitas: string[];
    availableBranches: FinansialModuleBranchOption[];
    verifiedOnly: boolean;
    isPicCabang: boolean;
    assignedBranchName: string | null;
    totalDatasetRows: number;
  };
  kpis: FinansialConsolidatedKpis;
  charts: {
    periodTrend: FinansialPeriodTrendPoint[];
    entityBreakdown: FinansialEntityBreakdownPoint[];
    topBranches: FinansialTopBranchPoint[];
  };
  rows: FinansialRecord[];
}

