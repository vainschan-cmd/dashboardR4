'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Ship,
  Layers,
  Activity,
  RotateCcw,
  DollarSign,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Search,
  X,
  BarChart3,
  CheckSquare,
  Gauge,
  CheckCircle2,
  Lock,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { getSelectedBranchLabel } from '@/lib/constants';
import { formatRupiahFull } from '@/lib/formatters';
import { User, UserRole } from '@/lib/types';
import { useBerandaAnalytics, BerandaKpiItem } from '@/hooks/useBerandaAnalytics';

interface PortSightBerandaProps {
  selectedTerminal?: string;
  selectedPeriod?: string;
  onSelectTerminal?: (terminalId: string) => void;
  onNavigateTab?: (tabId: string, branchCode?: string) => void;
  onOpenDrilldown?: (item: BerandaKpiItem | Record<string, unknown>) => void;
  currentUser?: User | null;
  userRole?: UserRole;
  comparisonMode?: string;
  onOpenComparisonModal?: () => void;
}

export default function PortSightBeranda({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  onSelectTerminal,
  onNavigateTab,
  onOpenDrilldown,
  currentUser,
  userRole,
  comparisonMode = 'all',
  onOpenComparisonModal,
}: PortSightBerandaProps) {
  const [terminalSearch, setTerminalSearch] = useState<string>('');
  const [dashboardView, setDashboardView] = useState<'visual' | 'cards'>('visual');

  const {
    loading,
    verifiedOnly,
    setVerifiedOnly,
    verificationSummary,
    isPicCabang,
    isNone,
    isAll,
    isSingle,
    isMulti,
    selectedCodes,
    activeBranch,
    filteredUtilisasi,
    serviceKpis,
    financeKpis,
    terminalsOverview,
    filteredTerminalsOverview,
    selectedBranchesMetrics,
    branchCommoditiesBreakdown,
    attentionItems,
    mainCombinedChartData,
    gaugeMetrics,
    servicesGroupedChartData,
  } = useBerandaAnalytics({
    selectedTerminal,
    selectedPeriod,
    currentUser,
    userRole,
    terminalSearch,
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          className="skeleton-shimmer"
          style={{ height: '48px', borderRadius: 'var(--radius-md)' }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          <div
            className="skeleton-shimmer"
            style={{ height: '290px', borderRadius: 'var(--radius-md)' }}
          />
          <div
            className="skeleton-shimmer"
            style={{ height: '290px', borderRadius: 'var(--radius-md)' }}
          />
        </div>
        <div
          className="skeleton-shimmer"
          style={{ height: '320px', borderRadius: 'var(--radius-md)' }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Active Branch Filter Banner (When a specific branch is selected) */}
      {!isAll && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isPicCabang ? 'rgba(2, 132, 199, 0.16)' : 'rgba(2, 132, 199, 0.12)',
            border: isPicCabang ? '1px solid rgba(2, 132, 199, 0.5)' : '1px solid rgba(2, 132, 199, 0.35)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '12px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Building2 size={16} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                {isPicCabang
                  ? `Cabang Penugasan PIC: [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}`
                  : isNone
                  ? 'Pilihan Cabang Dikosongkan (Mode Reset)'
                  : isMulti
                  ? `Filter Aktif: ${getSelectedBranchLabel(selectedTerminal)}`
                  : `Filter Aktif: [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}`}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {isPicCabang
                  ? 'Tampilan dashboard, ringkasan eksekutif, dan data operasional disesuaikan khusus untuk cabang penugasan Anda.'
                  : isNone
                  ? 'Semua cabang saat ini tidak dicentang. Silakan pilih cabang yang ingin dipantau dari filter cabang di atas.'
                  : isMulti
                  ? `Menampilkan data operasional dan finansial masing-masing cabang terpilih (${selectedCodes.length} cabang, non-akumulasi).`
                  : `Menampilkan performa dan data operasional khusus cabang ${activeBranch?.name || selectedTerminal}.`}
              </div>
            </div>
          </div>

          {isPicCabang ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                backgroundColor: 'rgba(2, 132, 199, 0.18)',
                border: '1px solid rgba(2, 132, 199, 0.4)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
              }}
              title="Informasi terkunci sesuai akun PIC cabang"
            >
              <Lock size={12} strokeWidth={1.75} />
              <span>Terkunci Sesuai Akun PIC Cabang</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {onOpenComparisonModal && (
                <button
                  type="button"
                  onClick={onOpenComparisonModal}
                  className="btn-dark"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    color: 'var(--accent-cyan)',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  title="Buka Matriks Detail Komparasi Realisasi vs RKAP vs Realisasi 2025"
                >
                  <BarChart3 size={12} strokeWidth={1.75} />
                  <span>Matriks vs RKAP & 2025</span>
                </button>
              )}
              {onSelectTerminal && (
                <button
                  type="button"
                  onClick={() => onSelectTerminal('ALL')}
                  className="btn-dark"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-pill)',
                    borderColor: 'var(--accent-blue)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Reset ke akumulasi seluruh 28 cabang"
                >
                  <RotateCcw size={12} strokeWidth={1.75} />
                  <span>Tampilkan Akumulasi Semua Cabang (ALL)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* View Switcher & Data Verification Status Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 14px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--accent-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} strokeWidth={1.75} />
            Ikhtisar Kinerja Eksekutif
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            • {isNone
                ? 'Cabang Dikosongkan'
                : isAll
                ? 'Konsolidasi 28 Cabang Resmi Regional 4'
                : isSingle
                ? `Cabang: ${activeBranch?.name || selectedTerminal}`
                : `${selectedCodes.length} Cabang Terpilih`}
          </span>
          <button
            type="button"
            onClick={() => setVerifiedOnly(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '10.5px',
              fontWeight: 700,
              cursor: 'pointer',
              border: verifiedOnly
                ? '1px solid rgba(16, 185, 129, 0.45)'
                : '1px solid rgba(245, 158, 11, 0.45)',
              backgroundColor: verifiedOnly
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(245, 158, 11, 0.12)',
              color: verifiedOnly ? '#10b981' : '#f59e0b',
            }}
            title={
              verifiedOnly
                ? 'Menampilkan hanya data yang telah diverifikasi resmi (klik untuk menyertakan data menunggu verifikasi)'
                : 'Menampilkan seluruh data termasuk yang masih menunggu verifikasi (klik untuk memfilter hanya data terverifikasi)'
            }
          >
            <CheckCircle2 size={12} strokeWidth={1.75} />
            <span>
              {verifiedOnly ? 'Filter: Data Terverifikasi Resmi' : 'Filter: Semua Status (Termasuk Pending)'}
            </span>
          </button>
          {verificationSummary.pendingCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '10.5px',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#f59e0b',
              }}
              title="Terdapat data input baru yang sedang menunggu persetujuan Admin Regional"
            >
              <AlertTriangle size={11} strokeWidth={1.75} />
              <span className="tabular-nums">{verificationSummary.pendingCount} Menunggu Verifikasi</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-inner)', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setDashboardView('visual')}
            style={{
              padding: '5px 12px',
              fontSize: '11.5px',
              fontWeight: dashboardView === 'visual' ? 700 : 500,
              backgroundColor: dashboardView === 'visual' ? '#0284c7' : 'transparent',
              color: dashboardView === 'visual' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart3 size={13} strokeWidth={1.75} />
            <span>Grafik Terpadu</span>
          </button>
          <button
            type="button"
            onClick={() => setDashboardView('cards')}
            style={{
              padding: '5px 12px',
              fontSize: '11.5px',
              fontWeight: dashboardView === 'cards' ? 700 : 500,
              backgroundColor: dashboardView === 'cards' ? '#0284c7' : 'transparent',
              color: dashboardView === 'cards' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={13} strokeWidth={1.75} />
            <span>Kartu Metrik</span>
          </button>
        </div>
      </div>

      {dashboardView === 'visual' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Bagian Atas: Metrik Finansial & KPI Gauge */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '16px',
            }}
          >
            {/* 1. Finansial Kombinasi Bar & Line Chart */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={16} strokeWidth={1.75} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                    Kinerja Finansial (Pendapatan, Beban, Laba Usaha)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Realisasi vs RKAP & YoY
                </span>
              </div>

              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mainCombinedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                    <XAxis dataKey="kpi" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} tickLine={false} unit=" M" />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} unit="%" domain={[0, 140]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--text-main)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                    <Bar yAxisId="left" dataKey="nominalRealisasi" name="Realisasi (Miliar Rp)" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar yAxisId="left" dataKey="nominalTarget" name="Target RKAP (Miliar Rp)" fill="rgba(148, 163, 184, 0.25)" stroke="#64748b" radius={[4, 4, 0, 0]} barSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="capaianRkap" name="% Capaian RKAP" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. KPI Gauge Indicators (Pendapatan, Beban, Laba, Kesiapan Alat) */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gauge size={16} strokeWidth={1.75} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                    KPI Gauge & Kesiapan Alat (RFU)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Pencapaian vs Target Resmi
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  flex: 1,
                }}
              >
                {gaugeMetrics.map((g, idx) => {
                  const circumference = Math.PI * 34;
                  const clampedPct = Math.min(Math.max(g.percentage, 0), 150);
                  const strokeOffset = circumference - (clampedPct / 150) * circumference;

                  return (
                    <div
                      key={`gauge-${idx}`}
                      style={{
                        backgroundColor: 'var(--bg-inner)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                      title={`${g.title}: ${g.fullRealisasi || g.realisasi} (${g.target})`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {g.title}
                        </span>
                        <span className={`status-badge-chip ${g.isGood ? 'status-baik' : 'status-waspada'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {g.isGood ? 'Baik' : 'Waspada'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
                        <svg width="68" height="42" viewBox="0 0 80 48">
                          <path
                            d="M 6 42 A 34 34 0 0 1 74 42"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.08)"
                            strokeWidth={7}
                            strokeLinecap="round"
                          />
                          <path
                            d="M 6 42 A 34 34 0 0 1 74 42"
                            fill="none"
                            stroke={g.color}
                            strokeWidth={7}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div style={{ textAlign: 'right' }}>
                          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)' }}>
                            {g.percentage}%
                          </div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            Capaian RKAP
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
                        <div
                          className="tabular-nums"
                          style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={g.fullRealisasi || g.realisasi}
                        >
                          {g.realisasi}
                        </div>
                        <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>{g.target}</span>
                          <span className={g.isGood ? 'text-positive' : 'text-alert'}>{g.yoy}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bagian Bawah: Kinerja Layanan Pelabuhan & Utilisasi Dermaga (BOR) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ship size={16} strokeWidth={1.75} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Kinerja Layanan {isSingle ? `Cabang [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}` : 'Pelabuhan Terintegrasi'} & BOR
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#06b6d4' }} />
                  Capaian RKAP (%)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                  Pertumbuhan YoY (%)
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicesGroupedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis dataKey="layanan" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} unit="%" domain={[0, 140]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                    }}
                    formatter={(val: unknown, name: unknown, item: { payload?: { fullNominal?: string; nominal?: string } }) => [
                      `${String(val ?? '')}% (${item.payload?.fullNominal || item.payload?.nominal || ''})`,
                      name === 'capaianRkap' ? 'Pencapaian RKAP' : 'Pertumbuhan YoY'
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="capaianRkap" name="Capaian RKAP (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={24}>
                    {servicesGroupedChartData.map((entry, index) => (
                      <Cell key={`cell-rkap-${index}`} fill={entry.status === 'Baik' ? '#06b6d4' : '#f59e0b'} />
                    ))}
                  </Bar>
                  <Bar dataKey="pertumbuhanYoy" name="Pertumbuhan YoY (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24}>
                    {servicesGroupedChartData.map((entry, index) => (
                      <Cell key={`cell-yoy-${index}`} fill={entry.pertumbuhanYoy >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Metrics Breakdown Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              {servicesGroupedChartData.map((s, idx) => (
                <div
                  key={`strip-${idx}`}
                  style={{
                    backgroundColor: 'var(--bg-inner)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                  }}
                  title={`${s.layanan}: ${s.fullNominal || s.nominal}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {s.layanan}
                    </span>
                    <span className={`status-badge-chip ${s.status === 'Baik' ? 'status-baik' : 'status-waspada'}`} style={{ fontSize: '8.5px', padding: '1px 4px' }}>
                      {s.status}
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)', marginTop: '2px' }}>
                    {s.nominal}
                  </div>
                  <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span>RKAP {s.capaianRkap}%</span>
                    <span className={s.pertumbuhanYoy >= 0 ? 'text-positive' : 'text-alert'}>
                      {s.pertumbuhanYoy >= 0 ? '+' : ''}{s.pertumbuhanYoy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Kinerja Operasional Semua Layanan Pelabuhan (Kapal, Petikemas, Barang, Penumpang, Rupa-rupa) */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--accent-cyan)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <Ship size={13} strokeWidth={1.75} />
                  Kinerja Operasional Semua Layanan (Kapal, Petikemas, Barang, Penumpang, Rupa-rupa)
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isNone
                  ? 'Pilih cabang untuk melihat data'
                  : isAll
                  ? 'Konsolidasi 28 Cabang Resmi Regional 4'
                  : isSingle
                  ? `Realisasi Cabang: ${activeBranch?.name || selectedTerminal}`
                  : `${selectedCodes.length} Cabang Terpilih`}
              </span>
            </div>

            <div className="kpi-row-5">
              {serviceKpis.map((kpi, idx) => (
                <div
                  key={`srv-${idx}`}
                  className="kpi-summary-box"
                  onClick={() => onOpenDrilldown && onOpenDrilldown(kpi)}
                  style={{ cursor: onOpenDrilldown ? 'pointer' : 'default' }}
                  title={`${kpi.title}: ${kpi.fullValue || kpi.value} (Target: ${kpi.rawTarget})`}
                >
                  <div className="kpi-header-label">{kpi.title}</div>
                  <div className="kpi-huge-number tabular-nums">{kpi.value}</div>
                  <div className="kpi-comparison-rows tabular-nums">
                    {(!comparisonMode || comparisonMode === 'all' || comparisonMode === 'rkap') && (
                      <div className={kpi.comp1Good ? 'text-positive' : 'text-alert'}>
                        <strong>{kpi.comp1}</strong>
                      </div>
                    )}
                    {(!comparisonMode || comparisonMode === 'all' || comparisonMode === 'yoy') && (
                      <div className={kpi.comp2Good ? 'text-positive' : 'text-alert'}>
                        <strong>{kpi.comp2}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Kinerja Finansial, Beban Biaya & Mutu Operasi */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', marginTop: '14px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#38bdf8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                  }}
                >
                  <DollarSign size={13} strokeWidth={1.75} />
                  Kinerja Finansial, Efisiensi Beban Biaya & Mutu Operasi
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Pendapatan − Beban Biaya = Laba Usaha
              </span>
            </div>

            <div className="kpi-row-5">
              {financeKpis.map((kpi, idx) => (
                <div
                  key={`fin-${idx}`}
                  className="kpi-summary-box"
                  onClick={() => onOpenDrilldown && onOpenDrilldown(kpi)}
                  style={{ cursor: onOpenDrilldown ? 'pointer' : 'default' }}
                  title={`${kpi.title}: ${kpi.fullValue || kpi.value} (Target: ${kpi.rawTarget})`}
                >
                  <div className="kpi-header-label">{kpi.title}</div>
                  <div className="kpi-huge-number tabular-nums">{kpi.value}</div>
                  <div className="kpi-comparison-rows tabular-nums">
                    {(!comparisonMode || comparisonMode === 'all' || comparisonMode === 'rkap') && (
                      <div className={kpi.comp1Good ? 'text-positive' : 'text-alert'}>
                        <strong>{kpi.comp1}</strong>
                      </div>
                    )}
                    {(!comparisonMode || comparisonMode === 'all' || comparisonMode === 'yoy') && (
                      <div className={kpi.comp2Good ? 'text-positive' : 'text-alert'}>
                        <strong>{kpi.comp2}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Main Split: Kinerja per Terminal (4x2) vs Perlu Perhatian */}
      <div className="split-dashboard-layout">
        {/* Left Section: Kinerja per terminal / Kinerja per Layanan Cabang */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)' }}>
                {isPicCabang
                  ? `Kinerja Cabang: [${currentUser?.branch_id}] ${activeBranch?.name || currentUser?.branch_id}`
                  : isNone
                  ? 'Cabang Dikosongkan (Mode Reset)'
                  : isAll
                  ? 'Kinerja per terminal'
                  : isSingle
                  ? `Kinerja Layanan Cabang: ${activeBranch?.name || selectedTerminal}`
                  : `Kinerja Masing-Masing Cabang Terpilih (${selectedCodes.length} Cabang - Non-Akumulasi)`}
              </div>
              {isPicCabang ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-cyan)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={11} strokeWidth={1.75} />
                  <span>Cabang PIC Terkunci</span>
                </span>
              ) : (isAll || isMulti) && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    color: 'var(--accent-blue)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {isAll ? `${terminalsOverview.length} Cabang` : `${selectedCodes.length} Cabang Terpilih`}
                </span>
              )}
            </div>

            {(isAll || isMulti) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} strokeWidth={1.75} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={terminalSearch}
                    onChange={(e) => setTerminalSearch(e.target.value)}
                    placeholder="Cari cabang / kode..."
                    style={{
                      padding: '5px 26px 5px 28px',
                      fontSize: '11.5px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-inner)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      width: '180px',
                    }}
                  />
                  {terminalSearch && (
                    <button
                      type="button"
                      onClick={() => setTerminalSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Hapus pencarian"
                    >
                      <X size={12} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Klik kartu untuk filter cabang spesifik
                </span>
              </div>
            )}
          </div>

          {/* Render content depending on state: isNone / isSingle / (isAll or isMulti) */}
          {isNone ? (
            <div
              style={{
                padding: '36px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <RotateCcw size={22} strokeWidth={1.75} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                Semua Cabang Telah Dikosongkan (Mode Reset)
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: 1.5 }}>
                Tidak ada cabang yang dipilih saat ini. Anda dapat mencentang cabang tertentu pada filter cabang di atas, atau klik tombol di bawah untuk mengaktifkan kembali seluruh cabang.
              </div>
              <button
                type="button"
                onClick={() => onSelectTerminal && onSelectTerminal('ALL')}
                className="btn-primary"
                style={{
                  marginTop: '8px',
                  padding: '8px 18px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckSquare size={14} strokeWidth={1.75} />
                <span>Pilih Semua 28 Cabang</span>
              </button>
            </div>
          ) : isSingle ? (
            /* Single branch breakdown */
            <div className="terminal-grid">
              {branchCommoditiesBreakdown.map((c, i) => (
                <div key={i} className="terminal-card" title={`Layanan ${c.layanan}: ${c.fullValue || c.value}`}>
                  <div className="terminal-card-top">
                    <div>
                      <div className="terminal-name">Layanan {c.layanan}</div>
                      <div className="terminal-subtype">Satuan: {c.satuan}</div>
                    </div>
                    <span className={`status-badge-chip ${c.isGood ? 'status-baik' : 'status-waspada'}`}>
                      {c.isGood ? 'Baik' : 'Waspada'}
                    </span>
                  </div>

                  <div className="terminal-metric-value tabular-nums">{c.value}</div>

                  <div className="terminal-card-footer tabular-nums">
                    <span className={c.isGood ? 'text-positive' : 'text-alert'}>
                      {c.rkap}
                    </span>{' '}
                    <span className={c.isGood ? 'text-positive' : 'text-alert'}>
                      {c.yoy}
                    </span>
                  </div>
                </div>
              ))}

              {/* Utilisasi Dermaga info if available */}
              {filteredUtilisasi.length > 0 && (
                <div className="terminal-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                  <div className="terminal-card-top">
                    <div>
                      <div className="terminal-name">Utilisasi Dermaga (BOR)</div>
                      <div className="terminal-subtype">{filteredUtilisasi[0]?.dermaga || 'Dermaga Utama'}</div>
                    </div>
                    <span className="status-badge-chip status-baik">
                      Baik
                    </span>
                  </div>

                  <div className="terminal-metric-value tabular-nums">{filteredUtilisasi[0]?.bor || 0}%</div>

                  <div className="terminal-card-footer tabular-nums">
                    <span className="text-positive">
                      YOR: {filteredUtilisasi[0]?.yor || 0}% • SOR: {filteredUtilisasi[0]?.sor || 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* isAll or isMulti: Render Grid of Selected Branch Cards */
            <div>
              {filteredTerminalsOverview.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                >
                  Tidak ditemukan cabang dengan kata kunci &quot;{terminalSearch}&quot;.
                </div>
              ) : (
                <div className="terminal-grid">
                  {filteredTerminalsOverview.map((t) => (
                    <div
                      key={t.id}
                      className="terminal-card"
                      onClick={() => onSelectTerminal && onSelectTerminal(t.id)}
                      style={{ cursor: 'pointer' }}
                      title={`[${t.code}] ${t.name} — ${t.fullValue || t.value} (Klik untuk memfilter)`}
                    >
                      <div className="terminal-card-top">
                        <div>
                          <div className="terminal-name">{t.name}</div>
                          <div className="terminal-subtype">{t.subtype}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          <span className={`status-badge-chip ${!t.hasData ? '' : t.isGood ? 'status-baik' : 'status-waspada'}`}>
                            {t.status}
                          </span>
                          {t.hasPending && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                color: '#f59e0b',
                                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                              }}
                            >
                              Pending Verifikasi
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="terminal-metric-value tabular-nums">{t.value}</div>

                      <div className="terminal-card-footer tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className={!t.hasData ? '' : t.isGood ? 'text-positive' : 'text-alert'}>
                            {t.rkap}
                          </span>{' '}
                          <span className={!t.hasData ? '' : t.isGood ? 'text-positive' : 'text-alert'}>
                            {t.yoy}
                          </span>
                        </div>
                        <ChevronRight size={14} strokeWidth={1.75} color="var(--accent-blue)" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* If Multi-Branch Selected: Render Table of Each Selected Branch's Metrics (NON-AKUMULASI) */}
              {isMulti && selectedBranchesMetrics.length > 0 && (
                <div style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={16} strokeWidth={1.75} color="var(--accent-blue)" />
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-title)' }}>
                        Rincian Capaian Masing-Masing Cabang Terpilih (Bukan Akumulasi)
                      </h4>
                    </div>
                    <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {selectedBranchesMetrics.length} Cabang Ditampilkan Mandiri
                    </span>
                  </div>

                  <div className="table-responsive" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table className="dark-table" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Kode</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Cabang Pelabuhan</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Pendapatan Usaha</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Laba Usaha</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Petikemas (TEUs)</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Barang (Ton)</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>% RKAP</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>% YoY</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>RFU Alat</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBranchesMetrics.map(bm => (
                          <tr key={bm.code} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', padding: '10px 12px' }}>
                              {bm.code}
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-main)', padding: '10px 12px' }}>
                              {bm.name}
                            </td>
                            <td className="num-cell" style={{ fontWeight: 600, color: 'var(--text-main)', padding: '10px 12px' }}>
                              {bm.revTotal === null ? 'Belum Lapor' : bm.revTotal === 0 ? 'Rp 0' : formatRupiahFull(bm.revTotal)}
                            </td>
                            <td className="num-cell" style={{ fontWeight: 600, color: bm.opTotal === null ? 'var(--text-muted)' : '#10b981', padding: '10px 12px' }}>
                              {bm.opTotal === null ? 'Belum Lapor' : bm.opTotal === 0 ? 'Rp 0' : formatRupiahFull(bm.opTotal)}
                            </td>
                            <td className="num-cell" style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {bm.teusTotal === null ? 'Belum Lapor' : bm.teusTotal === 0 ? '0 TEUs' : `${bm.teusTotal.toLocaleString('id-ID')} TEUs`}
                            </td>
                            <td className="num-cell" style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {bm.tonTotal === null ? 'Belum Lapor' : bm.tonTotal === 0 ? '0 Ton' : `${bm.tonTotal.toLocaleString('id-ID')} Ton`}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'center', padding: '10px 12px' }}>
                              {bm.avgRka === null ? (
                                <span style={{ color: 'var(--text-muted)' }}>Belum Lapor</span>
                              ) : (
                                <span className={`status-badge-chip ${bm.isGood ? 'status-baik' : 'status-waspada'}`}>
                                  {bm.avgRka}%
                                </span>
                              )}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'center', padding: '10px 12px' }}>
                              {bm.avgYoy === null ? (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              ) : (
                                <span className={bm.avgYoy >= 100 ? 'text-positive' : 'text-alert'} style={{ fontWeight: 600 }}>
                                  {bm.avgYoy >= 100 ? `+${(bm.avgYoy - 100).toFixed(1)}%` : `${(bm.avgYoy - 100).toFixed(1)}%`}
                                </span>
                              )}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {bm.rfu !== null ? `${bm.rfu}%` : 'Belum Lapor'}
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                              {!bm.hasData ? (
                                <span className="badge" style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)' }}>
                                  Belum Lapor
                                </span>
                              ) : (
                                <span className={`badge ${bm.isGood ? 'badge-green' : 'badge-red'}`}>
                                  {bm.isGood ? 'Baik' : 'Waspada'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={13} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--accent-blue)' }} />
                    <span>
                      Data di atas menampilkan capaian riil masing-masing cabang terpilih secara independen (tidak dikalkulasi atau diakumulasi menjadi satu total).
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Perlu Perhatian Card dengan Link Sumber Informasi */}
        <div className="attention-card">
          <div className="attention-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} strokeWidth={1.75} color="#fbbf24" />
              <span>Perlu perhatian</span>
            </div>
            <span
              className="tabular-nums"
              style={{
                fontSize: '10.5px',
                color: '#fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
              }}
            >
              {attentionItems.length} Isu
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {attentionItems.map((item, idx) => (
              <div
                key={idx}
                className="attention-item"
                style={{
                  paddingTop: idx === 0 ? '2px' : '12px',
                  paddingBottom: '12px',
                  borderBottom: idx === attentionItems.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="attention-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-title)' }}>{item.header}</span>
                  {item.sourceSheet && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-blue)',
                        backgroundColor: 'rgba(2, 132, 199, 0.1)',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                      }}
                      title={`Sumber data: Sheet "${item.sourceSheet}" pada file input_data.xlsx`}
                    >
                      Sheet: {item.sourceSheet}
                    </span>
                  )}
                </div>

                <div className="attention-item-desc" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '8px' }}>
                  {item.desc}
                </div>

                {item.tabId && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onNavigateTab && onNavigateTab(item.tabId, item.branchCode)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent-blue)',
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-blue)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                      title={`Buka modul ${item.sourceModule} (${item.branchCode || ''})`}
                    >
                      <ExternalLink size={11} strokeWidth={1.75} />
                      <span>{item.linkText || `Buka ${item.sourceModule}`}</span>
                    </button>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      Sumber: {item.sourceModule.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Sumber Data Utama */}
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileSpreadsheet size={13} strokeWidth={1.75} color="var(--accent-blue)" />
              <span>Sumber: Basis Data SQLite &amp; input_data.xlsx</span>
            </span>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('import_center')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: 0,
                }}
                title="Buka Pusat Impor & Sinkronisasi Spreadsheet"
              >
                <span>Pusat Data</span>
                <ExternalLink size={10} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
