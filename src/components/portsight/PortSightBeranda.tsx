'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Percent,
  FilterX,
  Search,
  Check,
  ChevronDown,
  ArrowRight,
  GitCompareArrows,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Lock,
  AlertCircle,
  X,
} from 'lucide-react';
import type { User, UserRole } from '@/lib/types';
import { CHART_METRIC_COLORS } from '@/lib/chartPalette';
import ChartInlineLegend from '@/components/ui/ChartInlineLegend';
import { getMonthNameId } from '@/lib/finansialHelpers';
import { formatBebanTriliun, formatRupiahFull } from '@/lib/formatters';
import {
  BERANDA_ENTITAS_COLORS,
  BERANDA_ENTITAS_ORDER,
  formatBerandaJuta,
  formatBerandaMiliar,
  formatBerandaSummaryRupiah,
  formatIdDecimal2,
  formatIdPercent2,
  type BerandaBopoBranchRow,
  type BerandaEntityShareRow,
  type BerandaPjmBottomRow,
  type BerandaStackedBranchRow,
} from '@/lib/berandaSummary';
import { useBerandaAnalytics } from '@/hooks/useBerandaAnalytics';

interface PortSightBerandaProps {
  selectedTerminal: string;
  selectedPeriod: string;
  onSelectTerminal: (terminalId: string) => void;
  onNavigateTab: (tabId: string, branchCode?: string) => void;
  onOpenDrilldown?: (item: Record<string, unknown>) => void;
  currentUser?: User | null;
  userRole: UserRole;
  onOpenComparisonModal?: () => void;
}

interface CustomTooltipPayloadItem<T> {
  payload?: T;
}

interface CustomTooltipProps<T> {
  active?: boolean;
  payload?: Array<CustomTooltipPayloadItem<T>>;
}

interface LabelRenderProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | boolean | null;
}

interface PieLabelRenderProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  payload?: BerandaEntityShareRow;
}

const RADIAN = Math.PI / 180;

function renderPieSliceLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
  payload,
}: PieLabelRenderProps) {
  if (!payload || percent < 0.03) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={800}
      style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
    >
      {`${payload.roundedPct}%`}
    </text>
  );
}

function renderPjmNegativeLabel(props: LabelRenderProps) {
  const num = Number(props.value ?? 0);
  if (!Number.isFinite(num)) return null;

  const rawX = Number(props.x ?? 0);
  const rawY = Number(props.y ?? 0);
  const rawWidth = Number(props.width ?? 0);
  const rawHeight = Number(props.height ?? 0);

  const barLeft = rawWidth < 0 ? rawX + rawWidth : rawX;
  const barRight = rawWidth < 0 ? rawX : rawX + rawWidth;
  const barWidthAbs = Math.abs(rawWidth);
  const cy = rawY + rawHeight / 2;
  const text = formatBerandaJuta(num);

  if (num >= 0) {
    if (barWidthAbs >= 88) {
      return (
        <text
          x={barRight - 6}
          y={cy}
          fill="#ffffff"
          textAnchor="end"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={700}
          style={{ pointerEvents: 'none' }}
        >
          {text}
        </text>
      );
    }
    return (
      <text
        x={barRight + 6}
        y={cy}
        fill="var(--text-main)"
        textAnchor="start"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={700}
        style={{ pointerEvents: 'none' }}
      >
        {text}
      </text>
    );
  }

  if (barWidthAbs >= 88) {
    return (
      <text
        x={barLeft + 6}
        y={cy}
        fill="#ffffff"
        textAnchor="start"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={700}
        style={{
          pointerEvents: 'none',
          fontFamily: 'var(--beranda-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {text}
      </text>
    );
  }

  return (
    <text
      x={barLeft - 6}
      y={cy}
      fill="var(--text-main)"
      textAnchor="end"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
      style={{
        pointerEvents: 'none',
        fontFamily: 'var(--beranda-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {text}
    </text>
  );
}

function BerandaSkeleton() {
  return (
    <div className="beranda-main-area" aria-busy="true" aria-label="Memuat data ringkasan eksekutif">
      <div className="beranda-kpi-grid">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="beranda-kpi-card">
            <div className="beranda-kpi-head">
              <div className="beranda-skeleton-block" style={{ width: 92, height: 12 }} />
              <div className="beranda-skeleton-block" style={{ width: 32, height: 32, borderRadius: 9 }} />
            </div>
            <div className="beranda-skeleton-block" style={{ width: '68%', height: 28, marginTop: 4 }} />
            <div className="beranda-skeleton-block" style={{ width: '54%', height: 12, marginTop: 4 }} />
          </div>
        ))}
      </div>

      <div className="beranda-charts-stack">
        <div className="beranda-charts-row-top">
          {[0, 1].map((idx) => (
            <div key={idx} className="beranda-chart-card">
              <div className="beranda-chart-head">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="beranda-skeleton-block" style={{ width: 180, height: 14 }} />
                  <div className="beranda-skeleton-block" style={{ width: 120, height: 10 }} />
                </div>
                <div className="beranda-skeleton-block" style={{ width: 64, height: 24 }} />
              </div>
              <div className="beranda-skeleton-block" style={{ width: '100%', height: 260 }} />
            </div>
          ))}
        </div>

        <div className="beranda-charts-row-bottom">
          {[300, 260, 280].map((h, idx) => (
            <div key={idx} className="beranda-chart-card">
              <div className="beranda-chart-head">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="beranda-skeleton-block" style={{ width: 150, height: 14 }} />
                  <div className="beranda-skeleton-block" style={{ width: 110, height: 10 }} />
                </div>
              </div>
              <div className="beranda-skeleton-block" style={{ width: '100%', height: h }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedBranchTooltip({
  active,
  payload,
  metricLabel,
}: CustomTooltipProps<BerandaStackedBranchRow> & { metricLabel: string }) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        minWidth: 200,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 4 }}>
        {row.nmCbg}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        {metricLabel} (Non-Eliminasi)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {BERANDA_ENTITAS_ORDER.map((ent) => (
          <div
            key={ent}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: BERANDA_ENTITAS_COLORS[ent],
                }}
              />
              {ent}
            </span>
            <span
              className="beranda-mono-num"
              style={{ fontWeight: 700, color: 'var(--text-main)' }}
            >
              {formatBerandaMiliar(row[ent])}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 4,
            paddingTop: 4,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 800,
            color: 'var(--text-title)',
          }}
        >
          <span>Total</span>
          <span className="beranda-mono-num">{formatBerandaMiliar(row.total)}</span>
        </div>
      </div>
    </div>
  );
}

function BopoTooltip({ active, payload }: CustomTooltipProps<BerandaBopoBranchRow>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        minWidth: 205,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 6 }}>
        {row.nmCbg}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>BOPO</span>
        <span className="beranda-mono-num" style={{ fontWeight: 800, color: 'var(--accent-blue-text)' }}>
          {formatIdPercent2(row.bopo)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>Pendapatan</span>
        <span className="beranda-mono-num" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          {formatBerandaSummaryRupiah(row.pendapatan)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>Beban</span>
        <span
          className="beranda-mono-num"
          style={{ fontWeight: 600, color: 'var(--text-secondary)' }}
          title={formatRupiahFull(row.beban)}
        >
          {formatBebanTriliun(row.beban)}
        </span>
      </div>
    </div>
  );
}

function EntityShareTooltip({ active, payload }: CustomTooltipProps<BerandaEntityShareRow>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 4 }}>
        {row.entitas}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Laba Bersih</span>
        <span className="beranda-mono-num" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatBerandaSummaryRupiah(row.totalRealisasi)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Kontribusi</span>
        <span className="beranda-mono-num" style={{ fontWeight: 700, color: 'var(--accent-blue-text)' }}>
          {formatIdPercent2(row.exactPct)} ({row.roundedPct}%)
        </span>
      </div>
    </div>
  );
}

function PjmBottomTooltip({ active, payload }: CustomTooltipProps<BerandaPjmBottomRow>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 4 }}>
        {row.nmCbg}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Laba Area PJM</span>
        <span className="beranda-mono-num" style={{ fontWeight: 800, color: 'var(--status-danger-text)' }}>
          {formatBerandaJuta(row.nilaiJt)}
        </span>
      </div>
    </div>
  );
}

function getMetricStatusColor(value: number | null, lowerIsBetter = false): string {
  if (value === null) return 'var(--text-muted)';
  const isFavorable = lowerIsBetter ? value <= 100 : value >= 100;
  return isFavorable ? 'var(--status-good-text)' : 'var(--status-danger-text)';
}

function KpiSubMetrics({
  yoy,
  rka,
  lowerIsBetter = false,
}: {
  yoy: number | null;
  rka: number | null;
  lowerIsBetter?: boolean;
}) {
  return (
    <div className="beranda-kpi-submetrics">
      <span>
        YoY{' '}
        <strong
          style={{
            color: getMetricStatusColor(yoy, lowerIsBetter),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {yoy !== null ? `${formatIdDecimal2(yoy)}%` : '-'}
        </strong>
      </span>
      <span aria-hidden="true" style={{ color: 'var(--border-subtle)' }}>•</span>
      <span>
        RKA{' '}
        <strong
          style={{
            color: getMetricStatusColor(rka, lowerIsBetter),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rka !== null ? `${formatIdDecimal2(rka)}%` : '-'}
        </strong>
      </span>
    </div>
  );
}

function getBopoBadge(bopoValue: number): {
  label: string;
  accent: string;
  textColor: string;
  bg: string;
  border: string;
} {
  if (bopoValue <= 75) {
    return {
      label: 'Efisien',
      accent: CHART_METRIC_COLORS.positive,
      textColor: 'var(--status-good-text)',
      bg: 'rgba(22, 163, 74, 0.14)',
      border: 'rgba(22, 163, 74, 0.35)',
    };
  }
  if (bopoValue <= 85) {
    return {
      label: 'Moderat',
      accent: CHART_METRIC_COLORS.warning,
      textColor: 'var(--status-alert-text)',
      bg: 'rgba(202, 138, 4, 0.15)',
      border: 'rgba(202, 138, 4, 0.35)',
    };
  }
  return {
    label: 'Waspada',
    accent: CHART_METRIC_COLORS.negative,
    textColor: 'var(--status-danger-text)',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.35)',
  };
}

export default function PortSightBeranda({
  selectedTerminal,
  onSelectTerminal,
  onNavigateTab,
  currentUser,
  userRole,
  onOpenComparisonModal,
}: PortSightBerandaProps) {
  const {
    tahun,
    bulan,
    selectedBranches,
    verifiedOnly,
    isBodViewer,
    isPicCabang,
    loading,
    refreshing,
    error,
    summary,
    setTahun,
    setBulan,
    toggleBranch,
    clearBranches,
    setVerifiedOnly,
    resetFilters,
    refresh,
  } = useBerandaAnalytics({
    selectedTerminal,
    currentUser,
    userRole,
    onSelectTerminal,
  });

  const [branchSearch, setBranchSearch] = useState<string>('');
  const [branchMenuOpen, setBranchMenuOpen] = useState<boolean>(false);
  const branchPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!branchMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (branchPopoverRef.current && !branchPopoverRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBranchMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [branchMenuOpen]);

  const availableYears = useMemo(
    () => summary?.filters.availableYears ?? [2025, 2026],
    [summary]
  );
  const availableMonths = useMemo(
    () => summary?.filters.availableMonths ?? [8, 9],
    [summary]
  );
  const availableBranches = useMemo(
    () => summary?.filters.availableBranches ?? [],
    [summary]
  );

  const filteredBranchOptions = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return availableBranches;
    return availableBranches.filter((b) => b.nmCbg.toLowerCase().includes(q));
  }, [availableBranches, branchSearch]);

  const activeBranchNames = summary?.filters.selectedBranches ?? selectedBranches;
  const activeBranchLabel = useMemo(() => {
    if (isPicCabang) {
      return summary?.filters.assignedBranchName || 'Cabang Anda';
    }
    if (activeBranchNames.length === 0 || activeBranchNames.length >= availableBranches.length) {
      return `Semua Cabang (${availableBranches.length})`;
    }
    if (activeBranchNames.length <= 2) {
      return activeBranchNames.join(', ');
    }
    return `${activeBranchNames.length} Cabang Dipilih`;
  }, [isPicCabang, summary?.filters.assignedBranchName, activeBranchNames, availableBranches.length]);

  const bopoRows = useMemo(
    () =>
      [...(summary?.charts.bopoPerCabang ?? [])].sort(
        (a, b) => a.bopo - b.bopo || a.nmCbg.localeCompare(b.nmCbg)
      ),
    [summary]
  );
  const maxBopo = useMemo(() => {
    let max = 100;
    for (const row of bopoRows) {
      if (row.bopo > max) max = row.bopo;
    }
    return Math.ceil(max / 10) * 10;
  }, [bopoRows]);

  const bopoChartHeight = Math.max(260, bopoRows.length * 23 + 20);

  const pjmRows = useMemo(
    () =>
      [...(summary?.charts.bottom10LabaPjm ?? [])].sort(
        (a, b) => a.realisasi - b.realisasi || a.nmCbg.localeCompare(b.nmCbg)
      ),
    [summary]
  );
  const pjmDomain = useMemo<[number, number]>(() => {
    if (pjmRows.length === 0) return [-1000, 0];
    let min = 0;
    let max = 0;
    for (const row of pjmRows) {
      if (row.nilaiJt < min) min = row.nilaiJt;
      if (row.nilaiJt > max) max = row.nilaiJt;
    }
    if (min === 0 && max === 0) return [-100, 0];
    return [min < 0 ? min * 1.08 : 0, max > 0 ? max * 1.15 : 0];
  }, [pjmRows]);

  const kpis = summary?.kpis;
  const top10Laba = useMemo(
    () => summary?.charts.top10LabaArea ?? [],
    [summary]
  );
  const top10Pendapatan = useMemo(
    () => summary?.charts.top10PendapatanArea ?? [],
    [summary]
  );
  const entityShare = useMemo(
    () => summary?.charts.kontribusiLabaEntitas ?? [],
    [summary]
  );
  const hasPositiveEntityShare = useMemo(
    () => entityShare.some((item) => item.sliceValue > 0),
    [entityShare]
  );

  const labaIsNegative = (kpis?.labaArea.value ?? 0) < 0;
  const bopoBadge = getBopoBadge(kpis?.bopo.value ?? 0);

  return (
    <div className="beranda-shell">
      {/* Unified Horizontal Executive Filter Bar */}
      <section
        className="beranda-filter-bar"
        aria-label="Filter Summary Eksekutif"
        style={{ position: 'relative', zIndex: 20, marginBottom: '8px' }}
      >
        <div className="beranda-filter-row">
          {/* Left: Period & Branch Selectors */}
          <div className="beranda-filter-controls">
            <label className="beranda-select-field">
              <span className="beranda-field-label">Tahun</span>
              <select
                value={tahun}
                onChange={(e) => setTahun(Number(e.target.value))}
                className="beranda-select"
                aria-label="Pilih Tahun"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </label>

            <label className="beranda-select-field">
              <span className="beranda-field-label">Bulan</span>
              <select
                value={bulan}
                onChange={(e) => setBulan(Number(e.target.value))}
                className="beranda-select"
                aria-label="Pilih Bulan"
              >
                {availableMonths.map((mo) => (
                  <option key={mo} value={mo}>
                    {getMonthNameId(mo)} ({mo})
                  </option>
                ))}
              </select>
            </label>

            {/* Searchable Multi-Select Branch Dropdown */}
            <div ref={branchPopoverRef} style={{ position: 'relative' }}>
              {isPicCabang ? (
                <span className="beranda-locked-branch" title="Akses dibatasi sesuai cabang penugasan">
                  <Lock size={12} aria-hidden="true" />
                  <span>{activeBranchLabel}</span>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setBranchMenuOpen((prev) => !prev)}
                    className={`beranda-branch-trigger ${branchMenuOpen ? 'active' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={branchMenuOpen}
                  >
                    <span className="beranda-field-label">Cabang</span>
                    <strong className="beranda-branch-trigger-val">{activeBranchLabel}</strong>
                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                      style={{
                        color: 'var(--text-muted)',
                        transform: branchMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {branchMenuOpen && (
                    <div className="beranda-branch-popover" role="dialog" aria-label="Pilih Cabang atau Terminal">
                      <div className="beranda-branch-popover-head">
                        <span>Cabang / Terminal</span>
                        {selectedBranches.length > 0 && (
                          <button
                            type="button"
                            onClick={clearBranches}
                            className="beranda-clear-btn"
                          >
                            <FilterX size={11} aria-hidden="true" /> Reset Cabang
                          </button>
                        )}
                      </div>

                      {availableBranches.length > 5 && (
                        <div style={{ position: 'relative', padding: '8px 8px 4px' }}>
                          <Search
                            size={12}
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              left: 17,
                              top: 16,
                              color: 'var(--text-muted)',
                              pointerEvents: 'none',
                            }}
                          />
                          <input
                            type="text"
                            value={branchSearch}
                            onChange={(e) => setBranchSearch(e.target.value)}
                            placeholder="Cari cabang..."
                            aria-label="Cari nama cabang"
                            className="beranda-branch-search"
                          />
                        </div>
                      )}

                      <div className="beranda-slicer-list beranda-slicer-scroll" role="listbox" aria-multiselectable="true">
                        <button
                          type="button"
                          onClick={() => {
                            clearBranches();
                            setBranchMenuOpen(false);
                          }}
                          className={`beranda-slicer-btn ${selectedBranches.length === 0 ? 'is-active' : ''}`}
                        >
                          <span>Semua Cabang ({availableBranches.length})</span>
                          {selectedBranches.length === 0 && <Check size={13} color="var(--accent-blue-text)" aria-hidden="true" />}
                        </button>

                        {filteredBranchOptions.map((opt) => {
                          const isSelected = selectedBranches.includes(opt.nmCbg);
                          return (
                            <button
                              key={opt.nmCbg}
                              type="button"
                              onClick={() => toggleBranch(opt.nmCbg)}
                              className={`beranda-slicer-btn ${isSelected ? 'is-active' : ''}`}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {opt.nmCbg}
                              </span>
                              {isSelected && <Check size={13} color="var(--accent-blue-text)" aria-hidden="true" />}
                            </button>
                          );
                        })}

                        {filteredBranchOptions.length === 0 && (
                          <div style={{ padding: 12, textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                            Cabang tidak ditemukan
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Verification Scope, Comparison, Reset & Refresh */}
          <div className="beranda-filter-actions">
            {!isBodViewer && summary?.verificationSummary && (
              <button
                type="button"
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className={`beranda-tool-btn ${verifiedOnly ? 'is-verified' : ''}`}
                title="Filter khusus data berstatus terverifikasi"
              >
                {verifiedOnly ? (
                  <span className="beranda-live-dot" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={13} aria-hidden="true" />
                )}
                <span>{verifiedOnly ? 'Terverifikasi' : 'Semua Status'}</span>
                {summary.verificationSummary.pending > 0 && (
                  <span className="beranda-mono-num" style={{ opacity: 0.85 }}>
                    ({summary.verificationSummary.pending})
                  </span>
                )}
              </button>
            )}

            {onOpenComparisonModal && (
              <button
                type="button"
                onClick={onOpenComparisonModal}
                className="beranda-tool-btn"
                title="Bandingkan Realisasi 2026 vs RKAP & 2025 YoY"
              >
                <GitCompareArrows size={13} aria-hidden="true" />
                <span>Bandingkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="beranda-tool-btn"
              title="Kembalikan filter ke default"
              aria-label="Reset filter ke default"
            >
              <RotateCcw size={13} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="beranda-tool-btn"
              title="Muat ulang data Summary"
              aria-label="Muat ulang data Summary"
              style={{ cursor: refreshing ? 'wait' : 'pointer' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Selected Branch Chips */}
        {!isPicCabang && selectedBranches.length > 0 && (
          <div className="beranda-active-chips">
            <span className="beranda-chips-label">Filter Cabang:</span>
            {selectedBranches.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleBranch(name)}
                className="beranda-filter-chip"
                title={`Hapus filter ${name}`}
              >
                <span>{name}</span>
                <X size={11} aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={clearBranches} className="beranda-clear-btn">
              Hapus Semua
            </button>
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="beranda-error-banner">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={refresh} className="beranda-drill-btn">
            Muat Ulang
          </button>
        </div>
      )}

      {/* Main Executive Dashboard Area (Full Width) */}
      {loading && !summary ? (
        <BerandaSkeleton />
      ) : (
      <div
        className={`beranda-main-area ${loading || refreshing ? 'is-updating' : ''}`}
        style={{ position: 'relative', zIndex: 10, marginTop: '4px' }}
      >
        {/* TOP 4 HARMONIZED KPI CARDS */}
        <section
          className="beranda-kpi-grid"
          aria-label="KPI Keuangan Utama"
          style={{ position: 'relative', zIndex: 10 }}
        >
            {/* 1. Pendapatan (Harbor Cobalt accent hairline) */}
            <div className="beranda-kpi-card" style={{ borderTop: '2px solid var(--beranda-accent)' }}>
              <div className="beranda-kpi-head">
                <span className="beranda-kpi-label">Pendapatan</span>
                <span
                  className="beranda-kpi-icon"
                  style={{ backgroundColor: 'var(--beranda-accent-soft)', color: 'var(--beranda-accent)' }}
                >
                  <TrendingUp size={17} aria-hidden="true" />
                </span>
              </div>
              <div className="beranda-kpi-value" style={{ color: 'var(--beranda-accent)' }}>
                {kpis?.pendapatan.formatted ?? 'Rp 0'}
              </div>
              <KpiSubMetrics
                yoy={kpis?.pendapatan.yoy ?? null}
                rka={kpis?.pendapatan.rka ?? null}
              />
            </div>

            {/* 2. Laba Area (Hijau — atau Merah jika negatif) */}
            <div
              className="beranda-kpi-card"
              style={{
                borderTop: `2px solid ${labaIsNegative ? CHART_METRIC_COLORS.negative : CHART_METRIC_COLORS.positive}`,
              }}
            >
              <div className="beranda-kpi-head">
                <span className="beranda-kpi-label">Laba Area</span>
                <span
                  className="beranda-kpi-icon"
                  style={{
                    backgroundColor: labaIsNegative ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                    color: labaIsNegative ? 'var(--status-danger-text)' : 'var(--status-good-text)',
                  }}
                >
                  <Banknote size={17} aria-hidden="true" />
                </span>
              </div>
              <div
                className="beranda-kpi-value"
                style={{ color: labaIsNegative ? 'var(--status-danger-text)' : 'var(--status-good-text)' }}
              >
                {kpis?.labaArea.formatted ?? 'Rp 0'}
              </div>
              <KpiSubMetrics
                yoy={kpis?.labaArea.yoy ?? null}
                rka={kpis?.labaArea.rka ?? null}
              />
            </div>

            {/* 3. Beban (Merah — lower is better untuk RKA/YoY) */}
            <div className="beranda-kpi-card" style={{ borderTop: `2px solid ${CHART_METRIC_COLORS.negative}` }}>
              <div className="beranda-kpi-head">
                <span className="beranda-kpi-label">Beban</span>
                <span
                  className="beranda-kpi-icon"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--status-danger-text)' }}
                >
                  <TrendingDown size={17} aria-hidden="true" />
                </span>
              </div>
              <div
                className="beranda-kpi-value"
                style={{ color: 'var(--status-danger-text)' }}
                title={
                  kpis
                    ? `${formatBebanTriliun(kpis.beban.value, { includeCurrency: false })} (${formatRupiahFull(kpis.beban.value)})`
                    : 'Rp 0,00 T'
                }
              >
                {kpis?.beban.formatted ?? 'Rp 0,00 T'}
              </div>
              <KpiSubMetrics
                yoy={kpis?.beban.yoy ?? null}
                rka={kpis?.beban.rka ?? null}
                lowerIsBetter
              />
            </div>

            {/* 4. BOPO (Seragam, dengan badge status efisiensi) */}
            <div className="beranda-kpi-card" style={{ borderTop: `2px solid ${bopoBadge.accent}` }}>
              <div className="beranda-kpi-head">
                <span className="beranda-kpi-label">BOPO</span>
                <span
                  className="beranda-kpi-badge"
                  style={{
                    backgroundColor: bopoBadge.bg,
                    border: `1px solid ${bopoBadge.border}`,
                    color: bopoBadge.textColor,
                  }}
                >
                  <Percent size={11} aria-hidden="true" />
                  <span>{bopoBadge.label}</span>
                </span>
              </div>
              <div className="beranda-kpi-value" style={{ color: 'var(--text-title)' }}>
                {kpis?.bopo.formatted ?? '0,00%'}
              </div>
              <div className="beranda-kpi-submetrics">
                <span>Beban / Pendapatan Area</span>
                <span aria-hidden="true" style={{ color: 'var(--border-subtle)' }}>•</span>
                <span>Target ≤ 75%</span>
              </div>
            </div>
          </section>

        {/* BALANCED 2-ROW EXECUTIVE BENTO GRID */}
        <section className="beranda-charts-stack" aria-label="Grafik Ringkasan Keuangan">
            {/* ROW 1: Top 10 Laba Area & Top 10 Pendapatan Area (Side-by-Side 1fr : 1fr) */}
            <div className="beranda-charts-row-top">
              {/* Grafik 1: 10 Cabang Terbesar Laba Area */}
              <div className="beranda-chart-card">
                <div className="beranda-chart-head">
                  <div>
                    <h2 className="beranda-chart-title">10 Cabang Terbesar Laba Area</h2>
                    <span className="beranda-chart-unit">Dalam Miliar Rupiah (Rp)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('keuangan')}
                    className="beranda-drill-btn"
                    title="Buka rincian modul Keuangan"
                  >
                    <span>Detail</span>
                    <ArrowRight size={12} aria-hidden="true" />
                  </button>
                </div>

                <div style={{ width: '100%', height: 265 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={top10Laba}
                      stackOffset="sign"
                      margin={{ top: 6, right: 16, left: 4, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--border-subtle)"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => formatIdDecimal2(Number(val))}
                        tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        width={126}
                        interval={0}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine x={0} stroke="var(--text-muted)" strokeOpacity={0.45} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                        content={<StackedBranchTooltip metricLabel="Laba Area" />}
                      />
                      {BERANDA_ENTITAS_ORDER.map((ent) => (
                        <Bar
                          key={ent}
                          dataKey={ent}
                          stackId="laba"
                          fill={BERANDA_ENTITAS_COLORS[ent]}
                          barSize={14}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ChartInlineLegend
                  compact
                  items={BERANDA_ENTITAS_ORDER.map((ent) => ({
                    label: ent,
                    color: BERANDA_ENTITAS_COLORS[ent],
                  }))}
                />
              </div>

              {/* Grafik 2: 10 Cabang Terbesar Pendapatan Area */}
              <div className="beranda-chart-card">
                <div className="beranda-chart-head">
                  <div>
                    <h2 className="beranda-chart-title">10 Cabang Terbesar Pendapatan Area</h2>
                    <span className="beranda-chart-unit">Dalam Miliar Rupiah (Rp)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('keuangan')}
                    className="beranda-drill-btn"
                    title="Buka rincian modul Keuangan"
                  >
                    <span>Detail</span>
                    <ArrowRight size={12} aria-hidden="true" />
                  </button>
                </div>

                <div style={{ width: '100%', height: 265 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={top10Pendapatan}
                      stackOffset="sign"
                      margin={{ top: 6, right: 16, left: 4, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--border-subtle)"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => formatIdDecimal2(Number(val))}
                        tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        width={126}
                        interval={0}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                        content={<StackedBranchTooltip metricLabel="Pendapatan Area" />}
                      />
                      {BERANDA_ENTITAS_ORDER.map((ent) => (
                        <Bar
                          key={ent}
                          dataKey={ent}
                          stackId="pendapatan"
                          fill={BERANDA_ENTITAS_COLORS[ent]}
                          barSize={14}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ChartInlineLegend
                  compact
                  items={BERANDA_ENTITAS_ORDER.map((ent) => ({
                    label: ent,
                    color: BERANDA_ENTITAS_COLORS[ent],
                  }))}
                />
              </div>
            </div>

            {/* ROW 2: BOPO Area per Cabang (All Branches, Scrollable, Ascending) | Donut | PJM */}
            <div className="beranda-charts-row-bottom">
              {/* Grafik 3: BOPO Area per Cabang */}
              <div className="beranda-chart-card">
                <div className="beranda-chart-head">
                  <div>
                    <h2 className="beranda-chart-title">BOPO Area per Cabang</h2>
                    <span className="beranda-chart-unit">
                      Seluruh Cabang ({bopoRows.length}) • Urutan Terendah ke Tertinggi (%)
                    </span>
                  </div>
                </div>

                <div className="beranda-bopo-scroll" tabIndex={0} aria-label="Grafik BOPO Area per Cabang">
                  <div style={{ width: '100%', height: bopoChartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={bopoRows}
                        margin={{ top: 4, right: 54, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="var(--border-subtle)"
                        />
                        <XAxis type="number" domain={[0, maxBopo]} hide />
                        <YAxis
                          type="category"
                          dataKey="nmCbg"
                          width={120}
                          interval={0}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                          content={<BopoTooltip />}
                        />
                        <Bar
                          dataKey="bopo"
                          fill={CHART_METRIC_COLORS.primary}
                          radius={[0, 4, 4, 0]}
                          barSize={14}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="bopo"
                            position="right"
                            formatter={(val) => formatIdPercent2(Number(val ?? 0))}
                            style={{
                              fill: 'var(--text-main)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              fontFamily: 'var(--beranda-mono)',
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Grafik 4: Kontribusi Laba Area per Entitas (Donut + Center Metric) */}
              <div className="beranda-chart-card">
                <div className="beranda-chart-head">
                  <div>
                    <h2 className="beranda-chart-title">Kontribusi Laba per Entitas</h2>
                    <span className="beranda-chart-unit">Proporsi Laba Area (%)</span>
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', height: 228 }}>
                  {hasPositiveEntityShare ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={entityShare}
                            dataKey="sliceValue"
                            nameKey="entitas"
                            cx="50%"
                            cy="50%"
                            startAngle={90}
                            endAngle={-270}
                            innerRadius={52}
                            outerRadius={86}
                            paddingAngle={1.5}
                            labelLine={false}
                            label={renderPieSliceLabel}
                            isAnimationActive={false}
                          >
                            {entityShare.map((entry) => (
                              <Cell
                                key={entry.entitas}
                                fill={BERANDA_ENTITAS_COLORS[entry.entitas]}
                                stroke="var(--bg-card)"
                                strokeWidth={1.5}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<EntityShareTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="beranda-donut-center" aria-hidden="true">
                        <span className="beranda-donut-center-label">Total Laba</span>
                        <strong className="beranda-donut-center-val">
                          {kpis?.labaArea.formatted ?? 'Rp 0'}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <div className="beranda-empty-state">
                      <svg
                        width="44"
                        height="44"
                        viewBox="0 0 44 44"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="22"
                          cy="22"
                          r="17"
                          stroke="var(--border-subtle)"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="8"
                          stroke="var(--text-muted)"
                          strokeWidth="1.75"
                        />
                      </svg>
                      <p>Tidak ada kontribusi laba positif pada filter cabang aktif.</p>
                      {!isPicCabang && selectedBranches.length > 0 && (
                        <button type="button" onClick={clearBranches} className="beranda-drill-btn">
                          Reset Filter Cabang
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <ChartInlineLegend
                  compact
                  items={entityShare.map((entry) => ({
                    label: entry.entitas,
                    color: BERANDA_ENTITAS_COLORS[entry.entitas],
                    meta: `(${entry.roundedPct}%)`,
                  }))}
                />
              </div>

              {/* Grafik 5: 10 Cabang Terendah Laba Area PJM */}
              <div className="beranda-chart-card">
                <div className="beranda-chart-head">
                  <div>
                    <h2 className="beranda-chart-title">10 Cabang Terendah Laba PJM</h2>
                    <span className="beranda-chart-unit">
                      Dalam Juta Rupiah (Rp) • Urutan Terendah di Atas
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={pjmRows}
                      margin={{ top: 6, right: 6, left: 86, bottom: 10 }}
                    >
                      <XAxis type="number" domain={pjmDomain} hide />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        orientation="right"
                        width={96}
                        interval={0}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                        content={<PjmBottomTooltip />}
                      />
                      <Bar
                        dataKey="nilaiJt"
                        fill={CHART_METRIC_COLORS.negative}
                        radius={[4, 0, 0, 4]}
                        barSize={16}
                        isAnimationActive={false}
                      >
                        <LabelList dataKey="nilaiJt" content={renderPjmNegativeLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>
      </div>
      )}
    </div>
  );
}
