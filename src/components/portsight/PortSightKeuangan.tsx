'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Layers,
  PlusCircle,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Info,
  Percent,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { formatBebanTriliun, formatRupiahFull } from '@/lib/formatters';
import { isBranchMatch, parseSelectedBranches } from '@/lib/constants';
import { formatIdDecimal2, formatIdPercent2 } from '@/lib/berandaSummary';
import {
  ENTITAS_SEMUA,
  FINANSIAL_ENTITAS_LIST,
  FINANSIAL_REKENING_LIST,
  canonicalRekening,
  getMonthNameId,
  parseMetricPercent,
  parseRealisasi,
} from '@/lib/finansialHelpers';
import type {
  FinansialEntityBreakdownPoint,
  FinansialModuleSummaryResponse,
  FinansialPeriodTrendPoint,
  FinansialTopBranchPoint,
} from '@/lib/finansialSummaryTypes';
import type { User } from '@/lib/types';

interface PortSightKeuanganProps {
  selectedTerminal?: string;
  selectedPeriod?: string;
  currentUser?: User | null;
  onOpenManualInput?: () => void;
}

interface TooltipPayloadEntry<T> {
  payload?: T;
}

interface CustomTooltipProps<T> {
  active?: boolean;
  payload?: Array<TooltipPayloadEntry<T>>;
}

const PAGE_SIZE = 60;

function formatPercentIdOrDash(val: unknown): string {
  const parsed = parseMetricPercent(val);
  if (parsed === null) return '-';
  return formatIdPercent2(parsed);
}

function PeriodTrendTooltip({ active, payload }: CustomTooltipProps<FinansialPeriodTrendPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        color: 'var(--text-main)',
        fontSize: 12,
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 6 }}>{p.periode}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#38bdf8' }}>Pendapatan</span>
        <strong>{formatRupiahFull(p.pendapatanRp)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#f87171' }}>Beban</span>
        <strong>
          {formatBebanTriliun(p.bebanRp, { includeCurrency: false })} ({formatRupiahFull(p.bebanRp)})
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#34d399' }}>Laba Usaha</span>
        <strong>{formatRupiahFull(p.labaUsahaRp)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#c084fc' }}>Laba Bersih</span>
        <strong>{formatRupiahFull(p.labaBersihRp)}</strong>
      </div>
    </div>
  );
}

function EntityBreakdownTooltip({
  active,
  payload,
}: CustomTooltipProps<FinansialEntityBreakdownPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        color: 'var(--text-main)',
        fontSize: 12,
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 6 }}>{p.entitas}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#38bdf8' }}>Pendapatan</span>
        <strong>{formatRupiahFull(p.pendapatanRp)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#f87171' }}>Beban</span>
        <strong>
          {formatBebanTriliun(p.bebanRp, { includeCurrency: false })} ({formatRupiahFull(p.bebanRp)})
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#34d399' }}>Laba Usaha</span>
        <strong>{formatRupiahFull(p.labaUsahaRp)}</strong>
      </div>
    </div>
  );
}

function TopBranchesTooltip({ active, payload }: CustomTooltipProps<FinansialTopBranchPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-dropdown)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        color: 'var(--text-main)',
        fontSize: 12,
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: 6 }}>{p.fullName}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#38bdf8' }}>Pendapatan</span>
        <strong>
          {formatRupiahFull(p.pendapatanRp)} (RKA: {p.rkaLabel})
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ color: '#34d399' }}>Laba Usaha</span>
        <strong>{formatRupiahFull(p.labaUsahaRp)}</strong>
      </div>
    </div>
  );
}

export default function PortSightKeuangan({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  currentUser = null,
  onOpenManualInput,
}: PortSightKeuanganProps) {
  const isBodViewer = currentUser?.role === 'viewer';
  const picBranchId = currentUser?.branch_id || '';
  const isPicCabang =
    currentUser?.role === 'pic_cabang' && Boolean(picBranchId) && picBranchId !== 'R99';

  // Filter 9-field standar diselaraskan ke default yang sama dengan Beranda: Tahun 2026, Bulan 8
  const [initialHeaderPeriod] = useState<string>(() => selectedPeriod);
  const [periodOverride, setPeriodOverride] = useState<{
    headerBase: string;
    tahun: string;
    bulan: string;
  } | null>(null);
  const [entitasFilter, setEntitasFilter] = useState<string>(ENTITAS_SEMUA);
  const [nmCbgOverride, setNmCbgOverride] = useState<{
    terminalKey: string;
    value: string;
  } | null>(null);
  const [rekeningFilter, setRekeningFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [verifiedOverride, setVerifiedOverride] = useState<{
    roleKey: string;
    value: boolean;
  } | null>(null);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({
    key: '',
    page: 1,
  });

  const [summary, setSummary] = useState<FinansialModuleSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnceRef = useRef<boolean>(false);

  // Debounce query search agar panggilan PostgreSQL ringan saat mengetik
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);

  const roleKey = currentUser?.role ?? 'anonymous';
  const verifiedOnly = isBodViewer
    ? true
    : verifiedOverride && verifiedOverride.roleKey === roleKey
      ? verifiedOverride.value
      : false;

  const derivedHeaderPeriod = useMemo(() => {
    if (selectedPeriod === initialHeaderPeriod) {
      return { tahun: '2026', bulan: '8' };
    }
    const p = selectedPeriod.toUpperCase();
    if (p.includes('2025')) return { tahun: '2025', bulan: '9' };
    if (p.includes('JUN 2026')) return { tahun: '2026', bulan: '8' };
    if (p.includes('AGS 2026') || p.includes('AGUSTUS 2026')) return { tahun: '2026', bulan: '8' };
    if (p.includes('SEP 2026')) return { tahun: '2026', bulan: '9' };
    return { tahun: '2026', bulan: '8' };
  }, [selectedPeriod, initialHeaderPeriod]);

  const tahunFilter =
    periodOverride && periodOverride.headerBase === selectedPeriod
      ? periodOverride.tahun
      : derivedHeaderPeriod.tahun;

  const bulanFilter =
    periodOverride && periodOverride.headerBase === selectedPeriod
      ? periodOverride.bulan
      : derivedHeaderPeriod.bulan;

  const availableBranches = useMemo(
    () => summary?.filters.availableBranches ?? [],
    [summary]
  );
  const assignedBranchName = summary?.filters.assignedBranchName;

  const nmCbgFilter = useMemo(() => {
    if (isPicCabang && assignedBranchName) {
      return assignedBranchName;
    }
    if (!isPicCabang && nmCbgOverride && nmCbgOverride.terminalKey === selectedTerminal) {
      return nmCbgOverride.value;
    }
    const codes = parseSelectedBranches(selectedTerminal);
    if (
      selectedTerminal &&
      selectedTerminal !== 'ALL' &&
      !codes.includes('ALL') &&
      codes.length === 1 &&
      availableBranches.length > 0
    ) {
      const matched = availableBranches.find((b) => isBranchMatch(codes[0], b.kode, b.nama));
      if (matched) return matched.nama;
    }
    return 'ALL';
  }, [
    isPicCabang,
    assignedBranchName,
    nmCbgOverride,
    selectedTerminal,
    availableBranches,
  ]);

  const filterResetKey = [
    tahunFilter,
    bulanFilter,
    entitasFilter,
    nmCbgFilter,
    rekeningFilter,
    debouncedSearch,
    selectedTerminal,
  ].join('|');

  // Fetch data langsung dari PostgreSQL Single Source of Truth (/api/finansial-summary)
  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchFinansialSummary() {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('tahun', tahunFilter);
        params.set('bulan', bulanFilter);
        params.set('entitas', entitasFilter);
        params.set('rekening', rekeningFilter);
        params.set('verifiedOnly', String(verifiedOnly));

        if (!isPicCabang) {
          if (nmCbgFilter && nmCbgFilter !== 'ALL') {
            params.set('nmCbg', nmCbgFilter);
          } else if (selectedTerminal && selectedTerminal !== 'ALL') {
            params.set('branchCode', selectedTerminal);
          }
        } else if (picBranchId) {
          params.set('branchCode', picBranchId);
        }

        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }

        const res = await fetch(`/api/finansial-summary?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error || `HTTP ${res.status}`);
        }

        const json = (await res.json()) as FinansialModuleSummaryResponse;
        if (!isActive) return;

        hasLoadedOnceRef.current = true;
        setSummary(json);
      } catch (err) {
        if (!isActive || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Gagal memuat data Finansial dari PostgreSQL');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchFinansialSummary();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    tahunFilter,
    bulanFilter,
    entitasFilter,
    nmCbgFilter,
    rekeningFilter,
    debouncedSearch,
    verifiedOnly,
    isPicCabang,
    picBranchId,
    selectedTerminal,
  ]);

  const availableYears = useMemo(
    () => summary?.filters.availableYears ?? [2026, 2025],
    [summary]
  );
  const availableMonths = useMemo(
    () => summary?.filters.availableMonths ?? [8, 9],
    [summary]
  );
  const availableEntitas = useMemo(
    () => summary?.filters.availableEntitas ?? ([...FINANSIAL_ENTITAS_LIST] as string[]),
    [summary]
  );

  const rows = useMemo(() => summary?.rows ?? [], [summary]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const rawPage = pageState.key === filterResetKey ? pageState.page : 1;
  const page = Math.min(rawPage, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const isConsolidationMode = entitasFilter === ENTITAS_SEMUA;
  const hasMultiPeriodSelected = tahunFilter === 'ALL' || bulanFilter === 'ALL';

  const handleResetFilters = () => {
    setPeriodOverride({
      headerBase: selectedPeriod,
      tahun: '2026',
      bulan: '8',
    });
    setEntitasFilter(ENTITAS_SEMUA);
    if (!isPicCabang) {
      setNmCbgOverride({ terminalKey: selectedTerminal, value: 'ALL' });
    }
    setRekeningFilter('ALL');
    setSearch('');
  };

  const kpis = summary?.kpis;
  const periodTrendData = summary?.charts.periodTrend ?? [];
  const entityBreakdownData = summary?.charts.entityBreakdown ?? [];
  const topBranchesChartData = summary?.charts.topBranches ?? [];

  const summaryCardsConfig = [
    {
      key: 'Pendapatan' as const,
      metric: kpis?.pendapatan,
      title: isConsolidationMode ? 'Pendapatan (Konsolidasi)' : `Pendapatan (${entitasFilter})`,
      accent: '#0284c7',
      icon: DollarSign,
      subtitle: 'Total pendapatan sesuai filter aktif',
      isCost: false,
    },
    {
      key: 'Beban' as const,
      metric: kpis?.beban,
      title: isConsolidationMode ? 'Beban (Konsolidasi)' : `Beban (${entitasFilter})`,
      accent: '#ef4444',
      icon: TrendingDown,
      subtitle: isConsolidationMode
        ? 'Total seluruh entitas termasuk ELIMINASI'
        : `Total Beban entitas ${entitasFilter}`,
      isCost: true,
    },
    {
      key: 'Laba Usaha' as const,
      metric: kpis?.labaUsaha,
      title: isConsolidationMode ? 'Laba Usaha (Konsolidasi)' : `Laba Usaha (${entitasFilter})`,
      accent: '#10b981',
      icon: TrendingUp,
      subtitle: 'Margin laba operasional periode terpilih',
      isCost: false,
    },
    {
      key: 'Laba Bersih' as const,
      metric: kpis?.labaBersih,
      title: isConsolidationMode ? 'Laba Bersih (Konsolidasi)' : `Laba Bersih (${entitasFilter})`,
      accent: '#a855f7',
      icon: Layers,
      subtitle: 'Setelah pajak & pos non-operasional',
      isCost: false,
    },
  ];

  const renderBadgeClass = (pct: number | string | null | undefined, isBebanAccount = false) => {
    const parsed = parseMetricPercent(pct);
    if (parsed === null) return 'badge-neutral';
    if (isBebanAccount) return parsed <= 105 ? 'badge-green' : 'badge-yellow';
    return parsed >= 100 ? 'badge-green' : parsed >= 95 ? 'badge-yellow' : 'badge-red';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Filter Bar Utama 9-Field Finansial */}
      <div className="dark-card" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={16} color="#0284c7" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
              Filter Laporan Laba Rugi (9 Field Standar — PostgreSQL SSOT)
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: isConsolidationMode ? 'rgba(16, 185, 129, 0.14)' : 'rgba(2, 132, 199, 0.14)',
                color: isConsolidationMode ? '#10b981' : '#0284c7',
                border: `1px solid ${isConsolidationMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(2, 132, 199, 0.35)'}`,
              }}
            >
              {isConsolidationMode
                ? 'Mode Konsolidasi: Semua Entitas (termasuk ELIMINASI)'
                : `Mode Entitas Tunggal: ${entitasFilter}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!isBodViewer && kpis?.verificationSummary && (
              <button
                type="button"
                onClick={() => setVerifiedOverride({ roleKey, value: !verifiedOnly })}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: verifiedOnly
                    ? '1px solid rgba(16, 185, 129, 0.45)'
                    : '1px solid var(--border-subtle)',
                  color: verifiedOnly ? '#10b981' : 'var(--text-secondary)',
                }}
              >
                <ShieldCheck size={13} />
                <span>{verifiedOnly ? 'Hanya Terverifikasi' : 'Semua Status'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                fontSize: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              <span>Reset (2026 Ags)</span>
            </button>
            {onOpenManualInput && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Input data manual finansial"
              >
                <PlusCircle size={13} />
                <span>Input Manual</span>
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '10px',
          }}
        >
          {/* TAHUN */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              TAHUN
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={tahunFilter}
              onChange={(e) =>
                setPeriodOverride({
                  headerBase: selectedPeriod,
                  tahun: e.target.value,
                  bulan: bulanFilter,
                })
              }
            >
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
              <option value="ALL">Semua Tahun</option>
            </select>
          </div>

          {/* BULAN */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              BULAN
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={bulanFilter}
              onChange={(e) =>
                setPeriodOverride({
                  headerBase: selectedPeriod,
                  tahun: tahunFilter,
                  bulan: e.target.value,
                })
              }
            >
              {availableMonths.map((m) => (
                <option key={m} value={String(m)}>
                  {m} — {getMonthNameId(m)}
                </option>
              ))}
              <option value="ALL">Semua Bulan</option>
            </select>
          </div>

          {/* ENTITAS */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              ENTITAS
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={entitasFilter}
              onChange={(e) => setEntitasFilter(e.target.value)}
            >
              <option value={ENTITAS_SEMUA}>Semua Entitas (Konsolidasi + ELIMINASI)</option>
              {availableEntitas.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* NM_CBG */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              NM_CBG (Cabang Pelabuhan)
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={nmCbgFilter}
              disabled={isPicCabang}
              onChange={(e) =>
                setNmCbgOverride({ terminalKey: selectedTerminal, value: e.target.value })
              }
            >
              <option value="ALL">Semua Cabang ({availableBranches.length} Cabang)</option>
              {availableBranches.map((b) => (
                <option key={b.kode} value={b.nama}>
                  [{b.kode}] {b.nama}
                </option>
              ))}
            </select>
          </div>

          {/* REKENING */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              REKENING (Tabel)
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={rekeningFilter}
              onChange={(e) => setRekeningFilter(e.target.value)}
            >
              <option value="ALL">Semua Rekening (4 Akun)</option>
              {FINANSIAL_REKENING_LIST.map((rek) => (
                <option key={rek} value={rek}>
                  {rek}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasMultiPeriodSelected && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#f59e0b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} />
            <span>
              Anda memilih &quot;Semua Tahun&quot; atau &quot;Semua Bulan&quot;. Kartu KPI menjumlahkan seluruh snapshot periode terpilih; pilih satu TAHUN dan satu BULAN untuk angka YTD periode tunggal.
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* 5 Summary KPI Cards dari PostgreSQL SSOT (4 Akun + BOPO Konsolidasi) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '14px' }}>
        {summaryCardsConfig.map((card) => {
          const IconComp = card.icon;
          const m = card.metric;
          return (
            <div key={card.key} className="dark-card" style={{ borderLeft: `4px solid ${card.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-header-label">{card.title}</span>
                <IconComp size={20} color={card.accent} />
              </div>
              <div
                style={{
                  fontSize: 'clamp(20px, 1.8vw, 25px)',
                  fontWeight: 900,
                  color: card.isCost ? '#f97316' : 'var(--text-title)',
                  margin: '8px 0 2px',
                  letterSpacing: '-0.3px',
                  fontVariantNumeric: 'tabular-nums',
                }}
                title={
                  m
                    ? card.isCost
                      ? `${formatBebanTriliun(m.realisasi, { includeCurrency: false })} (${m.formattedFull})`
                      : m.formattedFull
                    : card.isCost
                      ? 'Rp 0,00 T'
                      : 'Rp 0'
                }
              >
                {loading && !kpis ? '...' : m?.formatted ?? (card.isCost ? 'Rp 0,00 T' : 'Rp 0')}
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  marginBottom: '8px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {loading && !kpis ? 'Memuat...' : m?.formattedFull ?? 'Rp 0'}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${renderBadgeClass(m?.rka, card.isCost)}`}>
                  RKA: {m?.rka !== null && m?.rka !== undefined ? `${formatIdDecimal2(m.rka)}%` : '-'}
                </span>
                <span className={`badge ${renderBadgeClass(m?.yoy, card.isCost)}`}>
                  YoY: {m?.yoy !== null && m?.yoy !== undefined ? `${formatIdDecimal2(m.yoy)}%` : '-'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{card.subtitle}</div>
            </div>
          );
        })}

        {/* Kartu BOPO tersinkron dengan Beranda */}
        <div
          className="dark-card"
          style={{
            background: 'linear-gradient(135deg, #09204e 0%, #0f3070 100%)',
            borderColor: '#1e40af',
            borderLeft: '4px solid #facc15',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase' }}>
              BOPO {isConsolidationMode ? '(Konsolidasi)' : `(${entitasFilter})`}
            </span>
            <Percent size={20} color="#facc15" />
          </div>
          <div
            style={{
              fontSize: 'clamp(24px, 2.2vw, 30px)',
              fontWeight: 900,
              color: '#facc15',
              margin: '8px 0 4px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {loading && !kpis ? '...' : kpis?.bopo.formatted ?? '0,00%'}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
            ABS(Total Beban) / Total Pendapatan × 100%
          </div>
        </div>
      </div>

      {/* Row Charts: Tren Antar Periode & Komposisi Entitas + Eliminasi */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
        {/* Chart 1: Tren Kinerja per Periode */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="dark-card-title" style={{ margin: 0 }}>
                Perbandingan Kinerja per Periode (Miliar Rp)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isConsolidationMode ? 'Konsolidasi (termasuk ELIMINASI)' : `Entitas ${entitasFilter}`} •{' '}
                {nmCbgFilter === 'ALL' ? 'Semua Cabang' : nmCbgFilter}
              </div>
            </div>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodTrendData} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="periode" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit=" M" />
                <ReferenceLine y={0} stroke="var(--border-subtle)" />
                <Tooltip content={<PeriodTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="PendapatanM" name="Pendapatan" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="BebanM" name="Beban" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="LabaUsahaM" name="Laba Usaha" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ringkasan beban per periode selalu dalam Triliun (T) */}
          {periodTrendData.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>
                Total Beban per Periode (T):
              </span>
              {periodTrendData.map((entry) => (
                <span
                  key={entry.periode}
                  title={`${entry.periode}: ${formatRupiahFull(entry.bebanRp)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontVariantNumeric: 'tabular-nums',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-subtle, rgba(148, 163, 184, 0.08))',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{entry.periode}:</span>
                  <span>{formatBebanTriliun(entry.bebanRp, { includeCurrency: false })}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chart 2: Breakdown per Entitas & Dampak Eliminasi */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="dark-card-title" style={{ margin: 0 }}>
                Kontribusi Entitas &amp; Eliminasi (Miliar Rp)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Sum seluruh ENTITAS termasuk ELIMINASI = Konsolidasi Bersih
              </div>
            </div>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityBreakdownData} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="entitas" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit=" M" />
                <ReferenceLine y={0} stroke="var(--border-subtle)" />
                <Tooltip content={<EntityBreakdownTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="PendapatanM" name="Pendapatan" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="BebanM" name="Beban" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="LabaUsahaM" name="Laba Usaha" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ringkasan beban per entitas & konsolidasi selalu dalam Triliun (T) */}
          {entityBreakdownData.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>
                Ringkasan Beban (T):
              </span>
              {entityBreakdownData.map((entry) => {
                const isCons = entry.entitas === 'KONSOLIDASI';
                return (
                  <span
                    key={entry.entitas}
                    title={`${entry.entitas}: ${formatRupiahFull(entry.bebanRp)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontVariantNumeric: 'tabular-nums',
                      border: isCons
                        ? '1px solid rgba(239, 68, 68, 0.45)'
                        : '1px solid var(--border-subtle)',
                      backgroundColor: isCons
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'var(--bg-subtle, rgba(148, 163, 184, 0.08))',
                      fontWeight: isCons ? 800 : 600,
                      color: isCons ? '#ef4444' : 'var(--text-secondary)',
                    }}
                  >
                    <span>{entry.entitas}:</span>
                    <span>{formatBebanTriliun(entry.bebanRp, { includeCurrency: false })}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Cabang Pelabuhan */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Top Cabang Pelabuhan — Pendapatan &amp; Laba Usaha (Miliar Rp)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Peringkat kontribusi cabang berdasarkan filter TAHUN / BULAN / ENTITAS aktif
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
            Sumber: PostgreSQL (module_finansial)
          </span>
        </div>

        <div style={{ height: '230px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topBranchesChartData} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit=" M" />
              <Tooltip content={<TopBranchesTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="PendapatanM" name="Pendapatan" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="LabaUsahaM" name="Laba Usaha" radius={[4, 4, 0, 0]}>
                {topBranchesChartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.LabaUsahaM >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabel Rekapitulasi 9 Field Standar */}
      <div className="dark-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Rincian Laba Rugi (9 Field Standar)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Menampilkan {pagedRows.length} dari {rows.length} baris tersaring (total dataset:{' '}
              {summary?.filters.totalDatasetRows ?? 0} baris)
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="filter-select"
              placeholder="Cari cabang / rekening / entitas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', width: '250px' }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th>TAHUN</th>
                <th>BULAN</th>
                <th>KODE_CBG</th>
                <th>NM_CBG</th>
                <th>REKENING</th>
                <th>ENTITAS</th>
                <th style={{ textAlign: 'right' }}>REALISASI (Rp)</th>
                <th style={{ textAlign: 'center' }}>RKA</th>
                <th style={{ textAlign: 'center' }}>YOY</th>
              </tr>
            </thead>
            <tbody>
              {loading && !summary ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Memuat dataset finansial dari PostgreSQL...
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Tidak ada baris finansial yang sesuai filter.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r, i) => {
                  const realVal = parseRealisasi(r.REALISASI);
                  const isCost = canonicalRekening(r.REKENING) === 'Beban';
                  const rkaFormatted = formatPercentIdOrDash(r.RKA);
                  const yoyFormatted = formatPercentIdOrDash(r.YOY);

                  return (
                    <tr key={r.id || `${r.TAHUN}-${r.BULAN}-${r.KODE_CBG}-${r.REKENING}-${r.ENTITAS}-${i}`}>
                      <td>{r.TAHUN}</td>
                      <td>{r.BULAN}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0284c7' }}>
                        {r.KODE_CBG}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.NM_CBG}</td>
                      <td
                        style={{
                          fontWeight: 600,
                          color: isCost
                            ? '#ef4444'
                            : r.REKENING.includes('Laba')
                              ? '#10b981'
                              : '#0284c7',
                        }}
                      >
                        {r.REKENING}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.ENTITAS === 'ELIMINASI'
                              ? 'badge-red'
                              : r.ENTITAS === 'CABANG'
                                ? 'badge-blue'
                                : 'badge-neutral'
                          }`}
                        >
                          {r.ENTITAS}
                        </span>
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                          color: realVal < 0 ? '#ef4444' : realVal === 0 ? 'var(--text-muted)' : 'var(--text-title)',
                        }}
                        title={
                          isCost
                            ? `${formatBebanTriliun(realVal)} • ${formatRupiahFull(realVal)}`
                            : formatRupiahFull(realVal)
                        }
                      >
                        <div>{formatRupiahFull(realVal)}</div>
                        {isCost && (
                          <div
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {formatBebanTriliun(realVal, { includeCurrency: false })}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${renderBadgeClass(r.RKA, isCost)}`}>{rkaFormatted}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${renderBadgeClass(r.YOY, isCost)}`}>{yoyFormatted}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() =>
                  setPageState({ key: filterResetKey, page: Math.max(1, page - 1) })
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() =>
                  setPageState({ key: filterResetKey, page: Math.min(totalPages, page + 1) })
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                <span>Berikutnya</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
