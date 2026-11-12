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
  ExternalLink,
  FileSpreadsheet,
  BarChart3,
  Gauge,
  CheckCircle2,
  Lock,
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
import { User, UserRole } from '@/lib/types';
import { useBerandaAnalytics, BerandaKpiItem } from '@/hooks/useBerandaAnalytics';
import ExecutiveKonsolidasiDashboard from './ExecutiveKonsolidasiDashboard';

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
  // Search state is reserved for the branch filter; the input lives in the header.
  const [terminalSearch] = useState<string>('');
  const [dashboardView, setDashboardView] = useState<'konsolidasi' | 'visual' | 'cards'>('konsolidasi');

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
    serviceKpis,
    financeKpis,
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
                // `UX-02`: a gradient tile with a coloured glow competed with the
                // banner text for attention and carried no information. A flat
                // accent surface with a decorative icon reads the same and does
                // not look like a button.
                backgroundColor: 'var(--blue-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue-text)',
                flexShrink: 0,
              }}
            >
              <Building2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
                {isPicCabang
                  ? `Cabang Penugasan PIC: [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}`
                  : isNone
                  ? 'Pilihan Cabang Dikosongkan (Mode Reset)'
                  : isMulti
                  ? `Filter Aktif: ${getSelectedBranchLabel(selectedTerminal)}`
                  : `Filter Aktif: [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                fontSize: '12px',
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
                    fontSize: '12px',
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
                    fontSize: '12px',
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
              fontSize: '12px',
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
            aria-pressed={verifiedOnly}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: verifiedOnly
                ? '1px solid var(--status-good-border)'
                : '1px solid var(--status-alert-border)',
              backgroundColor: verifiedOnly
                ? 'var(--status-good-bg)'
                : 'var(--status-alert-bg)',
              color: verifiedOnly ? 'var(--status-good-text)' : 'var(--status-alert-text)',
            }}
            title={
              verifiedOnly
                ? 'Menampilkan hanya data yang telah diverifikasi resmi (klik untuk menyertakan data menunggu verifikasi)'
                : 'Menampilkan seluruh data termasuk yang masih menunggu verifikasi (klik untuk memfilter hanya data terverifikasi)'
            }
          >
            <CheckCircle2 size={12} strokeWidth={1.75} aria-hidden="true" />
            {/* `COPY-05`: the old copy ("Filter: Data Terverifikasi Resmi") read as a
                status label while being a clickable toggle. State first, action
                second, and the toggle nature is exposed via aria-pressed. */}
            <span>{verifiedOnly ? 'Hanya data terverifikasi' : 'Semua status data'}</span>
            <span className="sr-only">
              {verifiedOnly
                ? 'Aktif. Klik untuk menampilkan semua status data.'
                : 'Tidak aktif. Klik untuk hanya menampilkan data terverifikasi.'}
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
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: 'var(--status-alert-text)',
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
            onClick={() => setDashboardView('konsolidasi')}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: dashboardView === 'konsolidasi' ? 700 : 500,
              backgroundColor: dashboardView === 'konsolidasi' ? 'var(--accent-blue)' : 'transparent',
              color: dashboardView === 'konsolidasi' ? 'var(--text-on-accent)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Gauge size={13} strokeWidth={1.75} />
            <span>Dashboard Konsolidasi</span>
          </button>
          <button
            type="button"
            onClick={() => setDashboardView('visual')}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: dashboardView === 'visual' ? 700 : 500,
              backgroundColor: dashboardView === 'visual' ? 'var(--accent-blue)' : 'transparent',
              color: dashboardView === 'visual' ? 'var(--text-on-accent)' : 'var(--text-muted)',
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
              fontSize: '12px',
              fontWeight: dashboardView === 'cards' ? 700 : 500,
              backgroundColor: dashboardView === 'cards' ? 'var(--accent-blue)' : 'transparent',
              color: dashboardView === 'cards' ? 'var(--text-on-accent)' : 'var(--text-muted)',
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

      {dashboardView === 'konsolidasi' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ExecutiveKonsolidasiDashboard
            selectedTerminal={selectedTerminal}
          />
        </div>
      ) : dashboardView === 'visual' ? (
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
                  <DollarSign size={16} strokeWidth={1.75} style={{ color: 'var(--accent-blue-text)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                    Kinerja Finansial (Pendapatan, Beban, Laba Usaha)
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
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
                  <Gauge size={16} strokeWidth={1.75} style={{ color: 'var(--status-good-text)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                    KPI Gauge & Kesiapan Alat (RFU)
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {g.title}
                        </span>
                        <span className={`status-badge-chip ${g.isGood ? 'status-baik' : 'status-waspada'}`} style={{ fontSize: '12px', padding: '1px 5px' }}>
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
                          <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-title)' }}>
                            {g.percentage}%
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Capaian RKAP
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
                        <div
                          className="tabular-nums"
                          style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={g.fullRealisasi || g.realisasi}
                        >
                          {g.realisasi}
                        </div>
                        <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Kinerja Layanan {isSingle ? `Cabang [${selectedTerminal}] ${activeBranch?.name || selectedTerminal}` : 'Pelabuhan Terintegrasi'} & BOR
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
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
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
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
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {s.layanan}
                    </span>
                    <span className={`status-badge-chip ${s.status === 'Baik' ? 'status-baik' : 'status-waspada'}`} style={{ fontSize: '12px', padding: '1px 4px' }}>
                      {s.status}
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)', marginTop: '2px' }}>
                    {s.nominal}
                  </div>
                  <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                    fontSize: '12px',
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
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--accent-blue-text)',
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
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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

      {/* Footer Sumber Data Utama */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FileSpreadsheet size={13} strokeWidth={1.75} color="var(--accent-blue)" />
          <span>Sumber: data pelaporan cabang Regional 4</span>
        </span>
        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('import_center')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-blue-text)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '12px',
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
  );
}
