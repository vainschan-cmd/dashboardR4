'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronRight,
  X,
  Building,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  RotateCw,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  Kanban,
  Table as TableIcon,
  LayoutGrid,
  Clock,
  FilterX,
  User,
} from 'lucide-react';
import { User as UserType, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES, getSelectedBranchLabel } from '@/lib/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface IsuStrategisItem {
  id: string;
  kode: string;
  cabangCode: string;
  cabangName: string;
  kategori: 'Operasional' | 'Finansial' | 'Fasilitas' | 'Komersial' | 'HSSE' | 'SDM';
  prioritas: 'P0' | 'P1' | 'P2';
  status: 'Open' | 'On Progress' | 'Monitoring' | 'Resolved';
  judul: string;
  akarMasalah: string;
  tindakLanjut: string;
  pic: string;
  targetSelesai: string;
  progres: number;
  dampak: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

interface FormState {
  kode: string;
  cabangCode: string;
  cabangName: string;
  kategori: IsuStrategisItem['kategori'];
  prioritas: IsuStrategisItem['prioritas'];
  status: IsuStrategisItem['status'];
  judul: string;
  akarMasalah: string;
  tindakLanjut: string;
  pic: string;
  targetSelesai: string;
  progres: number;
  dampak: string;
}

const EMPTY_FORM: FormState = {
  kode: '',
  cabangCode: 'R99',
  cabangName: 'Regional 4 (Konsolidasi)',
  kategori: 'Operasional',
  prioritas: 'P1',
  status: 'Open',
  judul: '',
  akarMasalah: '',
  tindakLanjut: '',
  pic: '',
  targetSelesai: '',
  progres: 0,
  dampak: '',
};

const ISU_CATEGORIES: Array<'ALL' | IsuStrategisItem['kategori']> = [
  'ALL',
  'Operasional',
  'Finansial',
  'Fasilitas',
  'Komersial',
  'HSSE',
  'SDM',
];

const KANBAN_COLUMNS: Array<{ status: IsuStrategisItem['status']; label: string; accentColor: string }> = [
  { status: 'Open', label: 'Open', accentColor: 'var(--text-muted)' },
  { status: 'On Progress', label: 'On Progress', accentColor: 'var(--status-alert-text)' },
  { status: 'Monitoring', label: 'Monitoring', accentColor: 'var(--series-purple-text)' },
  { status: 'Resolved', label: 'Resolved', accentColor: 'var(--status-good-text)' },
];

function parseTargetDate(str: string): Date | null {
  if (!str) return null;
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  const idMonths: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7, ags: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11,
  };
  const parts = str.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const mStr = parts[1].toLowerCase().replace(/[^a-z]/g, '');
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(year) && idMonths[mStr] !== undefined) {
      return new Date(year, idMonths[mStr], day);
    }
  }
  return null;
}

function getItemDueStatus(targetSelesai: string, status: string): { isOverdue: boolean; isDueSoon: boolean; daysDiff: number | null } {
  if (status === 'Resolved') {
    return { isOverdue: false, isDueSoon: false, daysDiff: null };
  }
  const date = parseTargetDate(targetSelesai);
  if (!date) {
    return { isOverdue: false, isDueSoon: false, daysDiff: null };
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { isOverdue: true, isDueSoon: false, daysDiff: Math.abs(diffDays) };
  } else if (diffDays <= 7) {
    return { isOverdue: false, isDueSoon: true, daysDiff: diffDays };
  }
  return { isOverdue: false, isDueSoon: false, daysDiff: diffDays };
}

interface PortSightIsuStrategisProps {
  selectedTerminal?: string;
  selectedPeriod?: string;
  currentUser?: UserType | null;
  userRole?: UserRole;
  onNavigateTab?: (tabId: string) => void;
}

export default function PortSightIsuStrategis({
  selectedTerminal = 'ALL',
  currentUser,
  userRole,
  onNavigateTab,
}: PortSightIsuStrategisProps) {
  // Live Data State
  const [items, setItems] = useState<IsuStrategisItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'board' (Kanban) | 'table' (Matriks) | 'grid' (Kartu Prioritas)
  const [viewMode, setViewMode] = useState<'board' | 'table' | 'grid'>('board');

  // Filter & Search State
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [selectedPrioritas, setSelectedPrioritas] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'p0' | 'progress' | 'resolved' | 'overdue' | null>(null);
  const [dismissAttentionAlert, setDismissAttentionAlert] = useState<boolean>(false);

  // Modals & Forms State
  const [detailModalItem, setDetailModalItem] = useState<IsuStrategisItem | null>(null);
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<IsuStrategisItem | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Delete Confirmation State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<IsuStrategisItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Notification Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Focus Trap Refs for Modals
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const formDialogRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(detailDialogRef, Boolean(detailModalItem), () => setDetailModalItem(null));
  useFocusTrap(formDialogRef, formModalOpen, () => !submitting && setFormModalOpen(false));
  useFocusTrap(deleteDialogRef, Boolean(deleteConfirmItem), () => !deleting && setDeleteConfirmItem(null));

  const isBod = (currentUser?.role || userRole) === 'viewer';

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Fetch Data from PostgreSQL
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/isu-strategis');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Gagal mengambil data dari database.');
      }
      setItems(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan atau koneksi database.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/isu-strategis');
        const json = await res.json();
        if (!ignore) {
          if (!res.ok || !json.success) {
            setError(json.error || json.message || 'Gagal mengambil data dari database.');
          } else {
            setItems(json.data || []);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan atau koneksi database.';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Cabang Title
  const isAll = !selectedTerminal || selectedTerminal === 'ALL' || selectedTerminal === 'R99';
  const branchTitle = isAll
    ? 'Konsolidasi Regional 4'
    : getSelectedBranchLabel(selectedTerminal);

  // Base scope items (scoped by branch if terminal is selected)
  const scopedItems = useMemo(() => {
    return items.filter((item) => {
      if (!isAll && item.cabangCode !== selectedTerminal && item.cabangCode !== 'R99') {
        return false;
      }
      return true;
    });
  }, [items, isAll, selectedTerminal]);

  // Direksi Attention Checks (P0 uncompleted & Overdue items)
  const criticalPendingCount = useMemo(() => {
    return scopedItems.filter((i) => i.prioritas === 'P0' && i.status !== 'Resolved').length;
  }, [scopedItems]);

  const overdueItemsCount = useMemo(() => {
    return scopedItems.filter((i) => getItemDueStatus(i.targetSelesai, i.status).isOverdue).length;
  }, [scopedItems]);

  // Category counts based on scoped dataset
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: scopedItems.length };
    for (const item of scopedItems) {
      map[item.kategori] = (map[item.kategori] || 0) + 1;
    }
    return map;
  }, [scopedItems]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return scopedItems.filter((item) => {
      // Overdue KPI filter
      if (activeKpiFilter === 'overdue') {
        if (!getItemDueStatus(item.targetSelesai, item.status).isOverdue) {
          return false;
        }
      }
      // Kategori filter
      if (selectedKategori !== 'ALL' && item.kategori !== selectedKategori) {
        return false;
      }
      // Prioritas filter
      if (selectedPrioritas !== 'ALL' && item.prioritas !== selectedPrioritas) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.judul.toLowerCase().includes(q);
        const matchKode = item.kode.toLowerCase().includes(q);
        const matchPic = item.pic.toLowerCase().includes(q);
        const matchCabang = item.cabangName.toLowerCase().includes(q);
        if (!matchTitle && !matchKode && !matchPic && !matchCabang) {
          return false;
        }
      }
      return true;
    });
  }, [scopedItems, activeKpiFilter, selectedKategori, selectedPrioritas, selectedStatus, searchQuery]);

  // Summary Metrics
  const totalIsu = filteredData.length;
  const countKritis = filteredData.filter((i) => i.prioritas === 'P0').length;
  const countOnProgress = filteredData.filter((i) => i.status === 'On Progress').length;
  const countResolved = filteredData.filter((i) => i.status === 'Resolved' || i.status === 'Monitoring').length;
  const avgProgres = totalIsu > 0
    ? Math.round(filteredData.reduce((acc, curr) => acc + curr.progres, 0) / totalIsu)
    : 0;

  // Interactive KPI Click-to-Filter Handlers
  const handleKpiCardClick = (filterType: 'all' | 'p0' | 'progress' | 'resolved') => {
    if (activeKpiFilter === filterType) {
      // Reset filter
      setActiveKpiFilter(null);
      setSelectedPrioritas('ALL');
      setSelectedStatus('ALL');
      return;
    }

    setActiveKpiFilter(filterType);
    if (filterType === 'all') {
      setSelectedPrioritas('ALL');
      setSelectedStatus('ALL');
    } else if (filterType === 'p0') {
      setSelectedPrioritas('P0');
      setSelectedStatus('ALL');
    } else if (filterType === 'progress') {
      setSelectedPrioritas('ALL');
      setSelectedStatus('On Progress');
    } else if (filterType === 'resolved') {
      setSelectedPrioritas('ALL');
      setSelectedStatus('Resolved');
    }
  };

  const resetAllFilters = () => {
    setSelectedKategori('ALL');
    setSelectedPrioritas('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
    setActiveKpiFilter(null);
  };

  const isFilterActive =
    selectedKategori !== 'ALL' ||
    selectedPrioritas !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    Boolean(searchQuery.trim()) ||
    activeKpiFilter !== null;

  // Open Add Form
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      ...EMPTY_FORM,
      cabangCode: isAll ? 'R99' : selectedTerminal,
      cabangName: isAll ? 'Regional 4 (Konsolidasi)' : (OFFICIAL_BRANCHES.find(b => b.code === selectedTerminal)?.name || selectedTerminal),
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (item: IsuStrategisItem) => {
    setEditingItem(item);
    setFormData({
      kode: item.kode,
      cabangCode: item.cabangCode,
      cabangName: item.cabangName,
      kategori: item.kategori,
      prioritas: item.prioritas,
      status: item.status,
      judul: item.judul,
      akarMasalah: item.akarMasalah,
      tindakLanjut: item.tindakLanjut,
      pic: item.pic,
      targetSelesai: item.targetSelesai,
      progres: item.progres,
      dampak: item.dampak,
    });
    setFormErrors({});
    setDetailModalItem(null);
    setFormModalOpen(true);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.judul.trim() || formData.judul.trim().length < 5) {
      errs.judul = 'Judul isu wajib diisi (minimal 5 karakter).';
    }
    if (!formData.akarMasalah.trim() || formData.akarMasalah.trim().length < 5) {
      errs.akarMasalah = 'Akar masalah wajib diisi (minimal 5 karakter).';
    }
    if (!formData.tindakLanjut.trim() || formData.tindakLanjut.trim().length < 5) {
      errs.tindakLanjut = 'Rencana tindak lanjut wajib diisi (minimal 5 karakter).';
    }
    if (!formData.pic.trim() || formData.pic.trim().length < 2) {
      errs.pic = 'PIC penanggung jawab wajib diisi.';
    }
    if (!formData.targetSelesai.trim()) {
      errs.targetSelesai = 'Target tanggal / batas waktu wajib diisi.';
    }
    if (!formData.dampak.trim() || formData.dampak.trim().length < 5) {
      errs.dampak = 'Target dampak positif wajib diisi (minimal 5 karakter).';
    }
    if (formData.progres < 0 || formData.progres > 100) {
      errs.progres = 'Progres harus bernilai antara 0% - 100%.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Form (Add or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingItem);
      const url = isEdit ? `/api/isu-strategis/${editingItem!.id}` : '/api/isu-strategis';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Gagal menyimpan data ke database.');
      }

      showToast('success', isEdit ? 'Isu strategis berhasil diperbarui di PostgreSQL.' : 'Isu strategis baru berhasil disimpan ke PostgreSQL.');
      setFormModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat menyimpan data.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Action
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/isu-strategis/${deleteConfirmItem.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Gagal menghapus data dari database.');
      }

      showToast('success', `Isu strategis [${deleteConfirmItem.kode}] berhasil dihapus dari PostgreSQL.`);
      setDeleteConfirmItem(null);
      setDetailModalItem(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus data isu strategis.';
      showToast('error', msg);
    } finally {
      setDeleting(false);
    }
  };

  // Quick Status Update
  const handleQuickStatusChange = async (item: IsuStrategisItem, newStatus: IsuStrategisItem['status']) => {
    try {
      const res = await fetch(`/api/isu-strategis/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memperbarui status.');
      }
      showToast('success', `Status [${item.kode}] berhasil diubah menjadi "${newStatus}".`);
      if (detailModalItem && detailModalItem.id === item.id) {
        setDetailModalItem({ ...detailModalItem, status: newStatus });
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui status.';
      showToast('error', msg);
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'P0': return 'badge-p0-kritis';
      case 'P1': return 'badge-p1-tinggi';
      default: return 'badge-p2-sedang';
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'On Progress': return 'badge-status-progress';
      case 'Monitoring': return 'badge-status-monitoring';
      case 'Resolved': return 'badge-status-resolved';
      default: return 'badge-status-open';
    }
  };

  return (
    <div className="isu-strategis-workspace">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`isu-toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="isu-toast-close"
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Header Banner */}
      <section className="isu-header-card">
        <div className="isu-header-top-row">
          <div className="isu-header-main">
            <div className="isu-header-icon-wrap">
              <Target size={22} color="var(--accent-blue)" aria-hidden="true" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 className="isu-title">Manajemen Isu Strategis & Program Prioritas</h2>
                <span className="badge-branch-tag">
                  <Building size={11} style={{ marginRight: '4px' }} />
                  {branchTitle}
                </span>
              </div>
              <p className="isu-subtitle">
                Monitoring penyelesaian hambatan operasional, mitigasi risiko finansial, dan kesiapan fasilitas strategis Pelindo Regional 4.
              </p>
            </div>
          </div>

          {/* Action Buttons: Add Issue & Refresh */}
          <div className="isu-header-actions">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="btn-dark"
              style={{
                height: '36px',
                padding: '0 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: 'var(--radius-md)',
              }}
              title="Segarkan Data dari PostgreSQL"
              aria-label="Segarkan data isu strategis"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>

            {!isBod && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn-primary"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-blue)',
                  color: 'var(--text-on-accent)',
                  cursor: 'pointer',
                }}
                title="Tambah Isu Strategis Baru ke Database PostgreSQL"
              >
                <Plus size={15} />
                <span>+ Tambah Isu</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Database Error Banner */}
      {error && (
        <div className="isu-error-banner" role="alert">
          <AlertCircle size={18} color="var(--status-danger-text)" />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '13px' }}>Gagal Mengambil Data dari PostgreSQL:</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>{error}</p>
          </div>
          <button type="button" onClick={fetchData} className="btn-dark" style={{ padding: '4px 10px', fontSize: '11px' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {/* 2. Interactive KPI Summary Cards (Click-to-Filter) */}
      <section className="isu-kpi-grid" aria-label="Ringkasan Metrik Isu Strategis">
        {/* Card 1: Total Isu */}
        <div
          className={`isu-kpi-card ${activeKpiFilter === 'all' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('all')}
          title="Klik untuk menyaring semua isu"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleKpiCardClick('all');
            }
          }}
        >
          {activeKpiFilter === 'all' && <span className="isu-kpi-active-tag">Filter Aktif</span>}
          <div className="isu-kpi-icon-wrap" style={{ backgroundColor: 'rgba(2, 132, 199, 0.12)' }}>
            <Target size={20} color="var(--accent-blue)" />
          </div>
          <div className="isu-kpi-content">
            <span className="isu-kpi-label">Total Isu Terdaftar</span>
            <div className="isu-kpi-value-row">
              <span className="isu-kpi-val">{loading ? '-' : totalIsu}</span>
              <span className="isu-kpi-unit">Isu Aktif</span>
            </div>
            <span className="isu-kpi-subtext">Klik untuk tampilkan semua</span>
          </div>
        </div>

        {/* Card 2: P0 Kritis */}
        <div
          className={`isu-kpi-card danger ${activeKpiFilter === 'p0' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('p0')}
          title="Klik untuk menyaring Isu Kritis P0 Direksi"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleKpiCardClick('p0');
            }
          }}
        >
          {activeKpiFilter === 'p0' && <span className="isu-kpi-active-tag">Filter Aktif</span>}
          <div className="isu-kpi-icon-wrap" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
            <AlertTriangle size={20} color="var(--status-danger-text)" />
          </div>
          <div className="isu-kpi-content">
            <span className="isu-kpi-label">Isu Kritis (P0 - Direksi)</span>
            <div className="isu-kpi-value-row">
              <span className="isu-kpi-val" style={{ color: 'var(--status-danger-text)' }}>
                {loading ? '-' : countKritis}
              </span>
              <span className="isu-kpi-unit">Urgent Action</span>
            </div>
            <span className="isu-kpi-subtext">Memerlukan atensi manajemen</span>
          </div>
        </div>

        {/* Card 3: Dalam Penanganan */}
        <div
          className={`isu-kpi-card warning ${activeKpiFilter === 'progress' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('progress')}
          title="Klik untuk menyaring Isu On Progress"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleKpiCardClick('progress');
            }
          }}
        >
          {activeKpiFilter === 'progress' && <span className="isu-kpi-active-tag">Filter Aktif</span>}
          <div className="isu-kpi-icon-wrap" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
            <RotateCw size={20} color="var(--status-alert-text)" />
          </div>
          <div className="isu-kpi-content">
            <span className="isu-kpi-label">Dalam Penanganan Aktif</span>
            <div className="isu-kpi-value-row">
              <span className="isu-kpi-val" style={{ color: 'var(--status-alert-text)' }}>
                {loading ? '-' : countOnProgress}
              </span>
              <span className="isu-kpi-unit">On Progress</span>
            </div>
            <span className="isu-kpi-subtext">Rencana aksi sedang berjalan</span>
          </div>
        </div>

        {/* Card 4: Progres Rata-Rata / Resolved */}
        <div
          className={`isu-kpi-card success ${activeKpiFilter === 'resolved' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('resolved')}
          title="Klik untuk menyaring Isu Tuntas / Resolved"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleKpiCardClick('resolved');
            }
          }}
        >
          {activeKpiFilter === 'resolved' && <span className="isu-kpi-active-tag">Filter Aktif</span>}
          <div className="isu-kpi-icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
            <CheckCircle2 size={20} color="var(--status-good-text)" />
          </div>
          <div className="isu-kpi-content">
            <span className="isu-kpi-label">Progres Rata-Rata</span>
            <div className="isu-kpi-value-row">
              <span className="isu-kpi-val" style={{ color: 'var(--status-good-text)' }}>
                {loading ? '-' : `${avgProgres}%`}
              </span>
              <span className="isu-kpi-unit">Terselesaikan</span>
            </div>
            <div className="isu-kpi-mini-bar-bg">
              <div className="isu-kpi-mini-bar-fill" style={{ width: `${avgProgres}%` }} />
            </div>
            <span className="isu-kpi-subtext" style={{ marginTop: '4px' }}>
              {countResolved} isu tuntas / monitoring
            </span>
          </div>
        </div>
      </section>

      {/* 3. Direksi Attention Alert Banner (Only if P0 open or Overdue items exist) */}
      {!dismissAttentionAlert && (criticalPendingCount > 0 || overdueItemsCount > 0) && (
        <section className="isu-attention-banner" aria-label="Perhatian Direksi">
          <div className="isu-attention-content">
            <AlertTriangle size={22} color="var(--status-danger-text)" style={{ flexShrink: 0 }} />
            <div>
              <h4 className="isu-attention-title">PERHATIAN DIREKSI / BOD ACTION REQUIRED</h4>
              <p className="isu-attention-desc">
                Terdapat{' '}
                {criticalPendingCount > 0 && (
                  <strong>{criticalPendingCount} Isu Kritis P0 yang belum tuntas</strong>
                )}
                {criticalPendingCount > 0 && overdueItemsCount > 0 && ' dan '}
                {overdueItemsCount > 0 && (
                  <strong>{overdueItemsCount} Isu yang telah melewati target batas waktu</strong>
                )}
                . Segera evaluasi mitigasi risiko pada unit terkait.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedPrioritas('P0');
                setSelectedStatus('ALL');
                setActiveKpiFilter('p0');
              }}
              className="isu-attention-action-btn"
            >
              <span>Fokus Isu Kritis P0</span>
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => setDismissAttentionAlert(true)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '4px',
              }}
              title="Tutup banner peringatan"
              aria-label="Tutup banner perhatian direksi"
            >
              <X size={15} />
            </button>
          </div>
        </section>
      )}

      {/* 4. Filter Toolbar & Category Chips Row */}
      <section className="isu-toolbar-strip" aria-label="Toolbar Filter Isu Strategis">
        {/* Row 1: Search, Priority, Status & View Mode Switcher */}
        <div className="isu-toolbar-main-row">
          <div className="isu-search-box">
            <Search size={14} color="var(--text-muted)" aria-hidden="true" />
            <input
              type="text"
              placeholder="Cari judul isu, kode, PIC, atau cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="isu-search-input"
              aria-label="Cari isu strategis"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="isu-clear-search-btn"
                aria-label="Hapus kata pencarian"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="isu-toolbar-right-controls">
            {/* Filter Prioritas */}
            <select
              value={selectedPrioritas}
              onChange={(e) => {
                setSelectedPrioritas(e.target.value);
                setActiveKpiFilter(null);
              }}
              className="isu-select-control"
              aria-label="Filter Berdasarkan Tingkat Prioritas"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="P0">P0 - Kritis (BOD)</option>
              <option value="P1">P1 - Tinggi</option>
              <option value="P2">P2 - Sedang</option>
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setActiveKpiFilter(null);
              }}
              className="isu-select-control"
              aria-label="Filter Berdasarkan Status Penanganan"
            >
              <option value="ALL">Semua Status</option>
              <option value="Open">Open</option>
              <option value="On Progress">On Progress</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Resolved">Resolved</option>
            </select>

            {/* Reset Filters Button */}
            {isFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="btn-dark"
                style={{
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger-text)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
                title="Kembalikan semua filter ke kondisi awal"
              >
                <FilterX size={13} />
                <span>Reset</span>
              </button>
            )}

            {/* View Mode Switcher Toggle */}
            <div className="isu-view-switcher" role="radiogroup" aria-label="Mode Tampilan Isu Strategis">
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'board'}
                onClick={() => setViewMode('board')}
                className={`isu-view-btn ${viewMode === 'board' ? 'is-active' : ''}`}
                title="Tampilan Kanban Board Alur Kerja"
              >
                <Kanban size={13} />
                <span>Board</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`isu-view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
                title="Tampilan Tabel Matriks Rinci"
              >
                <TableIcon size={13} />
                <span>Matriks</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`isu-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                title="Tampilan Kartu Ringkas"
              >
                <LayoutGrid size={13} />
                <span>Kartu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Category Chips Filter */}
        <div className="isu-category-chips-row">
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>
            Kategori:
          </span>
          {ISU_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const isActive = selectedKategori === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedKategori(cat)}
                className={`isu-category-chip ${isActive ? 'is-active' : ''}`}
              >
                <span>{cat === 'ALL' ? 'Semua Kategori' : cat}</span>
                <span className="isu-category-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Main Content Area According to View Mode */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Mengambil data isu strategis dari PostgreSQL...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="isu-empty-card">
          <Target size={34} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text-title)' }}>Tidak Ada Isu Ditemukan</h4>
          <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Tidak ada isu strategis yang cocok dengan kriteria filter aktif Anda.
          </p>
          {isFilterActive && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
              }}
            >
              <FilterX size={13} />
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* VIEW MODE A: KANBAN BOARD */}
          {viewMode === 'board' && (
            <section className="isu-kanban-board" aria-label="Kanban Board Isu Strategis">
              {KANBAN_COLUMNS.map((col) => {
                const colItems = filteredData.filter((i) => i.status === col.status);
                return (
                  <div key={col.status} className="isu-kanban-col">
                    <div className="isu-kanban-col-head" style={{ borderTop: `3px solid ${col.accentColor}` }}>
                      <div className="isu-kanban-col-title">
                        <span>{col.label}</span>
                      </div>
                      <span className="isu-kanban-badge-count">{colItems.length}</span>
                    </div>

                    <div className="isu-kanban-col-body">
                      {colItems.length === 0 ? (
                        <div className="isu-kanban-empty">
                          <span>Tidak ada isu pada tahap {col.label}</span>
                        </div>
                      ) : (
                        colItems.map((item) => {
                          const dueStatus = getItemDueStatus(item.targetSelesai, item.status);
                          return (
                            <article
                              key={item.id}
                              className={`isu-kanban-card ${item.prioritas === 'P0' ? 'p0-glow' : ''}`}
                              onClick={() => setDetailModalItem(item)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setDetailModalItem(item);
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                  <span className={`isu-badge ${getPriorityBadgeClass(item.prioritas)}`}>
                                    {item.prioritas}
                                  </span>
                                  <span className="isu-badge badge-kategori" style={{ fontSize: '10px' }}>
                                    {item.kategori}
                                  </span>
                                </div>
                                <span className="isu-code-tag">{item.kode}</span>
                              </div>

                              <h4 className="isu-kanban-card-title">{item.judul}</h4>
                              <p className="isu-kanban-card-desc">{item.akarMasalah}</p>

                              {/* Progress Bar */}
                              <div className="isu-progress-section">
                                <div className="isu-progress-labels">
                                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Progres</span>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue-text)', fontFamily: 'var(--font-jetbrains), monospace', fontVariantNumeric: 'tabular-nums' }}>
                                    {item.progres}%
                                  </span>
                                </div>
                                <div className="isu-progress-bar-bg">
                                  <div
                                    className="isu-progress-bar-fill"
                                    style={{
                                      width: `${item.progres}%`,
                                      backgroundColor:
                                        item.progres >= 80
                                          ? 'var(--status-good-text)'
                                          : item.progres >= 50
                                          ? 'var(--accent-blue)'
                                          : 'var(--status-alert-text)',
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="isu-kanban-card-footer">
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {item.cabangName}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {dueStatus.isOverdue ? (
                                    <span className="badge-overdue" title={`Terlambat ${dueStatus.daysDiff} hari`}>
                                      <Clock size={10} />
                                      <span>Overdue ({dueStatus.daysDiff}h)</span>
                                    </span>
                                  ) : dueStatus.isDueSoon ? (
                                    <span className="badge-duesoon" title={`Jatuh tempo dalam ${dueStatus.daysDiff} hari`}>
                                      <Clock size={10} />
                                      <span>{dueStatus.daysDiff}h lagi</span>
                                    </span>
                                  ) : (
                                    <span>{item.targetSelesai}</span>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* VIEW MODE B: DETAILED DATA TABLE */}
          {viewMode === 'table' && (
            <section className="isu-table-card" aria-label="Tabel Matriks Isu Strategis">
              <div className="isu-section-header" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--accent-blue)" />
                  <h3 className="isu-section-title">Matriks Monitoring Tindak Lanjut Regional 4</h3>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Menampilkan {filteredData.length} dari {items.length} Isu
                </span>
              </div>

              <div className="isu-table-scroll-container">
                <table className="card-table isu-table" aria-label="Tabel rincian isu strategis">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                      <th style={{ width: '120px' }}>Kode Isu</th>
                      <th style={{ width: '150px' }}>Cabang / Entitas</th>
                      <th style={{ width: '110px' }}>Kategori</th>
                      <th>Judul & Akar Masalah</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Prioritas</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '130px' }}>Progres</th>
                      <th style={{ width: '130px' }}>Target & Batas Waktu</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, idx) => {
                      const dueStatus = getItemDueStatus(item.targetSelesai, item.status);
                      return (
                        <tr key={item.id} onClick={() => setDetailModalItem(item)} style={{ cursor: 'pointer' }}>
                          <td data-label="No" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                            {idx + 1}
                          </td>
                          <td data-label="Kode Isu" style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '11px', fontWeight: 700 }}>
                            {item.kode}
                          </td>
                          <td data-label="Cabang">
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>{item.cabangName}</span>
                          </td>
                          <td data-label="Kategori">
                            <span className="isu-badge badge-kategori" style={{ fontSize: '10px' }}>{item.kategori}</span>
                          </td>
                          <td data-label="Judul & Akar Masalah">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-title)' }}>
                                {item.judul}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                {item.akarMasalah}
                              </span>
                            </div>
                          </td>
                          <td data-label="Prioritas" style={{ textAlign: 'center' }}>
                            <span className={`isu-badge ${getPriorityBadgeClass(item.prioritas)}`} style={{ fontSize: '10px' }}>
                              {item.prioritas}
                            </span>
                          </td>
                          <td data-label="Status" style={{ textAlign: 'center' }}>
                            <span className={`isu-badge ${getStatusBadgeClass(item.status)}`} style={{ fontSize: '10px' }}>
                              {item.status}
                            </span>
                          </td>
                          <td data-label="Progres">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div className="isu-table-mini-bar-bg">
                                <div
                                  className="isu-table-mini-bar-fill"
                                  style={{ width: `${item.progres}%` }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-jetbrains), monospace', fontVariantNumeric: 'tabular-nums' }}>
                                {item.progres}%
                              </span>
                            </div>
                          </td>
                          <td data-label="Target Selesai" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>{item.targetSelesai}</span>
                              {dueStatus.isOverdue && (
                                <span className="badge-overdue" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                  Overdue {dueStatus.daysDiff}h
                                </span>
                              )}
                              {dueStatus.isDueSoon && (
                                <span className="badge-duesoon" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                  {dueStatus.daysDiff}h lagi
                                </span>
                              )}
                            </div>
                          </td>
                          <td data-label="Aksi" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn-dark"
                                onClick={() => setDetailModalItem(item)}
                                style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px' }}
                                title="Detail Isu"
                              >
                                Detail
                              </button>
                              {!isBod && (
                                <button
                                  type="button"
                                  className="btn-dark"
                                  onClick={() => handleOpenEdit(item)}
                                  style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px' }}
                                  title="Edit Isu"
                                >
                                  <Edit3 size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW MODE C: PRIORITY CARDS GRID */}
          {viewMode === 'grid' && (
            <section className="isu-section-container" aria-label="Grid Kartu Isu Strategis">
              <div className="isu-cards-grid">
                {filteredData.map((item) => {
                  const dueStatus = getItemDueStatus(item.targetSelesai, item.status);
                  return (
                    <article
                      key={item.id}
                      className={`isu-card-item ${item.prioritas === 'P0' ? 'priority-p0-glow' : ''}`}
                      onClick={() => setDetailModalItem(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetailModalItem(item);
                        }
                      }}
                    >
                      <div className="isu-card-top-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className={`isu-badge ${getPriorityBadgeClass(item.prioritas)}`}>
                            {item.prioritas === 'P0' ? 'P0 • Kritis' : item.prioritas === 'P1' ? 'P1 • Tinggi' : 'P2 • Sedang'}
                          </span>
                          <span className="isu-badge badge-kategori">{item.kategori}</span>
                          <span className={`isu-badge ${getStatusBadgeClass(item.status)}`}>{item.status}</span>
                        </div>
                        <span className="isu-code-tag">{item.kode}</span>
                      </div>

                      <h4 className="isu-card-heading">{item.judul}</h4>
                      <p className="isu-card-desc">{item.akarMasalah}</p>

                      <div className="isu-progress-section">
                        <div className="isu-progress-labels">
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kemajuan Tindak Lanjut</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue-text)', fontFamily: 'var(--font-jetbrains), monospace', fontVariantNumeric: 'tabular-nums' }}>
                            {item.progres}%
                          </span>
                        </div>
                        <div className="isu-progress-bar-bg">
                          <div
                            className="isu-progress-bar-fill"
                            style={{
                              width: `${item.progres}%`,
                              backgroundColor:
                                item.progres >= 80
                                  ? 'var(--status-good-text)'
                                  : item.progres >= 50
                                  ? 'var(--accent-blue)'
                                  : 'var(--status-alert-text)',
                            }}
                          />
                        </div>
                      </div>

                      <div className="isu-card-footer">
                        <div className="isu-card-meta-item">
                          <Building size={12} color="var(--text-muted)" />
                          <span>{item.cabangName}</span>
                        </div>
                        <div className="isu-card-meta-item">
                          <Calendar size={12} color="var(--text-muted)" />
                          <span>Target: {item.targetSelesai}</span>
                          {dueStatus.isOverdue && (
                            <span className="badge-overdue" style={{ marginLeft: 4 }}>Overdue</span>
                          )}
                        </div>
                        <div className="isu-card-click-hint">
                          <span>Lihat Detail</span>
                          <ChevronRight size={13} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* 6. Redesigned Detail Modal (Executive Briefing Format) */}
      {detailModalItem && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100000 }}
          onClick={() => setDetailModalItem(null)}
        >
          <div
            ref={detailDialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-isu-title"
            style={{ maxWidth: '780px', padding: '24px', borderRadius: 'var(--radius-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className={`isu-badge ${getPriorityBadgeClass(detailModalItem.prioritas)}`}>
                    {detailModalItem.prioritas === 'P0' ? 'P0 • Kritis (Direksi)' : detailModalItem.prioritas === 'P1' ? 'P1 • Tinggi' : 'P2 • Sedang'}
                  </span>
                  <span className="isu-badge badge-kategori">{detailModalItem.kategori}</span>
                  <span className={`isu-badge ${getStatusBadgeClass(detailModalItem.status)}`}>
                    {detailModalItem.status}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    [{detailModalItem.kode}]
                  </span>
                </div>
                <h3 id="modal-isu-title" style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-title)', lineHeight: 1.35 }}>
                  {detailModalItem.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="btn-dark"
                style={{ padding: '6px', borderRadius: '50%', cursor: 'pointer' }}
                aria-label="Tutup dialog detail"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: 2-Column Executive Briefing Grid */}
            <div className="isu-modal-grid-2" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              {/* Left Column: Problem Analysis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building size={12} />
                    <span>Lokasi Unit / Cabang</span>
                  </span>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 700, color: 'var(--text-title)' }}>
                    {detailModalItem.cabangName} ({detailModalItem.cabangCode})
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Akar Permasalahan (Root Cause)
                  </span>
                  <p style={{ margin: '3px 0 0 0', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-inner)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    {detailModalItem.akarMasalah}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Target Dampak Positif / Capaian
                  </span>
                  <p style={{ margin: '3px 0 0 0', color: 'var(--text-secondary)' }}>
                    {detailModalItem.dampak}
                  </p>
                </div>
              </div>

              {/* Right Column: Action Plan & Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue-text)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} />
                    <span>Rencana Tindak Lanjut & Mitigasi</span>
                  </span>
                  <p style={{ margin: '3px 0 0 0', color: 'var(--text-main)', backgroundColor: 'var(--bg-inner)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-blue)', borderTop: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {detailModalItem.tindakLanjut}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={11} />
                      <span>PIC Penanggung Jawab</span>
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontWeight: 700, color: 'var(--text-main)' }}>
                      {detailModalItem.pic}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} />
                      <span>Target Selesai</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                        {detailModalItem.targetSelesai}
                      </p>
                      {(() => {
                        const due = getItemDueStatus(detailModalItem.targetSelesai, detailModalItem.status);
                        if (due.isOverdue) return <span className="badge-overdue" style={{ fontSize: '9px' }}>Overdue</span>;
                        if (due.isDueSoon) return <span className="badge-duesoon" style={{ fontSize: '9px' }}>{due.daysDiff}h lagi</span>;
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Kemajuan Realisasi
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-blue-text)', fontFamily: 'var(--font-jetbrains), monospace', fontVariantNumeric: 'tabular-nums' }}>
                      {detailModalItem.progres}%
                    </span>
                  </div>
                  <div className="isu-progress-bar-bg" style={{ height: '8px' }}>
                    <div
                      className="isu-progress-bar-fill"
                      style={{
                        width: `${detailModalItem.progres}%`,
                        height: '8px',
                        backgroundColor:
                          detailModalItem.progres >= 80
                            ? 'var(--status-good-text)'
                            : detailModalItem.progres >= 50
                            ? 'var(--accent-blue)'
                            : 'var(--status-alert-text)',
                      }}
                    />
                  </div>
                </div>

                {/* Quick Status Pill Actions */}
                {!isBod && (
                  <div style={{ marginTop: '2px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Ubah Status Cepat:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(['Open', 'On Progress', 'Monitoring', 'Resolved'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleQuickStatusChange(detailModalItem, st)}
                          className={`isu-badge ${getStatusBadgeClass(st)}`}
                          style={{
                            cursor: 'pointer',
                            padding: '4px 10px',
                            border: detailModalItem.status === st ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                            opacity: detailModalItem.status === st ? 1 : 0.65,
                            transform: detailModalItem.status === st ? 'scale(1.04)' : 'none',
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!isBod && (
                  <>
                    <button
                      type="button"
                      className="btn-dark"
                      onClick={() => handleOpenEdit(detailModalItem)}
                      style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Edit3 size={13} />
                      <span>Edit Data</span>
                    </button>
                    <button
                      type="button"
                      className="btn-dark"
                      onClick={() => setDeleteConfirmItem(detailModalItem)}
                      style={{
                        padding: '7px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: 'var(--status-danger-text)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Hapus</span>
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn-dark"
                    onClick={() => {
                      const target = detailModalItem.kategori === 'Finansial' ? 'keuangan' : 'opkom';
                      onNavigateTab(target);
                      setDetailModalItem(null);
                    }}
                    style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span>Buka Modul Terkait</span>
                    <ArrowUpRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setDetailModalItem(null)}
                  style={{ padding: '7px 18px', fontSize: '12px' }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Form Modal: Tambah & Edit Isu Strategis */}
      {formModalOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100000 }}
          onClick={() => !submitting && setFormModalOpen(false)}
        >
          <div
            ref={formDialogRef}
            className="modal-content isu-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="isu-form-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="var(--accent-blue)" />
                <h3 id="modal-form-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-title)' }}>
                  {editingItem ? `Edit Isu Strategis [${editingItem.kode}]` : 'Tambah Isu Strategis Baru ke PostgreSQL'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                disabled={submitting}
                className="btn-dark"
                style={{ padding: '5px', borderRadius: '50%' }}
                aria-label="Tutup formulir"
              >
                <X size={15} />
              </button>
            </div>

            <form method="post" onSubmit={handleSubmitForm} className="isu-form-body">
              {/* Form Grid Row 1: Cabang & Kategori */}
              <div className="isu-form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="form-cabang">Cabang / Entitas *</label>
                  <select
                    id="form-cabang"
                    className="form-input"
                    value={formData.cabangCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const branch = OFFICIAL_BRANCHES.find(b => b.code === code);
                      setFormData(prev => ({
                        ...prev,
                        cabangCode: code,
                        cabangName: code === 'R99' ? 'Regional 4 (Konsolidasi)' : (branch?.name || code),
                      }));
                    }}
                    required
                  >
                    {OFFICIAL_BRANCHES.map(b => (
                      <option key={b.code} value={b.code}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-kategori">Kategori Isu *</label>
                  <select
                    id="form-kategori"
                    className="form-input"
                    value={formData.kategori}
                    onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as FormState['kategori'] }))}
                    required
                  >
                    <option value="Operasional">Operasional</option>
                    <option value="Finansial">Finansial</option>
                    <option value="Fasilitas">Fasilitas & Teknik</option>
                    <option value="Komersial">Komersial</option>
                    <option value="HSSE">HSSE & Keselamatan</option>
                    <option value="SDM">SDM & Organisasi</option>
                  </select>
                </div>
              </div>

              {/* Form Grid Row 2: Prioritas & Status */}
              <div className="isu-form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="form-prioritas">Tingkat Prioritas *</label>
                  <select
                    id="form-prioritas"
                    className="form-input"
                    value={formData.prioritas}
                    onChange={(e) => setFormData(prev => ({ ...prev, prioritas: e.target.value as FormState['prioritas'] }))}
                    required
                  >
                    <option value="P0">P0 - Kritis (Perlu Intervensi Direksi)</option>
                    <option value="P1">P1 - Tinggi (Prioritas Regional)</option>
                    <option value="P2">P2 - Sedang (Rencana Kerja Cabang)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-status">Status Penanganan *</label>
                  <select
                    id="form-status"
                    className="form-input"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as FormState['status'] }))}
                    required
                  >
                    <option value="Open">Open</option>
                    <option value="On Progress">On Progress</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Judul Isu */}
              <div className="form-group">
                <label className="form-label" htmlFor="form-judul">Judul Isu Strategis *</label>
                <input
                  id="form-judul"
                  type="text"
                  className={`form-input ${formErrors.judul ? 'has-error' : ''}`}
                  placeholder="Contoh: Optimalisasi Utilisasi Kapasitas Dermaga & Reduksi Waiting Time"
                  value={formData.judul}
                  onChange={(e) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
                  required
                />
                {formErrors.judul && <span className="form-error-msg">{formErrors.judul}</span>}
              </div>

              {/* Akar Masalah */}
              <div className="form-group">
                <label className="form-label" htmlFor="form-akar">Akar Permasalahan (Root Cause) *</label>
                <textarea
                  id="form-akar"
                  className={`form-input ${formErrors.akarMasalah ? 'has-error' : ''}`}
                  rows={2}
                  placeholder="Deskripsikan faktor utama penyebab isu terjadi..."
                  value={formData.akarMasalah}
                  onChange={(e) => setFormData(prev => ({ ...prev, akarMasalah: e.target.value }))}
                  required
                />
                {formErrors.akarMasalah && <span className="form-error-msg">{formErrors.akarMasalah}</span>}
              </div>

              {/* Rencana Tindak Lanjut */}
              <div className="form-group">
                <label className="form-label" htmlFor="form-tindak">Rencana Tindak Lanjut & Mitigasi *</label>
                <textarea
                  id="form-tindak"
                  className={`form-input ${formErrors.tindakLanjut ? 'has-error' : ''}`}
                  rows={2}
                  placeholder="Langkah konkret penyelesaian dan mitigasi risiko..."
                  value={formData.tindakLanjut}
                  onChange={(e) => setFormData(prev => ({ ...prev, tindakLanjut: e.target.value }))}
                  required
                />
                {formErrors.tindakLanjut && <span className="form-error-msg">{formErrors.tindakLanjut}</span>}
              </div>

              {/* Form Grid Row 3: PIC & Target Waktu */}
              <div className="isu-form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="form-pic">PIC Penanggung Jawab *</label>
                  <input
                    id="form-pic"
                    type="text"
                    className={`form-input ${formErrors.pic ? 'has-error' : ''}`}
                    placeholder="Contoh: Divisi Operasi / Nama Pejabat"
                    value={formData.pic}
                    onChange={(e) => setFormData(prev => ({ ...prev, pic: e.target.value }))}
                    required
                  />
                  {formErrors.pic && <span className="form-error-msg">{formErrors.pic}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-target">Target Tanggal / Selesai *</label>
                  <input
                    id="form-target"
                    type="text"
                    className={`form-input ${formErrors.targetSelesai ? 'has-error' : ''}`}
                    placeholder="Contoh: 31 Des 2026 atau 2026-12-31"
                    value={formData.targetSelesai}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetSelesai: e.target.value }))}
                    required
                  />
                  {formErrors.targetSelesai && <span className="form-error-msg">{formErrors.targetSelesai}</span>}
                </div>
              </div>

              {/* Progres Slider */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="form-progres">Kemajuan / Progres Penyelesaian</label>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-blue-text)', fontFamily: 'var(--font-jetbrains), monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {formData.progres}%
                  </span>
                </div>
                <input
                  id="form-progres"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.progres}
                  onChange={(e) => setFormData(prev => ({ ...prev, progres: Number(e.target.value) }))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Target Dampak Positif */}
              <div className="form-group">
                <label className="form-label" htmlFor="form-dampak">Target Dampak Positif / Capaian *</label>
                <textarea
                  id="form-dampak"
                  className={`form-input ${formErrors.dampak ? 'has-error' : ''}`}
                  rows={2}
                  placeholder="Target peningkatan kinerja, efisiensi biaya, atau kepuasan layanan..."
                  value={formData.dampak}
                  onChange={(e) => setFormData(prev => ({ ...prev, dampak: e.target.value }))}
                  required
                />
                {formErrors.dampak && <span className="form-error-msg">{formErrors.dampak}</span>}
              </div>

              {/* Form Footer Buttons */}
              <div className="isu-form-modal-footer">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  disabled={submitting}
                  className="btn-dark"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Menyimpan ke PostgreSQL...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>{editingItem ? 'Simpan Perubahan' : 'Simpan Isu Strategis'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Dialog Konfirmasi Hapus */}
      {deleteConfirmItem && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100001 }}
          onClick={() => !deleting && setDeleteConfirmItem(null)}
        >
          <div
            ref={deleteDialogRef}
            className="modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-delete-title"
            style={{ maxWidth: '420px', padding: '22px', borderRadius: 'var(--radius-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Trash2 size={20} color="var(--status-danger-text)" />
              <h4 id="modal-delete-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-title)' }}>
                Konfirmasi Hapus Isu Strategis
              </h4>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus isu strategis <strong>[{deleteConfirmItem.kode}] {deleteConfirmItem.judul}</strong>? Tindakan ini akan menghapus data secara permanen dari PostgreSQL.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deleting}
                className="btn-dark"
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deleting}
                style={{
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  backgroundColor: 'var(--status-danger-bg)',
                  borderColor: 'var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                  border: '1px solid var(--status-danger-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  'Ya, Hapus Permanen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
