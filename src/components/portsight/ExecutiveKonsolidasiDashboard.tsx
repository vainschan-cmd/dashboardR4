'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Wallet,
  Coins,
  TrendingDown,
  Percent,
  Search,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import Term from '@/components/ui/Term';
import { formatPercent } from '@/lib/formatters';

interface KonsolidasiData {
  filters: {
    year: number;
    month: number;
    selectedBranches: string[];
  };
  kpi: {
    labaArea: { realisasi: number; yoy: number | null; rka: number | null };
    pendapatan: { realisasi: number; yoy: number | null; rka: number | null };
    beban: { realisasi: number; yoy: number | null; rka: number | null };
    bopo: { percentage: number | null };
  };
  charts: {
    topLabaBranches: Array<{
      branchName: string;
      CABANG: number;
      PJM: number;
      PMT: number;
      PSL: number;
      PTP: number;
      total: number;
    }>;
    topPendapatanBranches: Array<{
      branchName: string;
      CABANG: number;
      PJM: number;
      PMT: number;
      PSL: number;
      PTP: number;
      total: number;
    }>;
    bopoPerCabang: Array<{
      branchName: string;
      branchCode: string;
      beban: number;
      pendapatan: number;
      bopoPct: number;
    }>;
    kontribusiEntitas: Array<{
      entitas: string;
      realisasi: number;
      percentage: number;
    }>;
    pjmTerendah: Array<{
      branchName: string;
      branchCode: string;
      realisasi: number;
      realisasiBillion: number;
    }>;
  };
  options: {
    availablePeriods: Array<{ year: number; month: number }>;
    availableBranches: Array<{ branch_code: string; branch_name: string }>;
  };
}

interface ExecutiveKonsolidasiDashboardProps {
  selectedTerminal?: string;
  onOpenManualInput?: () => void;
}

const ENTITAS_COLORS: Record<string, string> = {
  CABANG: '#2563eb', // Blue
  PJM: '#f97316',    // Orange
  PMT: '#94a3b8',    // Slate / Silver-Grey
  PSL: '#facc15',    // Gold / Yellow
  PTP: '#22c55e',    // Green
};

export default function ExecutiveKonsolidasiDashboard({
  selectedTerminal = 'ALL',
}: ExecutiveKonsolidasiDashboardProps) {
  // Slicer States
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [selectedBranchList, setSelectedBranchList] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState<string>('');

  // Data state
  const [dashboardData, setDashboardData] = useState<KonsolidasiData | null>(null);
  const [, startTransition] = useTransition();

  // Load available data
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          year: selectedYear.toString(),
          month: selectedMonth.toString(),
        });

        if (selectedBranchList.length > 0) {
          params.set('branches', selectedBranchList.join(','));
        } else if (selectedTerminal && selectedTerminal !== 'ALL') {
          params.set('branches', selectedTerminal);
        }

        const res = await fetch(`/api/keuangan/konsolidasi?${params.toString()}`);
        if (!res.ok) throw new Error('Gagal mengambil data konsolidasi keuangan');
        const json = (await res.json()) as KonsolidasiData;

        if (isMounted) {
          setDashboardData(json);
        }
      } catch (err) {
        console.error('Error loading konsolidasi data:', err);      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [selectedYear, selectedMonth, selectedBranchList, selectedTerminal]);

  // Formatters
  const formatT = (val: number) => {
    const abs = Math.abs(val);
    const inT = abs / 1_000_000_000_000;
    const prefix = val < 0 ? '- ' : '';
    return `${prefix}Rp ${inT.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`;
  };

  const formatM = (val: number) => {
    const abs = Math.abs(val);
    const inM = abs / 1_000_000_000;
    const prefix = val < 0 ? '- ' : '';
    return `${prefix}Rp ${inM.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  };

  /** Comparison metrics are null when the source has no YoY/RKA value — never invent a number. */
  const formatPctOrDash = (val: number | null | undefined) =>
    val === null || val === undefined || Number.isNaN(val) ? '—' : formatPercent(val, 2);

  const formatBillionAxis = (val: number) => {
    const b = val / 1_000_000_000;
    return b.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  };

  // Branch list filtered by search
  const branches = useMemo(() => {
    const list = dashboardData?.options?.availableBranches || [];
    if (!branchSearch.trim()) return list;
    return list.filter((b) =>
      b.branch_name.toLowerCase().includes(branchSearch.toLowerCase())
    );
  }, [dashboardData, branchSearch]);

  const toggleBranch = (branchName: string) => {
    startTransition(() => {
      setSelectedBranchList((prev) => {
        if (prev.length === 0) {
          return [branchName];
        }
        return prev.includes(branchName)
          ? prev.filter((b) => b !== branchName)
          : [...prev, branchName];
      });
    });
  };

  const selectAllBranches = () => {
    startTransition(() => {
      setSelectedBranchList([]);
      setBranchSearch('');
    });
  };

  const clearBranchFilter = () => {
    setSelectedBranchList([]);
    setBranchSearch('');
  };

  const kpi = dashboardData?.kpi;
  const charts = dashboardData?.charts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-main)' }}>
      {/* Top Main Grid: Left Slicers (TAHUN, BULAN, NM_CBG) & Right Main Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '14px', alignItems: 'start' }}>
        
        {/* ================= LEFT SLICERS PANEL ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* SLICER 1: TAHUN */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text-title)',
                letterSpacing: '0.5px',
                marginBottom: '6px',
                paddingLeft: '2px',
              }}
            >
              TAHUN
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[2025, 2026].map((yr) => {
                const isSelected = selectedYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--blue-soft)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--text-title)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{yr}</span>
                    {isSelected && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-blue)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLICER 2: BULAN */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text-title)',
                letterSpacing: '0.5px',
                marginBottom: '6px',
                paddingLeft: '2px',
              }}
            >
              BULAN
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[8, 9].map((m) => {
                const isSelected = selectedMonth === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonth(m)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--blue-soft)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--text-title)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{m}</span>
                    {isSelected && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-blue)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLICER 3: NM_CBG (Multi-select list) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
                paddingLeft: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-title)',
                  letterSpacing: '0.5px',
                }}
              >
                Cabang
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: selectedBranchList.length > 0 ? 'var(--accent-blue-text)' : 'var(--text-muted)',
                  backgroundColor: 'var(--bg-inner)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {selectedBranchList.length === 0 ? 'Semua' : `${selectedBranchList.length}`}
              </span>
            </div>

            {/* Quick Actions: Semua & Reset */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                type="button"
                onClick={selectAllBranches}
                style={{
                  flex: 1,
                  padding: '2.5px 6px',
                  fontSize: '12px',
                  fontWeight: selectedBranchList.length === 0 ? 700 : 500,
                  borderRadius: '3px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: selectedBranchList.length === 0 ? 'var(--blue-soft)' : 'var(--bg-card)',
                  color: selectedBranchList.length === 0 ? 'var(--accent-blue-text)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Pilih Semua
              </button>
              {selectedBranchList.length > 0 && (
                <button
                  type="button"
                  onClick={clearBranchFilter}
                  title="Reset Filter Cabang"
                  style={{
                    padding: '2.5px 6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '3px',
                    border: '1px solid var(--status-danger-border)',
                    backgroundColor: 'var(--status-danger-bg)',
                    color: 'var(--status-danger-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <RotateCcw size={9} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Branch search */}
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <Search size={11} style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari cabang..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '3px 20px 3px 22px',
                  fontSize: '12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  outline: 'none',
                  backgroundColor: 'var(--bg-inner)',
                  color: 'var(--text-on-accent)',
                }}
              />
              {branchSearch && (
                <button
                  type="button"
                  onClick={() => setBranchSearch('')}
                  style={{
                    position: 'absolute',
                    right: '5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Scrollable branch list items */}
            <div
              style={{
                maxHeight: '430px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                paddingRight: '2px',
              }}
            >
              {branches.map((b) => {
                const isSelected = selectedBranchList.includes(b.branch_name);
                const isAllMode = selectedBranchList.length === 0;
                return (
                  <button
                    key={b.branch_code}
                    type="button"
                    onClick={() => toggleBranch(b.branch_name)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 7px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : (isAllMode ? 600 : 400),
                      borderRadius: '4px',
                      border: isSelected
                        ? '1px solid var(--accent-blue)'
                        : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected
                        ? 'var(--accent-blue)'
                        : isAllMode
                        ? 'var(--blue-soft)'
                        : 'var(--bg-card)',
                      color: isSelected
                        ? 'var(--text-on-accent)'
                        : isAllMode
                        ? 'var(--accent-blue-text)'
                        : 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.12s ease',
                    }}
                    title={b.branch_name}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.branch_name}</span>
                    {isSelected && <Check size={11} strokeWidth={2.5} style={{ flexShrink: 0, color: 'var(--text-on-accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= RIGHT MAIN DASHBOARD CONTENT ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TOP ROW: 4 KPI CARDS (Laba Area, Pendapatan, Beban, Bopo) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px',
            }}
          >
            {/* 1. Laba Area */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--blue-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-blue-text)',
                }}
              >
                <Wallet size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Laba Area</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-blue-text)', margin: '2px 0' }}>
                  {kpi ? formatM(kpi.labaArea.realisasi) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  YoY: <span style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.labaArea.yoy ?? null)}</span>{' '}
                  RKA: <span style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.labaArea.rka ?? null)}</span>
                </div>
              </div>
            </div>

            {/* 2. Pendapatan */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--status-good-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--status-good-text)',
                }}
              >
                <Coins size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pendapatan</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--status-good-text)', margin: '2px 0' }}>
                  {kpi ? formatT(kpi.pendapatan.realisasi) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  YoY: <span style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.pendapatan.yoy ?? null)}</span>{' '}
                  RKA: <span style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.pendapatan.rka ?? null)}</span>
                </div>
              </div>
            </div>

            {/* 3. Beban */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--status-alert-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-orange-text)',
                }}
              >
                <TrendingDown size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Beban</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-orange-text)', margin: '2px 0' }}>
                  {kpi ? formatT(kpi.beban.realisasi) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  YoY: <span style={{ color: 'var(--accent-orange-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.beban.yoy ?? null)}</span>{' '}
                  RKA: <span style={{ color: 'var(--accent-orange-text)', fontWeight: 700 }}>{formatPctOrDash(kpi?.beban.rka ?? null)}</span>
                </div>
              </div>
            </div>

            {/* 4. BOPO (Navy Blue Card with Yellow Text, styled like the other cards) */}
            <div
              style={{
                backgroundColor: 'var(--navy-900)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 2px 6px rgba(0, 32, 96, 0.25)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(250, 204, 21, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--status-alert-text)',
                }}
              >
                <Percent size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-on-dark-muted)' }}>
                  <Term term="BOPO" style={{ color: 'inherit' }} />
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--status-alert-on-dark)', margin: '2px 0' }} className="tabular-nums">
                  {kpi?.bopo?.percentage === null || kpi?.bopo?.percentage === undefined
                    ? '—'
                    : formatPercent(kpi.bopo.percentage, 2)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)' }}>
                  {/* These two figures were hardcoded to "99,01": the BOPO card
                      displayed a fake comparison that never came from data.
                      The BOPO endpoint does not return YoY/RKA, so say so. */}
                  YoY:{' '}
                  <span style={{ color: 'var(--status-alert-on-dark)', fontWeight: 700 }}>—</span>{' '}
                  RKA:{' '}
                  <span style={{ color: 'var(--status-alert-on-dark)', fontWeight: 700 }}>—</span>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE ROW: 3 Major Panels (Laba Area Stacked Bar, BOPO Table/Bar, Kontribusi Entitas & PJM Terendah) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.9fr 1fr',
              gap: '14px',
              alignItems: 'start',
            }}
          >
            {/* COLUMN 1: 10 Cabang Terbesar Laba Area & 10 Cabang Terbesar Pendapatan Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Card 1: 10 Cabang Terbesar Laba Area */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
                    10 Cabang Terbesar Laba Area
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>dalam miliar Rupiah</div>
                </div>

                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={charts?.topLabaBranches || []}
                      margin={{ top: 5, right: 15, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                      <XAxis
                        type="number"
                        tickFormatter={formatBillionAxis}
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                      />
                      <YAxis
                        dataKey="branchName"
                        type="category"
                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatM(Number(val || 0)),
                          '',
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }}
                        iconSize={8}
                      />
                      <Bar dataKey="CABANG" stackId="a" fill={ENTITAS_COLORS.CABANG} name="CABANG" />
                      <Bar dataKey="PJM" stackId="a" fill={ENTITAS_COLORS.PJM} name="PJM" />
                      <Bar dataKey="PMT" stackId="a" fill={ENTITAS_COLORS.PMT} name="PMT" />
                      <Bar dataKey="PSL" stackId="a" fill={ENTITAS_COLORS.PSL} name="PSL" />
                      <Bar dataKey="PTP" stackId="a" fill={ENTITAS_COLORS.PTP} name="PTP" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Card 2: 10 Cabang Terbesar Pendapatan Area */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
                    10 Cabang Terbesar Pendapatan Area
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>dalam miliar Rupiah</div>
                </div>

                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={charts?.topPendapatanBranches || []}
                      margin={{ top: 5, right: 15, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                      <XAxis
                        type="number"
                        tickFormatter={formatBillionAxis}
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                      />
                      <YAxis
                        dataKey="branchName"
                        type="category"
                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatM(Number(val || 0)),
                          '',
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }}
                        iconSize={8}
                      />
                      <Bar dataKey="CABANG" stackId="a" fill={ENTITAS_COLORS.CABANG} name="CABANG" />
                      <Bar dataKey="PJM" stackId="a" fill={ENTITAS_COLORS.PJM} name="PJM" />
                      <Bar dataKey="PMT" stackId="a" fill={ENTITAS_COLORS.PMT} name="PMT" />
                      <Bar dataKey="PSL" stackId="a" fill={ENTITAS_COLORS.PSL} name="PSL" />
                      <Bar dataKey="PTP" stackId="a" fill={ENTITAS_COLORS.PTP} name="PTP" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* COLUMN 2: BOPO AREA PER CABANG (Horizontal Bar List Table) */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--accent-blue)', // Corporate header
                  padding: '10px 14px',
                  color: 'var(--text-on-accent)',
                  fontSize: '12px',
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '0.4px',
                }}
              >
                BOPO AREA PER CABANG
              </div>

              {/* Scrollable List Table of Bars */}
              <div
                style={{
                  padding: '8px 12px',
                  maxHeight: '525px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {(charts?.bopoPerCabang || []).map((item) => {
                  const pct = Math.min(Math.max(item.bopoPct, 0), 100);
                  const isHigh = item.bopoPct > 90;
                  return (
                    <div
                      key={item.branchCode}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '85px 1fr 50px',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          textAlign: 'right',
                          color: 'var(--text-secondary)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.branchName}
                      >
                        {item.branchName}
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{
                          height: '14px',
                          backgroundColor: 'var(--bg-table-header)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: isHigh ? 'var(--accent-blue)' : 'var(--blue-primary)',
                            borderRadius: '2px',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isHigh ? 'var(--status-danger-text)' : 'var(--accent-blue-text)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatPercent(item.bopoPct, 2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: % KONTRIBUSI LABA AREA PER ENTITAS & 10 CABANG TERENDAH LABA AREA PJM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Card 1: % Kontribusi Laba Area per Entitas (Donut Chart) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--text-title)',
                    textAlign: 'center',
                    marginBottom: '6px',
                  }}
                >
                  % KONTRIBUSI LABA AREA PER ENTITAS
                </div>

                <div style={{ height: '190px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts?.kontribusiEntitas || []}
                        dataKey="realisasi"
                        nameKey="entitas"
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={74}
                        paddingAngle={2}
                        label={({ payload }) => formatPercent(Number(payload.percentage), 1)}
                        labelLine={false}
                      >
                        {(charts?.kontribusiEntitas || []).map((entry) => (
                          <Cell
                            key={entry.entitas}
                            fill={ENTITAS_COLORS[entry.entitas] || 'var(--text-muted)'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatM(Number(val || 0)),
                          'Laba Bersih',
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '2px' }}
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Card 2: 10 Cabang Terendah Laba Area PJM (Red Ranked Horizontal Bars) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--text-title)',
                    textAlign: 'center',
                    marginBottom: '10px',
                  }}
                >
                  10 Cabang Terendah Laba Area PJM
                </div>

                {/* Vertical ranked list with red bars matching user image */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {(charts?.pjmTerendah || []).map((item) => {
                    // Normalize bar width based on max deficit (around 8.532 M)
                    const absBillion = Math.abs(item.realisasiBillion);
                    const barWidth = Math.min(Math.max((absBillion / 9.0) * 100, 15), 100);
                    return (
                      <div
                        key={item.branchCode}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 70px',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {/* Red bar aligned from right to left */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                          <div
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: 'var(--status-danger-text)',
                              color: 'var(--text-on-alert)',
                              fontSize: '12px',
                              fontWeight: 700,
                              textAlign: 'right',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              whiteSpace: 'nowrap',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ({absBillion.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })})
                          </div>
                        </div>

                        {/* Branch Name Label */}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={item.branchName}
                        >
                          {item.branchName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
