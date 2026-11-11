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
  Filter,
  RotateCcw,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface KonsolidasiData {
  filters: {
    year: number;
    month: number;
    selectedBranches: string[];
  };
  kpi: {
    labaArea: { realisasi: number; yoy: number; rka: number };
    pendapatan: { realisasi: number; yoy: number; rka: number };
    beban: { realisasi: number; yoy: number; rka: number };
    bopo: { percentage: number };
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
  onOpenManualInput,
}: ExecutiveKonsolidasiDashboardProps) {
  // Slicer States
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [selectedBranchList, setSelectedBranchList] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState<string>('');

  // Data state
  const [dashboardData, setDashboardData] = useState<KonsolidasiData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  // Load available data
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        setLoading(true);
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
        console.error('Error loading konsolidasi data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
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
      setSelectedBranchList((prev) =>
        prev.includes(branchName)
          ? prev.filter((b) => b !== branchName)
          : [...prev, branchName]
      );
    });
  };

  const clearBranchFilter = () => {
    setSelectedBranchList([]);
    setBranchSearch('');
  };

  const kpi = dashboardData?.kpi;
  const charts = dashboardData?.charts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#1e293b' }}>
      {/* Top Main Grid: Left Slicers (TAHUN, BULAN, NM_CBG) & Right Main Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* ================= LEFT SLICERS PANEL ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* SLICER 1: TAHUN */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.5px',
              }}
            >
              TAHUN
            </div>
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid transparent',
                      backgroundColor: isSelected ? '#bfdbfe' : '#f8fafc',
                      color: isSelected ? '#1e3a8a' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLICER 2: BULAN */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.5px',
              }}
            >
              BULAN
            </div>
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid transparent',
                      backgroundColor: isSelected ? '#bfdbfe' : '#f8fafc',
                      color: isSelected ? '#1e3a8a' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLICER 3: NM_CBG (Multi-select list) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>NM_CBG</span>
              {selectedBranchList.length > 0 && (
                <button
                  type="button"
                  onClick={clearBranchFilter}
                  title="Reset Filter Cabang"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>

            {/* Branch search */}
            <div style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={11} style={{ position: 'absolute', left: '6px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '3px 6px 3px 22px',
                    fontSize: '11px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Scrollable branch list items */}
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                padding: '4px 6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {branches.map((b) => {
                const isSelected = selectedBranchList.includes(b.branch_name);
                return (
                  <button
                    key={b.branch_code}
                    type="button"
                    onClick={() => toggleBranch(b.branch_name)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 700 : 400,
                      borderRadius: '3px',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#bfdbfe' : '#ffffff',
                      color: isSelected ? '#1e3a8a' : '#1e293b',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={b.branch_name}
                  >
                    {b.branch_name}
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
              gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr',
              gap: '14px',
            }}
          >
            {/* 1. Laba Area */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
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
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                }}
              >
                <Wallet size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Laba Area</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7', margin: '2px 0' }}>
                  {kpi ? formatM(kpi.labaArea.realisasi) : 'Rp 751,82 M'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  YoY: <span style={{ color: '#16a34a', fontWeight: 700 }}>{kpi?.labaArea.yoy ?? 99.01}</span>{' '}
                  RKA: <span style={{ color: '#16a34a', fontWeight: 700 }}>{kpi?.labaArea.rka ?? 99.01}</span>
                </div>
              </div>
            </div>

            {/* 2. Pendapatan */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
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
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                }}
              >
                <Coins size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Pendapatan</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a', margin: '2px 0' }}>
                  {kpi ? formatT(kpi.pendapatan.realisasi) : 'Rp 3,19 T'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  YoY: <span style={{ color: '#16a34a', fontWeight: 700 }}>{kpi?.pendapatan.yoy ?? 99.01}</span>{' '}
                  RKA: <span style={{ color: '#16a34a', fontWeight: 700 }}>{kpi?.pendapatan.rka ?? 99.01}</span>
                </div>
              </div>
            </div>

            {/* 3. Beban */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
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
                  backgroundColor: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                }}
              >
                <TrendingDown size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Beban</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#ea580c', margin: '2px 0' }}>
                  {kpi ? formatT(kpi.beban.realisasi) : '- Rp 2,42 T'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  YoY: <span style={{ color: '#ea580c', fontWeight: 700 }}>{kpi?.beban.yoy ?? 99.01}</span>{' '}
                  RKA: <span style={{ color: '#ea580c', fontWeight: 700 }}>{kpi?.beban.rka ?? 99.01}</span>
                </div>
              </div>
            </div>

            {/* 4. BOPO (Dark Blue Background Card) */}
            <div
              style={{
                backgroundColor: '#0a192f',
                border: '1px solid #1e3a5f',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(10,25,47,0.15)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.3px' }}>
                Bopo
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  color: '#facc15', // Vibrant Gold
                  marginTop: '4px',
                  letterSpacing: '0.5px',
                }}
              >
                {kpi?.bopo?.percentage?.toFixed(2) ?? '75,84'}%
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
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    10 Cabang Terbesar Laba Area
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Billions</div>
                </div>

                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={charts?.topLabaBranches || []}
                      margin={{ top: 5, right: 15, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tickFormatter={formatBillionAxis}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <YAxis
                        dataKey="branchName"
                        type="category"
                        tick={{ fontSize: 9.5, fill: '#334155' }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatM(Number(val || 0)),
                          '',
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
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
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    10 Cabang Terbesar Pendapatan Area
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Billions</div>
                </div>

                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={charts?.topPendapatanBranches || []}
                      margin={{ top: 5, right: 15, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tickFormatter={formatBillionAxis}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <YAxis
                        dataKey="branchName"
                        type="category"
                        tick={{ fontSize: 9.5, fill: '#334155' }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatM(Number(val || 0)),
                          '',
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
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
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  backgroundColor: '#2563eb', // Corporate Header Blue
                  padding: '10px 14px',
                  color: '#ffffff',
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
                        fontSize: '10.5px',
                      }}
                    >
                      <div
                        style={{
                          textAlign: 'right',
                          color: '#334155',
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
                          backgroundColor: '#f1f5f9',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: isHigh ? '#3b82f6' : '#2563eb',
                            borderRadius: '2px',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isHigh ? '#dc2626' : '#1e3a8a',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.bopoPct.toFixed(2)}%
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
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#0f172a',
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
                        label={({ payload }) => `${payload.percentage}%`}
                        labelLine={false}
                      >
                        {(charts?.kontribusiEntitas || []).map((entry) => (
                          <Cell
                            key={entry.entitas}
                            fill={ENTITAS_COLORS[entry.entitas] || '#64748b'}
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
                        wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }}
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Card 2: 10 Cabang Terendah Laba Area PJM (Red Ranked Horizontal Bars) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#0f172a',
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
                              backgroundColor: '#b91c1c', // Deep Crimson Red
                              color: '#ffffff',
                              fontSize: '9.5px',
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
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#334155',
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
