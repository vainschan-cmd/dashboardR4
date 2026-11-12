'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { formatRupiahFull, formatRupiahCompact } from '@/lib/formatters';
import { isBranchMatch, parseSelectedBranches } from '@/lib/constants';
import {
  ENTITAS_SEMUA,
  FINANSIAL_ENTITAS_LIST,
  FINANSIAL_REKENING_LIST,
  aggregateFinansialByRekening,
  canonicalRekening,
  formatPercentOrDash,
  getMonthNameId,
  parseMetricPercent,
  parseRealisasi,
} from '@/lib/finansialHelpers';
import type { FinansialRecord, User } from '@/lib/types';

interface PortSightKeuanganProps {
  selectedTerminal?: string;
  selectedPeriod?: string;
  currentUser?: User | null;
  onOpenManualInput?: () => void;
}

const PAGE_SIZE = 60;

export default function PortSightKeuangan({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  currentUser = null,
  onOpenManualInput,
}: PortSightKeuanganProps) {
  const [data, setData] = useState<FinansialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filter 9-field standar: TAHUN, BULAN, ENTITAS, NM_CBG (+ filter opsional REKENING)
  const [tahunFilter, setTahunFilter] = useState<string>('2026');
  const [bulanFilter, setBulanFilter] = useState<string>('9');
  const [entitasFilter, setEntitasFilter] = useState<string>(ENTITAS_SEMUA);
  const [nmCbgFilter, setNmCbgFilter] = useState<string>('ALL');
  const [rekeningFilter, setRekeningFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);

  const isPicCabang =
    currentUser?.role === 'pic_cabang' &&
    Boolean(currentUser?.branch_id) &&
    currentUser?.branch_id !== 'R99';

  useEffect(() => {
    const abortController = new AbortController();
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/modules-data?includeAllFinansial=true', {
          credentials: 'include',
          signal: abortController.signal,
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.finansial)) {
          const rows: FinansialRecord[] = json.finansial;
          setData(rows);

          // Pastikan default tahun/bulan tersedia dalam dataset terbaru
          const distinctYears = Array.from(new Set(rows.map(r => r.TAHUN))).sort((a, b) => b - a);
          if (distinctYears.length > 0) {
            const preferredYear = selectedPeriod?.includes('2025')
              ? distinctYears.find(y => y === 2025) ?? distinctYears[0]
              : distinctYears[0];
            setTahunFilter(String(preferredYear));

            const monthsInYear = Array.from(
              new Set(rows.filter(r => r.TAHUN === preferredYear).map(r => r.BULAN))
            ).sort((a, b) => b - a);
            if (monthsInYear.length > 0) {
              setBulanFilter(String(monthsInYear[0]));
            }
          }
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('Error fetching finansial data:', e);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => abortController.abort();
  }, []);

  // Sinkronkan filter NM_CBG dengan dropdown Cabang pada header utama bila berubah
  useEffect(() => {
    if (isPicCabang && currentUser?.branch_id) {
      const own = data.find(r => r.KODE_CBG === currentUser.branch_id);
      setNmCbgFilter(own ? own.NM_CBG : 'ALL');
      return;
    }
    const codes = parseSelectedBranches(selectedTerminal);
    if (!selectedTerminal || selectedTerminal === 'ALL' || codes.includes('ALL')) {
      setNmCbgFilter('ALL');
    } else if (codes.length === 1) {
      const matched = data.find(r => isBranchMatch(codes[0], r.KODE_CBG, r.NM_CBG));
      setNmCbgFilter(matched ? matched.NM_CBG : 'ALL');
    } else {
      // Multi-branch dari header tetap disaring lewat headerScopeRows
      setNmCbgFilter('ALL');
    }
  }, [selectedTerminal, isPicCabang, currentUser?.branch_id, data]);

  // Sinkronkan tahun default saat header period berubah
  useEffect(() => {
    if (data.length === 0) return;
    if (selectedPeriod?.includes('2025') && data.some(r => r.TAHUN === 2025)) {
      setTahunFilter('2025');
    } else if (data.some(r => r.TAHUN === 2026)) {
      setTahunFilter('2026');
    }
  }, [selectedPeriod, data]);

  // Reset pagination ketika filter berubah
  useEffect(() => {
    setPage(1);
  }, [tahunFilter, bulanFilter, entitasFilter, nmCbgFilter, rekeningFilter, search, selectedTerminal]);

  const availableYears = useMemo(
    () => Array.from(new Set(data.map(r => r.TAHUN))).sort((a, b) => b - a),
    [data]
  );

  const availableMonths = useMemo(() => {
    const scoped = tahunFilter === 'ALL' ? data : data.filter(r => r.TAHUN === Number(tahunFilter));
    const months = Array.from(new Set(scoped.map(r => r.BULAN))).sort((a, b) => b - a);
    if (months.length > 0) return months;
    return Array.from(new Set(data.map(r => r.BULAN))).sort((a, b) => b - a);
  }, [data, tahunFilter]);

  const availableEntitas = useMemo(() => {
    const ordered = [...FINANSIAL_ENTITAS_LIST] as string[];
    const extra = Array.from(new Set(data.map(r => r.ENTITAS))).filter(e => !ordered.includes(e));
    return [...ordered, ...extra];
  }, [data]);

  const availableBranches = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data) {
      if (!map.has(r.KODE_CBG)) map.set(r.KODE_CBG, r.NM_CBG);
    }
    return Array.from(map.entries())
      .map(([kode, nama]) => ({ kode, nama }))
      .sort((a, b) => a.kode.localeCompare(b.kode));
  }, [data]);

  // Filter dasar cabang (header selectedTerminal + NM_CBG filter + RBAC)
  const branchScopedData = useMemo(() => {
    return data.filter(d => {
      if (selectedTerminal === 'NONE') return false;
      if (selectedTerminal && selectedTerminal !== 'ALL' && !isBranchMatch(selectedTerminal, d.KODE_CBG, d.NM_CBG)) {
        return false;
      }
      if (nmCbgFilter !== 'ALL' && d.NM_CBG.toLowerCase() !== nmCbgFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [data, selectedTerminal, nmCbgFilter]);

  // Filter periode + cabang (sebelum ENTITAS dipotong — dipakai untuk grafik komposisi per entitas)
  const periodAndBranchData = useMemo(() => {
    return branchScopedData.filter(d => {
      if (tahunFilter !== 'ALL' && d.TAHUN !== Number(tahunFilter)) return false;
      if (bulanFilter !== 'ALL' && d.BULAN !== Number(bulanFilter)) return false;
      return true;
    });
  }, [branchScopedData, tahunFilter, bulanFilter]);

  // Baris final setelah filter ENTITAS, REKENING, dan Search (untuk tabel & KPI)
  const filteredRows = useMemo(() => {
    const isAllEntitas = entitasFilter === ENTITAS_SEMUA || entitasFilter === 'ALL';
    const q = search.trim().toLowerCase();

    return periodAndBranchData.filter(d => {
      if (!isAllEntitas && d.ENTITAS !== entitasFilter) return false;
      if (rekeningFilter !== 'ALL' && canonicalRekening(d.REKENING) !== rekeningFilter) return false;
      if (q) {
        const hay = `${d.KODE_CBG} ${d.NM_CBG} ${d.REKENING} ${d.ENTITAS} ${d.TAHUN} ${d.BULAN}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [periodAndBranchData, entitasFilter, rekeningFilter, search]);

  // Agregasi metrik utama per REKENING (mode konsolidasi menjumlahkan seluruh entitas TERMASUK ELIMINASI)
  const kpiByRekening = useMemo(
    () => aggregateFinansialByRekening(periodAndBranchData, entitasFilter),
    [periodAndBranchData, entitasFilter]
  );

  const isConsolidationMode = entitasFilter === ENTITAS_SEMUA;
  const hasMultiPeriodSelected = tahunFilter === 'ALL' || bulanFilter === 'ALL';

  // Grafik 1: Tren Realisasi Antar Periode Tersedia (dinamis dari DB, bukan dummy statis)
  const periodTrendData = useMemo(() => {
    const periodKeys = Array.from(
      new Set(branchScopedData.map(r => `${r.TAHUN}-${String(r.BULAN).padStart(2, '0')}`))
    ).sort();

    return periodKeys.map(pk => {
      const [yStr, mStr] = pk.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const rowsInPeriod = branchScopedData.filter(r => r.TAHUN === y && r.BULAN === m);
      const agg = aggregateFinansialByRekening(rowsInPeriod, entitasFilter);
      const revM = Number((agg.Pendapatan.realisasi / 1_000_000_000).toFixed(2));
      const costM = Number((agg.Beban.realisasi / 1_000_000_000).toFixed(2));
      const opM = Number((agg['Laba Usaha'].realisasi / 1_000_000_000).toFixed(2));
      const netM = Number((agg['Laba Bersih'].realisasi / 1_000_000_000).toFixed(2));
      return {
        periode: `${getMonthNameId(m).slice(0, 3)} ${y}`,
        PendapatanM: revM,
        BebanM: costM,
        LabaUsahaM: opM,
        LabaBersihM: netM,
        pendapatanRp: agg.Pendapatan.realisasi,
        bebanRp: agg.Beban.realisasi,
        labaUsahaRp: agg['Laba Usaha'].realisasi,
        labaBersihRp: agg['Laba Bersih'].realisasi,
      };
    });
  }, [branchScopedData, entitasFilter]);

  // Grafik 2: Kontribusi Entitas & Dampak ELIMINASI untuk Periode & Cabang Aktif
  const entityBreakdownData = useMemo(() => {
    const items = availableEntitas.map(ent => {
      const agg = aggregateFinansialByRekening(periodAndBranchData, ent);
      return {
        entitas: ent,
        PendapatanM: Number((agg.Pendapatan.realisasi / 1_000_000_000).toFixed(2)),
        BebanM: Number((agg.Beban.realisasi / 1_000_000_000).toFixed(2)),
        LabaUsahaM: Number((agg['Laba Usaha'].realisasi / 1_000_000_000).toFixed(2)),
        pendapatanRp: agg.Pendapatan.realisasi,
        bebanRp: agg.Beban.realisasi,
        labaUsahaRp: agg['Laba Usaha'].realisasi,
      };
    });
    const cons = aggregateFinansialByRekening(periodAndBranchData, ENTITAS_SEMUA);
    items.push({
      entitas: 'KONSOLIDASI',
      PendapatanM: Number((cons.Pendapatan.realisasi / 1_000_000_000).toFixed(2)),
      BebanM: Number((cons.Beban.realisasi / 1_000_000_000).toFixed(2)),
      LabaUsahaM: Number((cons['Laba Usaha'].realisasi / 1_000_000_000).toFixed(2)),
      pendapatanRp: cons.Pendapatan.realisasi,
      bebanRp: cons.Beban.realisasi,
      labaUsahaRp: cons['Laba Usaha'].realisasi,
    });
    return items;
  }, [availableEntitas, periodAndBranchData]);

  // Grafik 3: Top Cabang Pelabuhan berdasarkan Realisasi Pendapatan & Laba Usaha
  const topBranchesChartData = useMemo(() => {
    const byBranch = new Map<string, FinansialRecord[]>();
    for (const r of periodAndBranchData) {
      if (!byBranch.has(r.KODE_CBG)) byBranch.set(r.KODE_CBG, []);
      byBranch.get(r.KODE_CBG)!.push(r);
    }

    return Array.from(byBranch.entries())
      .map(([kode, rows]) => {
        const agg = aggregateFinansialByRekening(rows, entitasFilter);
        const nama = rows[0]?.NM_CBG || kode;
        return {
          kode,
          name: nama.length > 13 ? `${nama.slice(0, 11)}..` : nama,
          fullName: `[${kode}] ${nama}`,
          PendapatanM: Number((agg.Pendapatan.realisasi / 1_000_000_000).toFixed(2)),
          LabaUsahaM: Number((agg['Laba Usaha'].realisasi / 1_000_000_000).toFixed(2)),
          pendapatanRp: agg.Pendapatan.realisasi,
          labaUsahaRp: agg['Laba Usaha'].realisasi,
          rkaLabel: formatPercentOrDash(agg.Pendapatan.rka),
          yoyLabel: formatPercentOrDash(agg.Pendapatan.yoy),
        };
      })
      .sort((a, b) => b.pendapatanRp - a.pendapatanRp)
      .slice(0, 8);
  }, [periodAndBranchData, entitasFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]
  );

  const handleResetFilters = () => {
    setTahunFilter(availableYears[0] ? String(availableYears[0]) : 'ALL');
    setBulanFilter(availableMonths[0] ? String(availableMonths[0]) : 'ALL');
    setEntitasFilter(ENTITAS_SEMUA);
    if (!isPicCabang) setNmCbgFilter('ALL');
    setRekeningFilter('ALL');
    setSearch('');
  };

  const summaryCardsConfig = [
    {
      rek: 'Pendapatan' as const,
      title: isConsolidationMode ? 'Pendapatan (Konsolidasi)' : `Pendapatan (${entitasFilter})`,
      accent: '#0284c7',
      icon: DollarSign,
      subtitle: 'Total pendapatan sesuai filter aktif',
    },
    {
      rek: 'Beban' as const,
      title: isConsolidationMode ? 'Beban (Konsolidasi)' : `Beban (${entitasFilter})`,
      accent: '#ef4444',
      icon: TrendingDown,
      subtitle: 'Nilai negatif pada entitas, offset ELIMINASI',
    },
    {
      rek: 'Laba Usaha' as const,
      title: isConsolidationMode ? 'Laba Usaha (Konsolidasi)' : `Laba Usaha (${entitasFilter})`,
      accent: '#10b981',
      icon: TrendingUp,
      subtitle: 'Margin laba operasional periode terpilih',
    },
    {
      rek: 'Laba Bersih' as const,
      title: isConsolidationMode ? 'Laba Bersih (Konsolidasi)' : `Laba Bersih (${entitasFilter})`,
      accent: '#a855f7',
      icon: Layers,
      subtitle: 'Setelah pajak & pos non-operasional',
    },
  ];

  const renderBadgeClass = (pct: number | string, isBebanAccount = false) => {
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
              Filter Laporan Laba Rugi (9 Field Standar)
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <span>Reset</span>
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
              onChange={e => setTahunFilter(e.target.value)}
            >
              {availableYears.map(y => (
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
              onChange={e => setBulanFilter(e.target.value)}
            >
              {availableMonths.map(m => (
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
              onChange={e => setEntitasFilter(e.target.value)}
            >
              <option value={ENTITAS_SEMUA}>Semua Entitas (Konsolidasi + ELIMINASI)</option>
              {availableEntitas.map(ent => (
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
              onChange={e => setNmCbgFilter(e.target.value)}
            >
              <option value="ALL">Semua Cabang ({availableBranches.length} Cabang)</option>
              {availableBranches.map(b => (
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
              onChange={e => setRekeningFilter(e.target.value)}
            >
              <option value="ALL">Semua Rekening (4 Akun)</option>
              {FINANSIAL_REKENING_LIST.map(rek => (
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

      {/* 4 Summary KPI Cards dikelompokkan berdasarkan REKENING */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: '16px' }}>
        {summaryCardsConfig.map(card => {
          const IconComp = card.icon;
          const agg = kpiByRekening[card.rek];
          const isCost = card.rek === 'Beban';
          return (
            <div key={card.rek} className="dark-card" style={{ borderLeft: `4px solid ${card.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-header-label">{card.title}</span>
                <IconComp size={20} color={card.accent} />
              </div>
              <div
                style={{
                  fontSize: 'clamp(20px, 1.9vw, 26px)',
                  fontWeight: 900,
                  color: 'var(--text-title)',
                  margin: '8px 0 2px',
                  letterSpacing: '-0.3px',
                }}
                title={formatRupiahFull(agg.realisasi)}
              >
                {loading ? '...' : formatRupiahCompact(agg.realisasi)}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                {loading ? 'Memuat...' : formatRupiahFull(agg.realisasi)}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${renderBadgeClass(agg.rka, isCost)}`}>
                  RKA: {formatPercentOrDash(agg.rka)}
                </span>
                <span className={`badge ${renderBadgeClass(agg.yoy, isCost)}`}>
                  YoY: {formatPercentOrDash(agg.yoy)}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{card.subtitle}</div>
            </div>
          );
        })}
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const p = props?.payload;
                    if (name === 'Pendapatan' && p) return [formatRupiahFull(p.pendapatanRp), 'Pendapatan'];
                    if (name === 'Beban' && p) return [formatRupiahFull(p.bebanRp), 'Beban'];
                    if (name === 'Laba Usaha' && p) return [formatRupiahFull(p.labaUsahaRp), 'Laba Usaha'];
                    return [`${Number(value).toLocaleString('id-ID')} M`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="PendapatanM" name="Pendapatan" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="BebanM" name="Beban" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="LabaUsahaM" name="Laba Usaha" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const p = props?.payload;
                    if (name === 'Pendapatan' && p) return [formatRupiahFull(p.pendapatanRp), 'Pendapatan'];
                    if (name === 'Beban' && p) return [formatRupiahFull(p.bebanRp), 'Beban'];
                    if (name === 'Laba Usaha' && p) return [formatRupiahFull(p.labaUsahaRp), 'Laba Usaha'];
                    return [`${Number(value).toLocaleString('id-ID')} M`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="PendapatanM" name="Pendapatan" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="BebanM" name="Beban" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="LabaUsahaM" name="Laba Usaha" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
            Sumber: data/labarugi.xlsx &amp; PostgreSQL
          </span>
        </div>

        <div style={{ height: '230px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topBranchesChartData} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit=" M" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                }}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName || ''}
                formatter={(value: any, name: any, props: any) => {
                  const p = props?.payload;
                  if (name === 'Pendapatan' && p) {
                    return [`${formatRupiahFull(p.pendapatanRp)} (RKA: ${p.rkaLabel})`, 'Pendapatan'];
                  }
                  if (name === 'Laba Usaha' && p) {
                    return [formatRupiahFull(p.labaUsahaRp), 'Laba Usaha'];
                  }
                  return [`${value} M`, name];
                }}
              />
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
              Menampilkan {pagedRows.length} dari {filteredRows.length} baris tersaring (total dataset: {data.length} baris)
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="filter-select"
              placeholder="Cari cabang / rekening / entitas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Memuat dataset finansial...
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
                  const rkaFormatted = formatPercentOrDash(r.RKA);
                  const yoyFormatted = formatPercentOrDash(r.YOY);

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
                          color: realVal < 0 ? '#ef4444' : realVal === 0 ? 'var(--text-muted)' : 'var(--text-title)',
                        }}
                      >
                        {formatRupiahFull(realVal)}
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
