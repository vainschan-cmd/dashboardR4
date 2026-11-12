'use client';

import React, { useMemo, useState } from 'react';
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
  Coins,
  FilterX,
  Search,
  Check,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Lock,
  AlertCircle,
} from 'lucide-react';
import type { User, UserRole } from '@/lib/types';
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
  comparisonMode?: string;
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
        style={{ pointerEvents: 'none' }}
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
      style={{ pointerEvents: 'none' }}
    >
      {text}
    </text>
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
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
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
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBerandaMiliar(row.total)}</span>
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
        <span style={{ fontWeight: 800, color: 'var(--accent-blue-text)' }}>{formatIdPercent2(row.bopo)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>Pendapatan</span>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          {formatBerandaSummaryRupiah(row.pendapatan)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>Beban</span>
        <span
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
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatBerandaSummaryRupiah(row.totalRealisasi)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Kontribusi</span>
        <span style={{ fontWeight: 700, color: 'var(--accent-blue-text)' }}>
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
        <span style={{ fontWeight: 800, color: 'var(--status-danger-text)' }}>{formatBerandaJuta(row.nilaiJt)}</span>
      </div>
    </div>
  );
}

function KpiSubMetrics({ yoy, rka }: { yoy: number | null; rka: number | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-muted)',
        marginTop: 2,
      }}
    >
      <span>
        YoY:{' '}
        <span style={{ color: 'var(--status-good-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {yoy !== null ? formatIdDecimal2(yoy) : '-'}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: 'var(--border-subtle)' }}>|</span>
      <span>
        RKA:{' '}
        <span style={{ color: 'var(--status-danger-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {rka !== null ? formatIdDecimal2(rka) : '-'}
        </span>
      </span>
    </div>
  );
}

export default function PortSightBeranda({
  selectedTerminal,
  onSelectTerminal,
  currentUser,
  userRole,
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
    () => summary?.charts.bopoPerCabang ?? [],
    [summary]
  );
  const maxBopo = useMemo(() => {
    let max = 100;
    for (const row of bopoRows) {
      if (row.bopo > max) max = row.bopo;
    }
    return Math.ceil(max / 10) * 10;
  }, [bopoRows]);

  const bopoChartHeight = Math.max(240, bopoRows.length * 22 + 24);

  const pjmRows = useMemo(
    () => summary?.charts.bottom10LabaPjm ?? [],
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Status & Context Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text-title)',
            }}
          >
            Summary Keuangan Regional 4
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: 'rgba(59, 130, 246, 0.14)',
              color: 'var(--accent-blue-text)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            Tahun {summary?.filters.tahun ?? tahun} • Bulan {summary?.filters.bulan ?? bulan} (
            {getMonthNameId(summary?.filters.bulan ?? bulan)})
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: 'var(--bg-inner)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {activeBranchLabel}
          </span>
          {isPicCabang && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 9px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--status-alert-text)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
              }}
            >
              <Lock size={11} /> Akses Terbatas Cabang
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {!isBodViewer && summary?.verificationSummary && (
            <button
              type="button"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                border: verifiedOnly
                  ? '1px solid rgba(16, 185, 129, 0.45)'
                  : '1px solid var(--border-subtle)',
                backgroundColor: verifiedOnly ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-inner)',
                color: verifiedOnly ? 'var(--status-good-text)' : 'var(--text-secondary)',
              }}
              title="Filter khusus data berstatus terverifikasi"
            >
              <ShieldCheck size={13} />
              {verifiedOnly ? 'Hanya Terverifikasi' : 'Semua Status'}
              {summary.verificationSummary.pending > 0 && (
                <span style={{ opacity: 0.8 }}>({summary.verificationSummary.pending} pending)</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={resetFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-inner)',
              color: 'var(--text-secondary)',
            }}
          >
            <RotateCcw size={12} /> Reset Default
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: refreshing ? 'wait' : 'pointer',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-inner)',
              color: 'var(--text-title)',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Muat Ulang
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 10,
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Grid: Left Slicers + Right Dashboard Content */}
      <div className="beranda-summary-workspace">
        {/* LEFT SLICERS COLUMN */}
        <aside className="beranda-slicer-column" aria-label="Filter Summary Keuangan">
          {/* Slicer: TAHUN */}
          <div className="beranda-slicer-card">
            <div className="beranda-slicer-header">
              <span>TAHUN</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {tahun}
              </span>
            </div>
            <div className="beranda-slicer-list">
              {availableYears.map((yr) => {
                const isActive = yr === tahun;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setTahun(yr)}
                    className={`beranda-slicer-btn ${isActive ? 'is-active' : ''}`}
                  >
                    <span>{yr}</span>
                    {isActive && <Check size={13} color="var(--accent-blue-text)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slicer: BULAN */}
          <div className="beranda-slicer-card">
            <div className="beranda-slicer-header">
              <span>BULAN</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {getMonthNameId(bulan)}
              </span>
            </div>
            <div className="beranda-slicer-list">
              {availableMonths.map((mo) => {
                const isActive = mo === bulan;
                return (
                  <button
                    key={mo}
                    type="button"
                    onClick={() => setBulan(mo)}
                    className={`beranda-slicer-btn ${isActive ? 'is-active' : ''}`}
                  >
                    <span>
                      {mo}{' '}
                      <span style={{ fontSize: 11, opacity: 0.72, fontWeight: 500 }}>
                        ({getMonthNameId(mo)})
                      </span>
                    </span>
                    {isActive && <Check size={13} color="var(--accent-blue-text)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slicer: NM_CBG */}
          <div className="beranda-slicer-card">
            <div className="beranda-slicer-header">
              <span>NM_CBG</span>
              {!isPicCabang && selectedBranches.length > 0 && (
                <button
                  type="button"
                  onClick={clearBranches}
                  title="Tampilkan semua cabang"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 6px',
                    borderRadius: 6,
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--status-danger-text)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FilterX size={11} /> Clear
                </button>
              )}
            </div>

            {!isPicCabang && availableBranches.length > 5 && (
              <div style={{ padding: '6px 6px 2px', position: 'relative' }}>
                <Search
                  size={12}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: 15,
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
                  style={{
                    width: '100%',
                    padding: '5px 8px 5px 26px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: 11.5,
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div className="beranda-slicer-list beranda-slicer-scroll">
              {!isPicCabang && (
                <button
                  type="button"
                  onClick={clearBranches}
                  className={`beranda-slicer-btn ${selectedBranches.length === 0 ? 'is-active' : ''}`}
                >
                  <span>Semua Cabang ({availableBranches.length})</span>
                  {selectedBranches.length === 0 && <Check size={13} color="var(--accent-blue-text)" />}
                </button>
              )}

              {filteredBranchOptions.map((opt) => {
                const isSelected = isPicCabang
                  ? true
                  : selectedBranches.includes(opt.nmCbg);
                return (
                  <button
                    key={opt.nmCbg}
                    type="button"
                    disabled={isPicCabang}
                    onClick={() => toggleBranch(opt.nmCbg)}
                    className={`beranda-slicer-btn ${isSelected ? 'is-active' : ''}`}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.nmCbg}
                    </span>
                    {isSelected && <Check size={13} color="var(--accent-blue-text)" />}
                  </button>
                );
              })}

              {filteredBranchOptions.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  Cabang tidak ditemukan
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT DASHBOARD CONTENT */}
        <div className="beranda-main-area">
          {/* TOP 4 KPI CARDS */}
          <section className="beranda-kpi-grid" aria-label="KPI Keuangan Area">
            {/* 1. Laba Area */}
            <div className="beranda-kpi-card">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(59, 130, 246, 0.14)',
                  color: 'var(--accent-blue-text)',
                  flexShrink: 0,
                }}
              >
                <Banknote size={28} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-title)' }}>
                  Laba Area
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: 'var(--accent-blue-text)',
                    lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                  }}
                >
                  {loading && !kpis ? '...' : kpis?.labaArea.formatted ?? 'Rp 0'}
                </div>
                <KpiSubMetrics
                  yoy={kpis?.labaArea.yoy ?? null}
                  rka={kpis?.labaArea.rka ?? null}
                />
              </div>
            </div>

            {/* 2. Pendapatan */}
            <div className="beranda-kpi-card">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(112, 173, 71, 0.16)',
                  color: 'var(--status-good-text)',
                  flexShrink: 0,
                }}
              >
                <Coins size={28} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-title)' }}>
                  Pendapatan
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: 'var(--status-good-text)',
                    lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                  }}
                >
                  {loading && !kpis ? '...' : kpis?.pendapatan.formatted ?? 'Rp 0'}
                </div>
                <KpiSubMetrics
                  yoy={kpis?.pendapatan.yoy ?? null}
                  rka={kpis?.pendapatan.rka ?? null}
                />
              </div>
            </div>

            {/* 3. Beban */}
            <div className="beranda-kpi-card">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(237, 125, 49, 0.16)',
                  color: 'var(--accent-orange-text)',
                  flexShrink: 0,
                }}
              >
                <Coins size={28} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-title)' }}>
                  Beban
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: 'var(--accent-orange-text)',
                    lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                  }}
                  title={
                    kpis
                      ? `${formatBebanTriliun(kpis.beban.value, { includeCurrency: false })} (${formatRupiahFull(kpis.beban.value)})`
                      : 'Rp 0,00 T'
                  }
                >
                  {loading && !kpis ? '...' : kpis?.beban.formatted ?? 'Rp 0,00 T'}
                </div>
                <KpiSubMetrics
                  yoy={kpis?.beban.yoy ?? null}
                  rka={kpis?.beban.rka ?? null}
                />
              </div>
            </div>

            {/* 4. BOPO */}
            <div className="beranda-kpi-card is-bopo">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-on-dark-muted)' }}>Bopo</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--status-alert-on-dark)',
                  lineHeight: 1.15,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {loading && !kpis ? '...' : kpis?.bopo.formatted ?? '0,00%'}
              </div>
            </div>
          </section>

          {/* 5 CHARTS BENTO GRID */}
          <section className="beranda-charts-bento" aria-label="Grafik Ringkasan Keuangan">
            {/* LEFT COLUMN: Top 10 Laba + Top 10 Pendapatan */}
            <div className="beranda-chart-stack-col">
              {/* Grafik 1: 10 Cabang Terbesar Laba Area */}
              <div className="beranda-chart-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: 'var(--text-title)',
                    }}
                  >
                    10 Cabang Terbesar Laba Area
                  </h3>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Miliar (Rp)
                  </span>
                </div>

                <div style={{ width: '100%', height: 245 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={top10Laba}
                      stackOffset="sign"
                      margin={{ top: 6, right: 12, left: 4, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--border-subtle)"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => formatIdDecimal2(Number(val))}
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        width={116}
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
                          barSize={12}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {BERANDA_ENTITAS_ORDER.map((ent) => (
                    <span key={ent} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          backgroundColor: BERANDA_ENTITAS_COLORS[ent],
                        }}
                      />
                      {ent}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grafik 2: 10 Cabang Terbesar Pendapatan Area */}
              <div className="beranda-chart-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: 'var(--text-title)',
                    }}
                  >
                    10 Cabang Terbesar Pendapatan Area
                  </h3>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Miliar (Rp)
                  </span>
                </div>

                <div style={{ width: '100%', height: 245 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={top10Pendapatan}
                      stackOffset="sign"
                      margin={{ top: 6, right: 12, left: 4, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--border-subtle)"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => formatIdDecimal2(Number(val))}
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        width={116}
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
                          barSize={12}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {BERANDA_ENTITAS_ORDER.map((ent) => (
                    <span key={ent} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          backgroundColor: BERANDA_ENTITAS_COLORS[ent],
                        }}
                      />
                      {ent}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: BOPO AREA PER CABANG */}
            <div className="beranda-chart-card beranda-bopo-col">
              <div className="beranda-bopo-banner">BOPO AREA PER CABANG</div>
              <div style={{ width: '100%', height: bopoChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={bopoRows}
                    margin={{ top: 4, right: 54, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" domain={[0, maxBopo]} hide />
                    <YAxis
                      type="category"
                      dataKey="nmCbg"
                      width={118}
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
                      fill="#4472c4"
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
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RIGHT COLUMN: % Kontribusi Entitas + 10 Terendah PJM */}
            <div className="beranda-chart-stack-col">
              {/* Grafik 4: % KONTRIBUSI LABA AREA PER ENTITAS */}
              <div className="beranda-chart-card">
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: 'var(--text-title)',
                    textAlign: 'center',
                  }}
                >
                  % KONTRIBUSI LABA AREA PER ENTITAS
                </h3>

                <div style={{ width: '100%', height: 215 }}>
                  {hasPositiveEntityShare ? (
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
                          innerRadius={44}
                          outerRadius={84}
                          paddingAngle={1}
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
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: 16,
                      }}
                    >
                      Tidak ada kontribusi laba positif pada filter cabang aktif
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {entityShare.map((entry) => (
                    <span
                      key={entry.entitas}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          backgroundColor: BERANDA_ENTITAS_COLORS[entry.entitas],
                        }}
                      />
                      {entry.entitas} ({entry.roundedPct}%)
                    </span>
                  ))}
                </div>
              </div>

              {/* Grafik 5: 10 Cabang Terendah Laba Area PJM */}
              <div className="beranda-chart-card" style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: 'var(--text-title)',
                    }}
                  >
                    10 Cabang Terendah Laba Area PJM
                  </h3>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Juta (Rp)
                  </span>
                </div>

                <div style={{ width: '100%', height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={pjmRows}
                      margin={{ top: 6, right: 6, left: 86, bottom: 4 }}
                    >
                      <XAxis type="number" domain={pjmDomain} hide />
                      <YAxis
                        type="category"
                        dataKey="nmCbg"
                        orientation="right"
                        width={92}
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
                        fill="#c00000"
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
      </div>
    </div>
  );
}
