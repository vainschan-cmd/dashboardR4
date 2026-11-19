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
  LabelList,
} from 'recharts';
import {
  Cog,
  Wrench,
  Search,
  PlusCircle,
  RotateCcw,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  Info,
  X,
  FilterX,
  Lock,
  CheckCircle2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { isBranchMatch, parseSelectedBranches } from '@/lib/constants';
import {
  PERALATAN_ENTITAS_COLORS,
  PERALATAN_ENTITAS_LIST,
  aggregatePeralatanKpis,
  buildBreakdownByBranchChart,
  buildBreakdownByJenisChart,
  displayNullableText,
  formatTanggalID,
  normalizeGrupEntitas,
  normalizeKondisi,
  resolvePeralatanBranchCode,
} from '@/lib/peralatanHelpers';
import type { BreakdownBranchChartRow } from '@/lib/peralatanHelpers';
import type { PeralatanGrupEntitas, PeralatanRecord, User } from '@/lib/types';
import ChartInlineLegend from '@/components/ui/ChartInlineLegend';


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

type PeralatanSortKey =
  | 'tanggal'
  | 'grup_entitas'
  | 'nama_cabang'
  | 'nama_alat'
  | 'jenis_alat'
  | 'kategori_alat'
  | 'kondisi';

function getKondisiSortRank(kondisi: string): number {
  const norm = normalizeKondisi(kondisi);
  if (norm === 'BREAKDOWN') return 1;
  if (norm === 'READY DENGAN CATATAN') return 2;
  if (norm === 'USUL/PROSES PENGHAPUSAN') return 3;
  if (norm === 'READY') return 4;
  return 5;
}

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
  if (norm === 'R4') return { bg: 'rgba(37, 99, 235, 0.16)', fg: 'var(--accent-blue-text)', border: 'rgba(37, 99, 235, 0.45)' };
  if (norm === 'PMT') return { bg: 'rgba(148, 163, 184, 0.18)', fg: 'var(--text-secondary)', border: 'rgba(148, 163, 184, 0.45)' };
  if (norm === 'MTI') return { bg: 'rgba(202, 138, 4, 0.16)', fg: 'var(--status-alert-text)', border: 'rgba(202, 138, 4, 0.45)' };
  if (norm === 'PTP') return { bg: 'rgba(249, 115, 22, 0.16)', fg: 'var(--accent-orange-text)', border: 'rgba(249, 115, 22, 0.45)' };
  return { bg: 'var(--bg-inner)', fg: 'var(--text-secondary)', border: 'var(--border-subtle)' };
}

export default function PortSightPeralatan({
  selectedTerminal = 'ALL',
  currentUser = null,
  onOpenManualInput,
}: PortSightPeralatanProps) {
  const [data, setData] = useState<PeralatanRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Top Filter Bar & Table Filters
  const [tanggalFilter, setTanggalFilter] = useState<string>('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // empty = Semua Cabang
  const [branchSearch, setBranchSearch] = useState<string>('');
  const [branchMenuOpen, setBranchMenuOpen] = useState<boolean>(false);
  const branchPopoverRef = useRef<HTMLDivElement>(null);
  const [entitasFilter, setEntitasFilter] = useState<string>('ALL');
  const [kategoriFilter, setKategoriFilter] = useState<string>('ALL');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');
  const [kondisiFilter, setKondisiFilter] = useState<string>('ATTENTION');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [sortColumn, setSortColumn] = useState<PeralatanSortKey>('kondisi');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Close branch popover when clicking outside or pressing Escape
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

  const activeBranchLabel = useMemo(() => {
    if (isPicCabang) {
      return currentUser?.branch_id || 'Cabang Anda';
    }
    if (effectiveBranches.length === 0 || effectiveBranches.length >= cabangOptions.length) {
      return `Semua Cabang (${cabangOptions.length})`;
    }
    if (effectiveBranches.length <= 2) {
      return effectiveBranches.join(', ');
    }
    return `${effectiveBranches.length} Cabang Dipilih`;
  }, [isPicCabang, currentUser?.branch_id, effectiveBranches, cabangOptions.length]);

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

  // Baris setelah menerapkan seluruh Top Filter (Tanggal, Cabang, Entitas, Kategori, Jenis)
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

  // 10 Cabang Breakdown Terbanyak Data (Horizontal Bar Chart)
  const breakdownByBranchData = useMemo(
    () => buildBreakdownByBranchChart(sidebarFilteredRows, 10),
    [sidebarFilteredRows]
  );

  // Tabel Detail Monitoring di bawah grafik (menerapkan klik KPI Kondisi + Pencarian Teks)
  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sidebarFilteredRows.filter((r) => {
      if (kondisiFilter === 'ATTENTION') {
        const k = normalizeKondisi(r.kondisi);
        if (k !== 'BREAKDOWN' && k !== 'READY DENGAN CATATAN') return false;
      } else if (kondisiFilter !== 'ALL' && normalizeKondisi(r.kondisi) !== kondisiFilter) {
        return false;
      }
      if (q) {
        const hay = `${r.tanggal} ${r.grup_entitas} ${r.nama_cabang} ${r.nama_alat} ${r.jenis_alat} ${r.kategori_alat} ${r.kondisi} ${r.kerusakan || ''} ${r.tindak_lanjut || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sidebarFilteredRows, kondisiFilter, searchQuery]);

  const sortedRows = useMemo(() => {
    const list = [...tableRows];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'kondisi') {
        cmp = getKondisiSortRank(a.kondisi) - getKondisiSortRank(b.kondisi);
      } else {
        const valA = String(a[sortColumn] ?? '').trim().toLowerCase();
        const valB = String(b[sortColumn] ?? '').trim().toLowerCase();
        cmp = valA.localeCompare(valB, 'id');
      }
      if (cmp === 0) {
        cmp = String(a.nama_cabang || '').localeCompare(String(b.nama_cabang || ''), 'id');
      }
      if (cmp === 0) {
        cmp = String(a.nama_alat || '').localeCompare(String(b.nama_alat || ''), 'id');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [tableRows, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize]
  );

  const handleSort = (col: PeralatanSortKey) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (col: PeralatanSortKey) => {
    if (sortColumn !== col) {
      return <ArrowUpDown size={11} aria-hidden="true" style={{ opacity: 0.35 }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={11} aria-hidden="true" style={{ color: 'var(--beranda-accent)' }} />
    ) : (
      <ArrowDown size={11} aria-hidden="true" style={{ color: 'var(--beranda-accent)' }} />
    );
  };

  const handleExportCsv = () => {
    if (sortedRows.length === 0) return;
    const headers = [
      'Tanggal',
      'Grup Entitas',
      'Nama Cabang',
      'Nama Alat',
      'Jenis Alat',
      'Kategori Alat',
      'Kondisi',
      'Kerusakan',
      'Tindak Lanjut',
    ];
    const csvLines = [
      headers.join(','),
      ...sortedRows.map((r) => [
        r.tanggal,
        r.grup_entitas,
        `"${(r.nama_cabang || '').replace(/"/g, '""')}"`,
        `"${(r.nama_alat || '').replace(/"/g, '""')}"`,
        `"${(r.jenis_alat || '').replace(/"/g, '""')}"`,
        `"${(r.kategori_alat || '').replace(/"/g, '""')}"`,
        r.kondisi,
        `"${(r.kerusakan || '').replace(/"/g, '""')}"`,
        `"${(r.tindak_lanjut || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label =
      kondisiFilter === 'ATTENTION'
        ? 'perlu_tindakan'
        : kondisiFilter === 'ALL'
          ? 'semua'
          : kondisiFilter.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    a.download = `monitoring_alat_${label}_${tanggalFilter || 'snapshot'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    (kondisiFilter !== 'ALL' && kondisiFilter !== 'ATTENTION') ||
    searchQuery.trim() !== '';

  const kpiCards = [
    {
      key: 'ALL',
      label: 'Total Alat',
      count: kpiSummary.total,
      pctText: kpiSummary.total > 0 ? `RFU ${kpiSummary.rfuPct}% • ${sidebarFilteredRows.length} unit` : '0 unit',
      accent: 'var(--beranda-accent)',
      iconBg: 'var(--beranda-accent-soft)',
      activeBg: 'var(--beranda-accent-soft)',
      icon: <Cog size={17} aria-hidden="true" />,
    },
    {
      key: 'READY',
      label: 'Ready',
      count: kpiSummary.ready,
      pctText: kpiSummary.total > 0 ? `${((kpiSummary.ready / kpiSummary.total) * 100).toFixed(1)}% dari total` : '0%',
      accent: 'var(--status-good-text)',
      iconBg: 'rgba(16, 185, 129, 0.14)',
      activeBg: 'rgba(16, 185, 129, 0.14)',
      icon: <CheckCircle2 size={17} aria-hidden="true" />,
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
      iconBg: 'rgba(245, 158, 11, 0.14)',
      activeBg: 'rgba(245, 158, 11, 0.14)',
      icon: <AlertTriangle size={17} aria-hidden="true" />,
    },
    {
      key: 'BREAKDOWN',
      label: 'Breakdown',
      count: kpiSummary.breakdown,
      pctText:
        kpiSummary.total > 0 ? `${((kpiSummary.breakdown / kpiSummary.total) * 100).toFixed(1)}% dari total` : '0%',
      accent: 'var(--status-danger-text)',
      iconBg: 'rgba(239, 68, 68, 0.14)',
      activeBg: 'rgba(239, 68, 68, 0.14)',
      icon: <AlertTriangle size={17} aria-hidden="true" />,
    },
    {
      key: 'USUL/PROSES PENGHAPUSAN',
      label: 'Usul/Proses Hapus',
      count: kpiSummary.usulPenghapusan,
      pctText:
        kpiSummary.total > 0
          ? `${((kpiSummary.usulPenghapusan / kpiSummary.total) * 100).toFixed(1)}% dari total`
          : '0%',
      accent: 'var(--series-purple-text)',
      iconBg: 'rgba(168, 85, 247, 0.14)',
      activeBg: 'rgba(168, 85, 247, 0.14)',
      icon: <Cog size={17} aria-hidden="true" />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Status & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--text-title)',
            }}
          >
            <Wrench size={15} color="var(--accent-blue)" />
            <span>Monitoring Kesiapan &amp; Utilisasi Peralatan</span>
          </div>
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

      <div className="peralatan-inline-content">
          {/* Top Horizontal Executive Filter Bar */}
          <section className="beranda-filter-bar" aria-label="Filter Peralatan Eksekutif">
            <div className="beranda-filter-row">
              {/* Left Controls */}
              <div className="beranda-filter-controls" style={{ gap: '6px' }}>
                {/* 1. Tanggal Monitoring */}
                <label className="beranda-select-field">
                  <Calendar size={13} style={{ color: 'var(--beranda-accent)' }} />
                  <span className="beranda-field-label">Tanggal</span>
                  <select
                    value={tanggalFilter}
                    onChange={(e) => {
                      setTanggalFilter(e.target.value);
                      setPage(1);
                    }}
                    className="beranda-select"
                    style={{ maxWidth: '115px' }}
                    aria-label="Pilih Tanggal Monitoring"
                  >
                    {dateOptions.map((d) => (
                      <option key={d.tanggal} value={d.tanggal}>
                        {formatTanggalID(d.tanggal)}
                      </option>
                    ))}
                    <option value="ALL">Semua Tanggal ({headerScopedRows.length})</option>
                  </select>
                </label>

                {/* 2. Searchable Multi-Select Cabang */}
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
                        <Building2 size={13} style={{ color: 'var(--beranda-accent)' }} />
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
                        <div className="beranda-branch-popover" role="dialog" aria-label="Pilih Cabang">
                          <div className="beranda-branch-popover-head">
                            <span>Cabang / Terminal</span>
                            {selectedBranches.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBranches([]);
                                  setPage(1);
                                }}
                                className="beranda-clear-btn"
                              >
                                <FilterX size={11} aria-hidden="true" /> Reset
                              </button>
                            )}
                          </div>

                          {cabangOptions.length > 5 && (
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
                                setSelectedBranches([]);
                                setBranchMenuOpen(false);
                                setPage(1);
                              }}
                              className={`beranda-slicer-btn ${selectedBranches.length === 0 ? 'is-active' : ''}`}
                            >
                              <span>Semua Cabang ({cabangOptions.length})</span>
                              {selectedBranches.length === 0 && <Check size={13} color="var(--accent-blue-text)" aria-hidden="true" />}
                            </button>

                            {cabangOptions.map((opt) => {
                              const isSelected = effectiveBranches.includes(opt.name);
                              return (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onClick={() => toggleBranchSelection(opt.name)}
                                  className={`beranda-slicer-btn ${isSelected ? 'is-active' : ''}`}
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {opt.name}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      {opt.countOnDate}
                                    </span>
                                    {isSelected && <Check size={13} color="var(--accent-blue-text)" aria-hidden="true" />}
                                  </div>
                                </button>
                              );
                            })}

                            {cabangOptions.length === 0 && (
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

                {/* 3. Inline Entitas Segment Pills */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    backgroundColor: 'var(--bg-inner)',
                    padding: '2px 3px',
                    borderRadius: '9px',
                    border: '1px solid var(--border-subtle)',
                    height: '36px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEntitasFilter('ALL');
                      setPage(1);
                    }}
                    style={{
                      padding: '4px 7px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: entitasFilter === 'ALL' ? 'var(--beranda-accent-soft)' : 'transparent',
                      color: entitasFilter === 'ALL' ? 'var(--beranda-accent)' : 'var(--text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Semua
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: isActive ? `${color}22` : 'transparent',
                          color: isActive ? color : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '999px',
                            backgroundColor: color,
                          }}
                        />
                        {ent}
                      </button>
                    );
                  })}
                </div>

                {/* 4. Kategori Alat */}
                <label className="beranda-select-field">
                  <span className="beranda-field-label">Kategori</span>
                  <select
                    value={kategoriFilter}
                    onChange={(e) => {
                      setKategoriFilter(e.target.value);
                      setPage(1);
                    }}
                    className="beranda-select"
                    style={{ maxWidth: '140px' }}
                    aria-label="Pilih Kategori Alat"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {kategoriOptions.map((kat) => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>
                </label>

                {/* 5. Jenis Alat */}
                <label className="beranda-select-field">
                  <span className="beranda-field-label">Jenis</span>
                  <select
                    value={jenisFilter}
                    onChange={(e) => {
                      setJenisFilter(e.target.value);
                      setPage(1);
                    }}
                    className="beranda-select"
                    style={{ maxWidth: '130px' }}
                    aria-label="Pilih Jenis Alat"
                  >
                    <option value="ALL">Semua Jenis</option>
                    {jenisOptions.map((jns) => (
                      <option key={jns} value={jns}>
                        {jns}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Right: Reset Action */}
              <div className="beranda-filter-actions">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="beranda-tool-btn"
                    title="Reset semua filter ke kondisi semula"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    <span>Reset Filter</span>
                  </button>
                )}
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
                    onClick={() => toggleBranchSelection(name)}
                    className="beranda-filter-chip"
                    title={`Hapus filter ${name}`}
                  >
                    <span>{name}</span>
                    <X size={11} aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranches([]);
                    setPage(1);
                  }}
                  className="beranda-clear-btn"
                >
                  Hapus Semua
                </button>
              </div>
            )}
          </section>

          {/* Alert if snapshot doesn't have all entities */}
          {activeDateMeta && activeDateMeta.entities.length < 4 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
              }}
            >
              <Info size={14} color="var(--status-alert-text)" style={{ flexShrink: 0 }} />
              <span>
                Snapshot tanggal ini hanya mencakup entitas <strong>{activeDateMeta.entities.join(', ')}</strong>.
                {dateOptions[1] && (
                  <>
                    {' '}Pilih <strong>{formatTanggalID(dateOptions[1].tanggal)}</strong> untuk melihat konsolidasi seluruh entitas.
                  </>
                )}
              </span>
            </div>
          )}

          {/* 5 Kartu KPI Utama (Inline ala Summary) */}
          <section className="peralatan-kpi-grid" aria-label="KPI Ringkasan Kondisi Alat">
            {kpiCards.map((card) => {
              const isActive = kondisiFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => handleToggleKondisiKpi(card.key)}
                  className="beranda-kpi-card"
                  style={{
                    borderTop: `2px solid ${card.accent}`,
                    textAlign: 'left',
                    cursor: 'pointer',
                    outline: isActive ? `2px solid ${card.accent}` : 'none',
                    outlineOffset: '-2px',
                    backgroundColor: isActive ? card.activeBg : undefined,
                    width: '100%',
                  }}
                  title={
                    card.key === 'ALL'
                      ? 'Tampilkan semua kondisi di tabel detail'
                      : `Klik untuk memfilter tabel ke kondisi ${card.key}`
                  }
                >
                  <div className="beranda-kpi-head">
                    <span className="beranda-kpi-label">{card.label}</span>
                    <span
                      className="beranda-kpi-icon"
                      style={{ backgroundColor: card.iconBg, color: card.accent }}
                    >
                      {card.icon}
                    </span>
                  </div>

                  <div className="beranda-kpi-value" style={{ color: card.accent }}>
                    {loading ? '...' : card.count.toLocaleString('id-ID')}
                  </div>

                  <div className="beranda-kpi-submetrics">
                    <span>{card.pctText}</span>
                    {isActive && card.key !== 'ALL' && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: card.accent,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Aktif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>

          {/* 2-Column Bento Analytics Row */}
          <div className="peralatan-charts-row">
            {/* Chart 1: Detail Breakdown per Jenis Alat */}
            <div className="beranda-chart-card">
              <div className="beranda-chart-head">
                <div>
                  <div className="dark-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench size={16} color="var(--accent-cyan)" />
                    <span>Detail Breakdown per Jenis Alat</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Distribusi unit berstatus <strong>BREAKDOWN</strong> menurut Jenis Alat &amp; Grup Entitas
                  </div>
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
                  Tidak ada alat berstatus <strong>BREAKDOWN</strong> pada kombinasi filter aktif.
                </div>
              ) : (
                <>
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
                          width={170}
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
                  <ChartInlineLegend
                    compact
                    items={PERALATAN_ENTITAS_LIST.map((ent) => ({
                      label: ent,
                      color: PERALATAN_ENTITAS_COLORS[ent],
                    }))}
                  />
                </>
              )}
            </div>

            {/* Chart 2: 10 Cabang Breakdown Terbanyak */}
            <div className="beranda-chart-card">
              <div className="beranda-chart-head">
                <div>
                  <div className="dark-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color="var(--status-danger-text)" />
                    <span>10 Cabang Breakdown Terbanyak</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Peringkat cabang dengan unit berstatus breakdown tertinggi
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--status-danger-text)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {breakdownByBranchData.length} Cabang Terdampak
                </span>
              </div>

              {loading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Memuat data cabang breakdown...
                </div>
              ) : breakdownByBranchData.length === 0 ? (
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
                  Seluruh cabang tidak memiliki unit breakdown pada kombinasi filter aktif.
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(300, breakdownByBranchData.length * 36 + 56)}px`,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={breakdownByBranchData}
                      layout="vertical"
                      margin={{ top: 8, right: 36, left: 10, bottom: 16 }}
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
                        dataKey="nama_cabang"
                        width={140}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const row = payload[0].payload as BreakdownBranchChartRow;
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
                              <div style={{ fontWeight: 800, color: 'var(--text-title)', marginBottom: '4px', fontSize: '12.5px' }}>
                                {row.nama_cabang}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--status-danger-text)', fontWeight: 700 }}>
                                Breakdown: {row.breakdown} unit
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Ready: {row.ready} / {row.total} unit ({row.readinessPct}% readiness)
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="breakdown" fill="#ef4444" radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="breakdown"
                          position="right"
                          formatter={(val: unknown) => `${val} unit`}
                          style={{
                            fill: 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
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
                    {kondisiFilter === 'ATTENTION' ? (
                      <span
                        className="badge badge-alert"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
                      >
                        <AlertTriangle size={12} />
                        Perlu Tindakan ({kpiSummary.breakdown + kpiSummary.readyDenganCatatan})
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
                          title="Tampilkan semua kondisi"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : kondisiFilter !== 'ALL' ? (
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
                    ) : null}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Menampilkan {sortedRows.length.toLocaleString('id-ID')} baris peralatan sesuai filter aktif
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
                      style={{ paddingLeft: '32px', width: '220px' }}
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
                    <option value="ATTENTION">🚨 Perlu Tindakan</option>
                    <option value="ALL">Semua Kondisi</option>
                    <option value="BREAKDOWN">BREAKDOWN</option>
                    <option value="READY DENGAN CATATAN">READY DENGAN CATATAN</option>
                    <option value="READY">READY</option>
                    <option value="USUL/PROSES PENGHAPUSAN">USUL/PROSES PENGHAPUSAN</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={sortedRows.length === 0}
                    className="btn-dark"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: sortedRows.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: sortedRows.length === 0 ? 0.5 : 1,
                      height: '36px',
                      borderRadius: '8px',
                    }}
                    title="Unduh data terfilter ke format CSV (Excel)"
                  >
                    <Download size={13} />
                    <span>Unduh CSV</span>
                  </button>
                </div>
              </div>

              {/* Quick Status Segmented Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-inner)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setKondisiFilter('ATTENTION');
                      setPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: kondisiFilter === 'ATTENTION' ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                      color: kondisiFilter === 'ATTENTION' ? 'var(--status-danger-text)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AlertTriangle size={12} />
                    <span>Perlu Tindakan ({kpiSummary.breakdown + kpiSummary.readyDenganCatatan})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setKondisiFilter('ALL');
                      setPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: kondisiFilter === 'ALL' ? 'var(--beranda-accent-soft)' : 'transparent',
                      color: kondisiFilter === 'ALL' ? 'var(--beranda-accent)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Semua Unit ({kpiSummary.total})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setKondisiFilter('BREAKDOWN');
                      setPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: kondisiFilter === 'BREAKDOWN' ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                      color: kondisiFilter === 'BREAKDOWN' ? 'var(--status-danger-text)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Breakdown ({kpiSummary.breakdown})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setKondisiFilter('READY');
                      setPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: kondisiFilter === 'READY' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                      color: kondisiFilter === 'READY' ? 'var(--status-good-text)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Ready ({kpiSummary.ready})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setKondisiFilter('USUL/PROSES PENGHAPUSAN');
                      setPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: kondisiFilter === 'USUL/PROSES PENGHAPUSAN' ? 'rgba(147, 51, 234, 0.16)' : 'transparent',
                      color: kondisiFilter === 'USUL/PROSES PENGHAPUSAN' ? 'var(--series-purple-text)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Usul Hapus ({kpiSummary.usulPenghapusan})</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Container with Sticky Header */}
              <div
                className="table-responsive"
                style={{
                  maxHeight: '480px',
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  position: 'relative',
                  margin: 0,
                }}
              >
                <table className="card-table dark-table" style={{ margin: 0 }}>
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      backgroundColor: 'var(--bg-table-header)',
                      boxShadow: '0 1px 0 var(--border-subtle)',
                    }}
                  >
                    <tr>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('tanggal')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Tanggal {renderSortIcon('tanggal')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('grup_entitas')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Grup / Entitas {renderSortIcon('grup_entitas')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('nama_cabang')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Nama Cabang {renderSortIcon('nama_cabang')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('nama_alat')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Nama Alat {renderSortIcon('nama_alat')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('jenis_alat')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Jenis Alat {renderSortIcon('jenis_alat')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('kategori_alat')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Kategori Alat {renderSortIcon('kategori_alat')}
                        </span>
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-table-header)' }}
                        onClick={() => handleSort('kondisi')}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          Kondisi {renderSortIcon('kondisi')}
                        </span>
                      </th>
                      <th style={{ backgroundColor: 'var(--bg-table-header)' }}>Kerusakan</th>
                      <th style={{ backgroundColor: 'var(--bg-table-header)' }}>Tindak Lanjut</th>
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
                        const normKondisi = normalizeKondisi(r.kondisi);
                        const isBreakdown = normKondisi === 'BREAKDOWN';
                        const isCatatan = normKondisi === 'READY DENGAN CATATAN';
                        const badge = getKondisiBadgeStyle(r.kondisi);
                        const entStyle = getEntitasBadgeStyle(r.grup_entitas);

                        return (
                          <tr
                            key={r.id || `${r.tanggal}_${r.nama_cabang}_${r.nama_alat}_${idx}`}
                            style={{
                              borderLeft: isBreakdown
                                ? '4px solid #ef4444'
                                : isCatatan
                                  ? '4px solid #f59e0b'
                                  : '4px solid transparent',
                              backgroundColor: isBreakdown
                                ? 'rgba(239, 68, 68, 0.04)'
                                : isCatatan
                                  ? 'rgba(245, 158, 11, 0.04)'
                                  : undefined,
                            }}
                          >
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

              {/* Pagination Bar with Page Size Selector */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>
                    Menampilkan <strong>{sortedRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedRows.length)}</strong> dari{' '}
                    <strong>{sortedRows.length.toLocaleString('id-ID')}</strong> baris
                    {sortedRows.length !== sidebarFilteredRows.length && (
                      <span> (difilter dari {sidebarFilteredRows.length.toLocaleString('id-ID')} total)</span>
                    )}
                  </span>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Baris per halaman:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="filter-select"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11.5px',
                        height: '28px',
                        borderRadius: '6px',
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ marginRight: '4px' }}>
                    Halaman <strong>{safePage}</strong> dari <strong>{totalPages}</strong>
                  </span>
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
            </div>
        </div>
    </div>
  );
}
