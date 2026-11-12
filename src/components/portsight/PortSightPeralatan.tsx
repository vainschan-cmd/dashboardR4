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
  LabelList,
} from 'recharts';
import {
  Cog,
  Wrench,
  Search,
  Layers,
  PlusCircle,
  Filter,
  RotateCcw,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { isBranchMatch, parseSelectedBranches } from '@/lib/constants';
import {
  PERALATAN_ENTITAS_COLORS,
  PERALATAN_ENTITAS_LIST,
  aggregatePeralatanKpis,
  buildBreakdownByJenisChart,
  displayNullableText,
  formatTanggalID,
  normalizeGrupEntitas,
  normalizeKondisi,
  resolvePeralatanBranchCode,
} from '@/lib/peralatanHelpers';
import type { PeralatanGrupEntitas, PeralatanRecord, User } from '@/lib/types';

interface EquipmentCatalogItem {
  code: string;
  name: string;
  acronym: string;
  category: string;
}

interface PortSightPeralatanProps {
  selectedTerminal?: string;
  currentUser?: User | null;
  onOpenManualInput?: () => void;
}

interface SegmentLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | boolean | null;
}

const PAGE_SIZE = 50;

function renderSegmentValueLabel(props: SegmentLabelProps) {
  const numericVal = Number(props.value ?? 0);
  if (!Number.isFinite(numericVal) || numericVal <= 0) {
    return null;
  }
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  if (width < 6) {
    return null;
  }
  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 1}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={800}
      style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
    >
      {numericVal}
    </text>
  );
}

function getKondisiBadgeStyle(kondisi: string): { badgeClass: string; shortLabel: string } {
  const norm = normalizeKondisi(kondisi);
  if (norm === 'READY') return { badgeClass: 'badge-green', shortLabel: 'READY' };
  if (norm === 'READY DENGAN CATATAN') {
    return { badgeClass: 'badge-yellow', shortLabel: 'READY DENGAN CATATAN' };
  }
  if (norm === 'BREAKDOWN') return { badgeClass: 'badge-red', shortLabel: 'BREAKDOWN' };
  if (norm === 'USUL/PROSES PENGHAPUSAN') {
    return { badgeClass: 'badge-purple', shortLabel: 'USUL/PROSES PENGHAPUSAN' };
  }
  return { badgeClass: 'badge-neutral', shortLabel: norm || '-' };
}

function getEntitasBadgeStyle(entitas: string): { bg: string; fg: string; border: string } {
  const norm = normalizeGrupEntitas(entitas) as PeralatanGrupEntitas;
  if (norm === 'MTI') return { bg: 'rgba(37, 99, 235, 0.16)', fg: 'var(--accent-blue-text)', border: 'rgba(37, 99, 235, 0.45)' };
  if (norm === 'PMT') return { bg: 'rgba(16, 185, 129, 0.16)', fg: 'var(--status-good-text)', border: 'rgba(16, 185, 129, 0.45)' };
  if (norm === 'PTP') return { bg: 'rgba(249, 115, 22, 0.16)', fg: 'var(--accent-orange-text)', border: 'rgba(249, 115, 22, 0.45)' };
  if (norm === 'R4') return { bg: 'rgba(147, 51, 234, 0.16)', fg: 'var(--series-purple-text)', border: 'rgba(147, 51, 234, 0.45)' };
  return { bg: 'var(--bg-inner)', fg: 'var(--text-secondary)', border: 'var(--border-subtle)' };
}

export default function PortSightPeralatan({
  selectedTerminal = 'ALL',
  currentUser = null,
  onOpenManualInput,
}: PortSightPeralatanProps) {
  const [data, setData] = useState<PeralatanRecord[]>([]);
  const [catalog, setCatalog] = useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'katalog'>('monitoring');

  // Sidebar & Table Filters
  const [tanggalFilter, setTanggalFilter] = useState<string>('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // empty = Semua Cabang
  const [branchSearch, setBranchSearch] = useState<string>('');
  const [entitasFilter, setEntitasFilter] = useState<string>('ALL');
  const [kategoriFilter, setKategoriFilter] = useState<string>('ALL');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');
  const [kondisiFilter, setKondisiFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
        const res = await fetch('/api/modules-data?includeAllPeralatan=true', {
          credentials: 'include',
          signal: abortController.signal,
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.peralatan)) {
          const rows: PeralatanRecord[] = json.peralatan;
          setData(rows);
          setCatalog(Array.isArray(json.equipmentCatalog) ? json.equipmentCatalog : []);

          const dates = Array.from(new Set(rows.map((r) => r.tanggal).filter(Boolean)))
            .sort()
            .reverse();
          if (dates.length > 0) {
            setTanggalFilter((prev) => (prev && (prev === 'ALL' || dates.includes(prev)) ? prev : dates[0]));
          }
        }
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== 'AbortError') {
          console.error('Error fetching peralatan data:', e);
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

  const picBranchId = currentUser?.branch_id || '';

  // Data scope terkunci oleh header cabang (selectedTerminal) dan role PIC Cabang
  const headerScopedRows = useMemo(() => {
    if (isPicCabang && picBranchId) {
      return data.filter((r) => {
        const code = r.branchCode || resolvePeralatanBranchCode(r.nama_cabang);
        return code === picBranchId;
      });
    }
    if (!selectedTerminal || selectedTerminal === 'ALL') return data;
    if (selectedTerminal === 'NONE') return [];
    return data.filter((r) =>
      isBranchMatch(selectedTerminal, r.branchCode || resolvePeralatanBranchCode(r.nama_cabang), r.nama_cabang)
    );
  }, [data, isPicCabang, picBranchId, selectedTerminal]);

  // Daftar tanggal tersedia (terbaru di atas) + info jumlah unit per tanggal
  const dateOptions = useMemo(() => {
    const counts = new Map<string, { count: number; entities: Set<string> }>();
    for (const r of headerScopedRows) {
      if (!r.tanggal) continue;
      const entry = counts.get(r.tanggal) || { count: 0, entities: new Set<string>() };
      entry.count++;
      if (r.grup_entitas) entry.entities.add(normalizeGrupEntitas(r.grup_entitas));
      counts.set(r.tanggal, entry);
    }
    return Array.from(counts.entries())
      .map(([tanggal, meta]) => ({
        tanggal,
        count: meta.count,
        entities: Array.from(meta.entities).sort(),
      }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [headerScopedRows]);

  // Filter berdasarkan Tanggal terlebih dahulu
  const dateScopedRows = useMemo(() => {
    if (!tanggalFilter || tanggalFilter === 'ALL') return headerScopedRows;
    return headerScopedRows.filter((r) => r.tanggal === tanggalFilter);
  }, [headerScopedRows, tanggalFilter]);

  const activeDateMeta = useMemo(
    () => dateOptions.find((d) => d.tanggal === tanggalFilter) || null,
    [dateOptions, tanggalFilter]
  );

  // Daftar Nama Cabang unik (urut alfabet) dengan jumlah unit pada tanggal aktif
  const cabangOptions = useMemo(() => {
    const countOnDate = new Map<string, number>();
    const allNames = new Set<string>();
    for (const r of headerScopedRows) {
      if (r.nama_cabang) allNames.add(r.nama_cabang);
    }
    for (const r of dateScopedRows) {
      if (r.nama_cabang) {
        countOnDate.set(r.nama_cabang, (countOnDate.get(r.nama_cabang) || 0) + 1);
      }
    }
    return Array.from(allNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        countOnDate: countOnDate.get(name) || 0,
      }))
      .filter((item) => !branchSearch.trim() || item.name.toLowerCase().includes(branchSearch.toLowerCase()));
  }, [headerScopedRows, dateScopedRows, branchSearch]);

  // Sinkronkan multi-select cabang bila header dropdown berubah menjadi spesifik cabang
  const effectiveBranches = useMemo(() => {
    if (isPicCabang && currentUser?.branch_id) {
      return [];
    }
    const headerCodes = parseSelectedBranches(selectedTerminal);
    if (selectedTerminal && selectedTerminal !== 'ALL' && !headerCodes.includes('ALL')) {
      return [];
    }
    return selectedBranches;
  }, [isPicCabang, currentUser?.branch_id, selectedTerminal, selectedBranches]);

  const kategoriOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dateScopedRows) {
      if (r.kategori_alat) set.add(r.kategori_alat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dateScopedRows]);

  const jenisOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dateScopedRows) {
      if (r.jenis_alat) set.add(r.jenis_alat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dateScopedRows]);

  // Baris setelah menerapkan seluruh Sidebar Filter (Tanggal, Cabang, Entitas, Kategori, Jenis)
  const sidebarFilteredRows = useMemo(() => {
    return dateScopedRows.filter((r) => {
      if (effectiveBranches.length > 0 && !effectiveBranches.includes(r.nama_cabang)) {
        return false;
      }
      if (entitasFilter !== 'ALL' && normalizeGrupEntitas(r.grup_entitas) !== entitasFilter) {
        return false;
      }
      if (kategoriFilter !== 'ALL' && r.kategori_alat !== kategoriFilter) {
        return false;
      }
      if (jenisFilter !== 'ALL' && r.jenis_alat !== jenisFilter) {
        return false;
      }
      return true;
    });
  }, [dateScopedRows, effectiveBranches, entitasFilter, kategoriFilter, jenisFilter]);

  // 5 KPI Cards dihitung dari sidebarFilteredRows
  const kpiSummary = useMemo(() => aggregatePeralatanKpis(sidebarFilteredRows), [sidebarFilteredRows]);

  // Stacked Horizontal Bar Chart Data (BREAKDOWN per Jenis Alat, stacked by Grup / Entitas)
  const breakdownChartData = useMemo(
    () => buildBreakdownByJenisChart(sidebarFilteredRows),
    [sidebarFilteredRows]
  );

  // Tabel Detail Monitoring di bawah grafik (menerapkan klik KPI Kondisi + Pencarian Teks)
  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sidebarFilteredRows.filter((r) => {
      if (kondisiFilter !== 'ALL' && normalizeKondisi(r.kondisi) !== kondisiFilter) {
        return false;
      }
      if (q) {
        const hay = `${r.tanggal} ${r.grup_entitas} ${r.nama_cabang} ${r.nama_alat} ${r.jenis_alat} ${r.kategori_alat} ${r.kondisi} ${r.kerusakan || ''} ${r.tindak_lanjut || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sidebarFilteredRows, kondisiFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => tableRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [tableRows, safePage]
  );

  const toggleBranchSelection = (branchName: string) => {
    setPage(1);
    setSelectedBranches((prev) =>
      prev.includes(branchName) ? prev.filter((b) => b !== branchName) : [...prev, branchName]
    );
  };

  const handleToggleKondisiKpi = (targetKondisi: string) => {
    setPage(1);
    setKondisiFilter((prev) => (prev === targetKondisi ? 'ALL' : targetKondisi));
  };

  const handleResetFilters = () => {
    setTanggalFilter(dateOptions[0]?.tanggal || 'ALL');
    setSelectedBranches([]);
    setBranchSearch('');
    setEntitasFilter('ALL');
    setKategoriFilter('ALL');
    setJenisFilter('ALL');
    setKondisiFilter('ALL');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters =
    effectiveBranches.length > 0 ||
    entitasFilter !== 'ALL' ||
    kategoriFilter !== 'ALL' ||
    jenisFilter !== 'ALL' ||
    kondisiFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const kpiCards = [
    {
      key: 'ALL',
      label: 'Total Alat',
      count: kpiSummary.total,
      pctText: kpiSummary.total > 0 ? `RFU ${kpiSummary.rfuPct}%` : '0 unit',
      accent: 'var(--accent-blue-text)',
      iconBg: 'rgba(59, 130, 246, 0.16)',
      activeBg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      key: 'READY',
      label: 'Ready',
      count: kpiSummary.ready,
      pctText: kpiSummary.total > 0 ? `${((kpiSummary.ready / kpiSummary.total) * 100).toFixed(1)}% dari total` : '0%',
      accent: 'var(--status-good-text)',
      iconBg: 'rgba(16, 185, 129, 0.16)',
      activeBg: 'rgba(16, 185, 129, 0.12)',
    },
    {
      key: 'READY DENGAN CATATAN',
      label: 'Ready Dgn Catatan',
      count: kpiSummary.readyDenganCatatan,
      pctText:
        kpiSummary.total > 0
          ? `${((kpiSummary.readyDenganCatatan / kpiSummary.total) * 100).toFixed(1)}% dari total`
          : '0%',
      accent: 'var(--status-alert-text)',
      iconBg: 'rgba(245, 158, 11, 0.16)',
      activeBg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      key: 'USUL/PROSES PENGHAPUSAN',
      label: 'Usul/Proses',
      count: kpiSummary.usulPenghapusan,
      pctText:
        kpiSummary.total > 0
          ? `${((kpiSummary.usulPenghapusan / kpiSummary.total) * 100).toFixed(1)}% dari total`
          : '0%',
      accent: 'var(--series-purple-text)',
      iconBg: 'rgba(168, 85, 247, 0.16)',
      activeBg: 'rgba(168, 85, 247, 0.12)',
    },
    {
      key: 'BREAKDOWN',
      label: 'Breakdown',
      count: kpiSummary.breakdown,
      pctText:
        kpiSummary.total > 0 ? `${((kpiSummary.breakdown / kpiSummary.total) * 100).toFixed(1)}% dari total` : '0%',
      accent: 'var(--status-danger-text)',
      iconBg: 'rgba(239, 68, 68, 0.16)',
      activeBg: 'rgba(239, 68, 68, 0.12)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Sub-Navigation & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div className="tabs-nav" style={{ marginBottom: 0 }}>
          <button
            type="button"
            onClick={() => setActiveTab('monitoring')}
            className={`tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
          >
            <Wrench size={15} />
            <span>Dashboard Monitoring Alat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('katalog')}
            className={`tab-btn ${activeTab === 'katalog' ? 'active' : ''}`}
          >
            <Layers size={15} />
            <span>Master Katalog Peralatan ({catalog.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            Tanggal Aktif:{' '}
            <strong style={{ color: 'var(--text-title)' }}>
              {tanggalFilter === 'ALL' ? 'Semua Tanggal' : formatTanggalID(tanggalFilter)}
            </strong>{' '}
            · {kpiSummary.total.toLocaleString('id-ID')} Unit
          </span>

          {onOpenManualInput && (
            <button
              type="button"
              onClick={onOpenManualInput}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--series-purple-fill)',
                borderColor: 'var(--series-purple-fill)',
                color: 'var(--text-on-accent)',
                padding: '7px 14px',
                fontSize: '12.5px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} />
              <span>Input Manual Alat</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'monitoring' && (
        <div className="peralatan-workspace-layout">
          {/* SIDEBAR FILTER PANEL */}
          <aside className="peralatan-filter-sidebar dark-card" style={{ padding: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} color="var(--accent-cyan)" />
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-title)' }}>
                  Filter Peralatan
                </span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--accent-orange-text)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Filter Tanggal */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  <Calendar size={13} color="var(--accent-cyan)" />
                  Tanggal Monitoring
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={tanggalFilter}
                  onChange={(e) => {
                    setTanggalFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  {dateOptions.map((d) => (
                    <option key={d.tanggal} value={d.tanggal}>
                      {formatTanggalID(d.tanggal)}
                    </option>
                  ))}
                  <option value="ALL">Semua Tanggal ({headerScopedRows.length} baris)</option>
                </select>
                {activeDateMeta && activeDateMeta.entities.length < 4 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      marginTop: '6px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.35,
                    }}
                  >
                    <Info size={13} color="var(--status-alert-text)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      Snapshot tanggal ini hanya memuat entitas{' '}
                      <strong>{activeDateMeta.entities.join(', ')}</strong>. Pilih{' '}
                      {dateOptions[1] ? formatTanggalID(dateOptions[1].tanggal) : 'tanggal lain'} untuk seluruh
                      grup entitas.
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Filter Grup / Entitas */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Grup / Entitas
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEntitasFilter('ALL');
                      setPage(1);
                    }}
                    style={{
                      gridColumn: 'span 3',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        entitasFilter === 'ALL'
                          ? '1px solid var(--accent-cyan)'
                          : '1px solid var(--border-subtle)',
                      backgroundColor: entitasFilter === 'ALL' ? 'rgba(56, 189, 248, 0.14)' : 'var(--bg-inner)',
                      color: entitasFilter === 'ALL' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    }}
                  >
                    Semua Entitas
                  </button>
                  {PERALATAN_ENTITAS_LIST.map((ent) => {
                    const isActive = entitasFilter === ent;
                    const color = PERALATAN_ENTITAS_COLORS[ent];
                    return (
                      <button
                        key={ent}
                        type="button"
                        onClick={() => {
                          setEntitasFilter((prev) => (prev === ent ? 'ALL' : ent));
                          setPage(1);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          padding: '6px 6px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isActive ? `1px solid ${color}` : '1px solid var(--border-subtle)',
                          backgroundColor: isActive ? `${color}22` : 'var(--bg-inner)',
                          color: isActive ? color : 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '999px',
                            backgroundColor: color,
                            flexShrink: 0,
                          }}
                        />
                        {ent}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Filter Kategori Alat */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Kategori Alat
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={kategoriFilter}
                  onChange={(e) => {
                    setKategoriFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Semua Kategori Alat</option>
                  {kategoriOptions.map((kat) => (
                    <option key={kat} value={kat}>
                      {kat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Filter Jenis Alat */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Jenis Alat
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={jenisFilter}
                  onChange={(e) => {
                    setJenisFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Semua Jenis Alat</option>
                  {jenisOptions.map((jns) => (
                    <option key={jns} value={jns}>
                      {jns}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Filter Nama Cabang (Multi-Select Checklist) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <Building2 size={13} color="var(--accent-cyan)" />
                    Nama Cabang
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBranches([]);
                      setPage(1);
                    }}
                    disabled={isPicCabang}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: effectiveBranches.length === 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      background: 'transparent',
                      border: 'none',
                      cursor: isPicCabang ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    Semua ({cabangOptions.length})
                  </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '6px' }}>
                  <Search
                    size={12}
                    style={{ position: 'absolute', left: '9px', top: '9px', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    className="filter-select"
                    placeholder="Cari nama cabang..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '28px', fontSize: '12px', height: '30px' }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '230px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-inner)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {cabangOptions.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Tidak ada cabang cocok
                    </div>
                  ) : (
                    cabangOptions.map((c) => {
                      const checked = effectiveBranches.includes(c.name);
                      return (
                        <label
                          key={c.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: isPicCabang ? 'default' : 'pointer',
                            backgroundColor: checked ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                            color: checked ? 'var(--text-title)' : 'var(--text-secondary)',
                            fontWeight: checked ? 700 : 500,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isPicCabang}
                              onChange={() => toggleBranchSelection(c.name)}
                              style={{ accentColor: '#0284c7', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={c.name}
                            >
                              {c.name}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontFamily: 'var(--font-mono)',
                              color: c.countOnDate > 0 ? 'var(--text-muted)' : 'var(--text-muted)',
                              opacity: c.countOnDate > 0 ? 1 : 0.45,
                              flexShrink: 0,
                            }}
                          >
                            {c.countOnDate}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* KONTEN UTAMA KANAN */}
          <div className="peralatan-main-content">
            {/* 1. 5 Kartu KPI Utama (Klik untuk memfilter tabel detail) */}
            <div className="peralatan-kpi-grid">
              {kpiCards.map((card) => {
                const isActive = kondisiFilter === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleToggleKondisiKpi(card.key)}
                    className="dark-card"
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      borderLeft: `4px solid ${card.accent}`,
                      outline: isActive ? `2px solid ${card.accent}` : 'none',
                      outlineOffset: '-2px',
                      backgroundColor: isActive ? card.activeBg : undefined,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, outline-color 0.15s ease',
                    }}
                    title={
                      card.key === 'ALL'
                        ? 'Tampilkan semua kondisi di tabel detail'
                        : `Klik untuk memfilter tabel ke kondisi ${card.key}`
                    }
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span className="kpi-header-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                        {card.label}
                      </span>
                      <span
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          backgroundColor: card.iconBg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Cog size={17} color={card.accent} />
                      </span>
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: '28px',
                        fontWeight: 900,
                        color: 'var(--text-title)',
                        margin: '8px 0 3px',
                        lineHeight: 1.1,
                      }}
                    >
                      {loading ? '...' : card.count.toLocaleString('id-ID')}
                    </div>

                    <div
                      style={{
                        fontSize: '11.5px',
                        color: isActive ? card.accent : 'var(--text-muted)',
                        fontWeight: isActive ? 700 : 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '4px',
                      }}
                    >
                      <span>{card.pctText}</span>
                      {isActive && card.key !== 'ALL' && (
                        <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>Aktif</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 2. Grafik "Detail Breakdown Alat" (Stacked Horizontal Bar Chart) */}
            <div className="dark-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <div className="dark-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color="var(--status-danger-text)" />
                    <span>Detail Breakdown Alat</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Distribusi jumlah unit berstatus <strong>BREAKDOWN</strong> berdasarkan Jenis Alat &amp; Grup /
                    Entitas ({kpiSummary.breakdown.toLocaleString('id-ID')} unit)
                  </div>
                </div>

                {/* Legend Custom Sesuai Entitas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {PERALATAN_ENTITAS_LIST.map((ent) => (
                    <span
                      key={ent}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          backgroundColor: PERALATAN_ENTITAS_COLORS[ent],
                        }}
                      />
                      {ent}
                    </span>
                  ))}
                </div>
              </div>

              {loading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Memuat grafik breakdown peralatan...
                </div>
              ) : breakdownChartData.length === 0 ? (
                <div
                  style={{
                    padding: '44px 20px',
                    textAlign: 'center',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-inner)',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                >
                  Tidak ada alat berstatus <strong>BREAKDOWN</strong> pada kombinasi filter tanggal &amp; cabang
                  terpilih.
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(300, breakdownChartData.length * 36 + 56)}px`,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={breakdownChartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 10, bottom: 16 }}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        label={{
                          value: 'Jumlah Unit Breakdown',
                          position: 'insideBottom',
                          offset: -8,
                          fill: 'var(--text-muted)',
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="jenis_alat"
                        width={185}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        contentStyle={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--text-title)',
                          fontSize: '12px',
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const entries = payload;
                          const total = entries.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
                          return (
                            <div
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                boxShadow: 'var(--card-shadow)',
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: 'var(--text-title)',
                                  marginBottom: '6px',
                                  fontSize: '12.5px',
                                }}
                              >
                                {label} ({total} unit)
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {entries
                                  .filter((e) => Number(e.value || 0) > 0)
                                  .map((e) => (
                                    <div
                                      key={String(e.name)}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: '16px',
                                        fontSize: '12px',
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <span
                                          style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '2px',
                                            backgroundColor: e.color,
                                          }}
                                        />
                                        {e.name}
                                      </span>
                                      <strong style={{ color: 'var(--text-title)' }}>{e.value} unit</strong>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                      {PERALATAN_ENTITAS_LIST.map((ent) => (
                        <Bar
                          key={ent}
                          dataKey={ent}
                          name={ent}
                          stackId="entitas"
                          fill={PERALATAN_ENTITAS_COLORS[ent]}
                          radius={[0, 0, 0, 0]}
                        >
                          <LabelList dataKey={ent} position="center" content={renderSegmentValueLabel} />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 3. Tabel Detail Monitoring Alat */}
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
                  <div
                    className="dark-card-title"
                    style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                  >
                    <span>Tabel Detail Monitoring Alat</span>
                    {kondisiFilter !== 'ALL' && (
                      <span
                        className={`badge ${getKondisiBadgeStyle(kondisiFilter).badgeClass}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
                      >
                        {kondisiFilter}
                        <button
                          type="button"
                          onClick={() => {
                            setKondisiFilter('ALL');
                            setPage(1);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                          }}
                          title="Hapus filter kondisi"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Menampilkan {tableRows.length.toLocaleString('id-ID')} baris peralatan sesuai filter aktif
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      className="filter-select"
                      placeholder="Cari alat, cabang, kerusakan..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      style={{ paddingLeft: '32px', width: '235px' }}
                    />
                  </div>

                  <select
                    className="filter-select"
                    value={kondisiFilter}
                    onChange={(e) => {
                      setKondisiFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">Semua Kondisi</option>
                    <option value="READY">READY</option>
                    <option value="READY DENGAN CATATAN">READY DENGAN CATATAN</option>
                    <option value="BREAKDOWN">BREAKDOWN</option>
                    <option value="USUL/PROSES PENGHAPUSAN">USUL/PROSES PENGHAPUSAN</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="card-table dark-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Grup / Entitas</th>
                      <th>Nama Cabang</th>
                      <th>Nama Alat</th>
                      <th>Jenis Alat</th>
                      <th>Kategori Alat</th>
                      <th style={{ textAlign: 'center' }}>Kondisi</th>
                      <th>Kerusakan</th>
                      <th>Tindak Lanjut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                          Memuat data peralatan...
                        </td>
                      </tr>
                    ) : paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                          Tidak ada data peralatan yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((r, idx) => {
                        const badge = getKondisiBadgeStyle(r.kondisi);
                        const entStyle = getEntitasBadgeStyle(r.grup_entitas);
                        return (
                          <tr key={r.id || `${r.tanggal}_${r.nama_cabang}_${r.nama_alat}_${idx}`}>
                            <td data-label="Tanggal"
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {formatTanggalID(r.tanggal)}
                            </td>
                            <td data-label="Grup / Entitas">
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: entStyle.bg,
                                  color: entStyle.fg,
                                  border: `1px solid ${entStyle.border}`,
                                }}
                              >
                                {r.grup_entitas}
                              </span>
                            </td>
                            <td data-label="Nama Cabang" style={{ fontWeight: 600, color: 'var(--text-title)', whiteSpace: 'nowrap' }}>
                              {r.nama_cabang}
                            </td>
                            <td data-label="Nama Alat" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.nama_alat}</td>
                            <td data-label="Jenis Alat" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.jenis_alat}</td>
                            <td data-label="Kategori Alat" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.kategori_alat}</td>
                            <td data-label="Kondisi" style={{ textAlign: 'center' }}>
                              <span className={`badge ${badge.badgeClass}`}>{badge.shortLabel}</span>
                            </td>
                            <td data-label="Kerusakan"
                              style={{
                                maxWidth: '250px',
                                fontSize: '12px',
                                color: r.kerusakan ? 'var(--text-secondary)' : 'var(--text-muted)',
                                whiteSpace: 'pre-line',
                              }}
                            >
                              {displayNullableText(r.kerusakan)}
                            </td>
                            <td data-label="Tindak Lanjut"
                              style={{
                                maxWidth: '250px',
                                fontSize: '12px',
                                color: r.tindak_lanjut ? 'var(--text-secondary)' : 'var(--text-muted)',
                                whiteSpace: 'pre-line',
                              }}
                            >
                              {displayNullableText(r.tindak_lanjut)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {tableRows.length > PAGE_SIZE && (
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
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span>
                    Halaman <strong>{safePage}</strong> dari <strong>{totalPages}</strong> (
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, tableRows.length)} dari{' '}
                    {tableRows.length.toLocaleString('id-ID')} baris)
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-dark"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        opacity: safePage <= 1 ? 0.45 : 1,
                        cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={14} />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      className="btn-dark"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        opacity: safePage >= totalPages ? 0.45 : 1,
                        cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Berikutnya
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'katalog' && (
        <div className="dark-card">
          <div className="dark-card-title" style={{ marginBottom: '6px' }}>
            Katalog Standar Peralatan Pelindo (Master Data)
          </div>
          <p className="card-subtitle" style={{ marginBottom: '16px' }}>
            Daftar katalog peralatan standar pelabuhan yang terdaftar dalam master sistem PortDash Regional 4
          </p>

          <div className="table-responsive">
            <table className="card-table dark-table">
              <thead>
                <tr>
                  <th>Kode Alat</th>
                  <th>Nama Peralatan Pelabuhan</th>
                  <th style={{ textAlign: 'center' }}>Singkatan</th>
                  <th>Kategori Operasional</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((eq) => (
                  <tr key={eq.code}>
                    <td data-label="Kode Alat" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {eq.code}
                    </td>
                    <td data-label="Nama Peralatan Pelabuhan" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{eq.name}</td>
                    <td data-label="Singkatan" style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {eq.acronym}
                      </span>
                    </td>
                    <td data-label="Kategori Operasional" style={{ color: 'var(--text-secondary)' }}>{eq.category}</td>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
