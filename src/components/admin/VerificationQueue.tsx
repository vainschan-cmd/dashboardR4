'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  Send,
  RefreshCw,
  Layers,
  Search,
  X,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { MonthlyRecord, UserRole, VerificationStatus } from '@/lib/types';
import { isAnomalyDeviation } from '@/lib/governanceNav';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import StatusBadge from '../ui/StatusBadge';

interface MatrixDepartmentStatus {
  department_id: string;
  department_code: string;
  status: VerificationStatus;
}

interface MatrixBranchRow {
  branch_id: string;
  branch_name: string;
  region: string;
  departments: MatrixDepartmentStatus[];
}

interface VerificationQueueProps {
  selectedMonth: number;
  selectedYear: number;
  userRole: UserRole;
  username: string;
  onVerificationDone: () => void;
}

export default function VerificationQueue({
  selectedMonth,
  selectedYear,
  userRole,
  username,
  onVerificationDone,
}: VerificationQueueProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'matrix'>('queue');
  const [pendingRecords, setPendingRecords] = useState<MonthlyRecord[]>([]);
  const [matrixData, setMatrixData] = useState<MatrixBranchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Queue filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  // Revision dialog
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const revisionDialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(revisionDialogRef, revisionModalOpen, () => {
    if (!isSubmitting) setRevisionModalOpen(false);
  });

  const fetchVerificationData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/verification?month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();
      if (data.success) {
        setPendingRecords(data.pendingRecords || []);
        setMatrixData(data.matrix || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVerificationData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchVerificationData]);

  // Distinct branches & departments in current queue
  const queueBranches = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of pendingRecords) {
      const id = r.branch_id || r.branch_code || '';
      const label = r.branch_name || r.branch_code || id;
      if (id && !map.has(id)) map.set(id, label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [pendingRecords]);

  const queueDepartments = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of pendingRecords) {
      const id = r.department_id || '';
      const label = r.department_name || id;
      if (id && !map.has(id)) map.set(id, label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [pendingRecords]);

  const anomalyCount = useMemo(
    () =>
      pendingRecords.filter(
        (r) => isAnomalyDeviation(r.achievement_pct, r.target, r.realization).flagged
      ).length,
    [pendingRecords]
  );

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return pendingRecords.filter((r) => {
      if (branchFilter !== 'ALL' && (r.branch_id || r.branch_code) !== branchFilter) return false;
      if (deptFilter !== 'ALL' && r.department_id !== deptFilter) return false;
      if (onlyAnomalies && !isAnomalyDeviation(r.achievement_pct, r.target, r.realization).flagged) {
        return false;
      }
      if (!q) return true;
      return (
        (r.branch_name || '').toLowerCase().includes(q) ||
        (r.department_name || '').toLowerCase().includes(q) ||
        (r.indicator_name || '').toLowerCase().includes(q) ||
        (r.indicator_code || '').toLowerCase().includes(q) ||
        (r.uploaded_by || '').toLowerCase().includes(q)
      );
    });
  }, [pendingRecords, branchFilter, deptFilter, onlyAnomalies, searchTerm]);

  const matrixSummary = useMemo(() => {
    let total = 0;
    let verified = 0;
    let pending = 0;
    let revision = 0;
    for (const row of matrixData) {
      for (const cell of row.departments) {
        total += 1;
        if (cell.status === 'verified') verified += 1;
        else if (cell.status === 'pending_verification') pending += 1;
        else if (cell.status === 'revision_needed') revision += 1;
      }
    }
    const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, pending, revision, pct };
  }, [matrixData]);

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedRecordIds.includes(r.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecordIds(Array.from(new Set([...selectedRecordIds, ...filteredRecords.map((r) => r.id)])));
    } else {
      const filteredSet = new Set(filteredRecords.map((r) => r.id));
      setSelectedRecordIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    }
  };

  const handleToggleRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApprove = async () => {
    if (selectedRecordIds.length === 0) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordIds: selectedRecordIds,
          status: 'verified',
          verifierUsername: username,
          userRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memverifikasi data.');
      }
      setMessage({
        type: 'success',
        text: `Sukses! ${selectedRecordIds.length} indikator disahkan menjadi data resmi dashboard.`,
      });
      setSelectedRecordIds([]);
      fetchVerificationData();
      onVerificationDone();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memverifikasi data.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedRecordIds.length === 0 || !revisionNotes.trim()) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordIds: selectedRecordIds,
          status: 'revision_needed',
          verifierUsername: username,
          userRole,
          revisionNotes: revisionNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengirim permintaan revisi.');
      }
      setMessage({
        type: 'success',
        text: 'Permintaan revisi berhasil dikirimkan ke PIC pengunggah.',
      });
      setRevisionModalOpen(false);
      setRevisionNotes('');
      setSelectedRecordIds([]);
      fetchVerificationData();
      onVerificationDone();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim permintaan revisi.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMatrixCellClick = (branchId: string, deptId: string, status: VerificationStatus) => {
    if (status !== 'pending_verification') return;
    setBranchFilter(branchId);
    setDeptFilter(deptId);
    setOnlyAnomalies(false);
    setSearchTerm('');
    setActiveTab('queue');
  };

  const canVerify = ['super_admin', 'admin_regional'].includes(userRole);
  const hasActiveFilters =
    branchFilter !== 'ALL' || deptFilter !== 'ALL' || onlyAnomalies || searchTerm.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: selectedRecordIds.length > 0 ? '72px' : '0' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <FileCheck size={20} color="var(--accent-blue-text)" />
              <span>Verifikasi &amp; Monitoring Validasi Data</span>
            </h2>
            <p className="card-subtitle">
              Pemeriksaan akurasi laporan bulanan seluruh cabang (Periode {selectedMonth}/{selectedYear}) sebelum dipublikasikan ke Dashboard Eksekutif.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={fetchVerificationData}
              className="btn btn-secondary btn-sm"
              title="Perbarui Data Antrean"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="tabs-nav">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          >
            <Clock size={16} />
            <span>Antrean Verifikasi ({pendingRecords.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Matriks Kepatuhan Cabang ({matrixSummary.pct}%)</span>
          </button>
        </div>

        {message && (
          <div className={`alert-box alert-${message.type === 'error' ? 'danger' : 'success'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div>{message.text}</div>
          </div>
        )}

        {/* TAB 1: VERIFICATION QUEUE */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!canVerify && (
              <div className="alert-box alert-warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Mode Pantauan (Read-Only):</strong> Anda login sebagai{' '}
                  <strong>{userRole}</strong>. Tombol pengesahan hanya aktif bagi{' '}
                  <strong>Admin Regional</strong> atau <strong>Super Admin</strong>.
                </div>
              </div>
            )}

            {/* Filter Toolbar */}
            {pendingRecords.length > 0 && (
              <div className="gov-filter-bar">
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="Cari cabang, kode KPI, indikator, atau PIC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Cari antrean verifikasi"
                  />
                </div>

                <select
                  className="filter-select"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  aria-label="Filter cabang"
                >
                  <option value="ALL">Semua Cabang ({queueBranches.length})</option>
                  {queueBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>

                <select
                  className="filter-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  aria-label="Filter departemen"
                >
                  <option value="ALL">Semua Departemen</option>
                  {queueDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyAnomalies((prev) => !prev)}
                  className={`role-preset-chip ${onlyAnomalies ? 'active' : ''}`}
                  title="Tampilkan baris dengan deviasi tinggi (>130%, <70%, atau realisasi 0)"
                >
                  <ShieldAlert size={13} />
                  <span>Cek Deviasi ({anomalyCount})</span>
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setBranchFilter('ALL');
                      setDeptFilter('ALL');
                      setOnlyAnomalies(false);
                    }}
                    className="pwd-action-chip"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            )}

            {/* Pending List Table */}
            {isLoading ? (
              <div className="gov-skeleton-stack" aria-label="Memuat antrean verifikasi">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="gov-skeleton-row" />
                ))}
              </div>
            ) : pendingRecords.length === 0 ? (
              <div
                style={{
                  padding: '44px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-inner)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={38} color="var(--status-good-text)" />
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                  Semua Data Periode Ini Telah Terverifikasi
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '460px' }}>
                  Tidak ada antrean pengesahan tersisa untuk periode {selectedMonth}/{selectedYear}.
                  Anda dapat meninjau kelengkapan tiap cabang pada Matriks Kepatuhan.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className="btn-dark"
                  style={{
                    marginTop: '8px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Buka Matriks Kepatuhan Cabang</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-inner)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                Tidak ada antrean yang sesuai dengan filter aktif.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="card-table data-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label="Pilih semua baris antrean terfilter"
                          checked={allFilteredSelected}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col">Cabang</th>
                      <th scope="col">Departemen</th>
                      <th scope="col">Kode</th>
                      <th scope="col">Nama Indikator</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Target
                      </th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Realisasi
                      </th>
                      <th scope="col" style={{ textAlign: 'center' }}>
                        Satuan
                      </th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Capaian
                      </th>
                      <th scope="col" style={{ textAlign: 'center' }}>
                        Status KPI
                      </th>
                      <th scope="col">Pengunggah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => {
                      const anomaly = isAnomalyDeviation(r.achievement_pct, r.target, r.realization);
                      const isSelected = selectedRecordIds.includes(r.id);

                      return (
                        <tr
                          key={r.id}
                          style={{
                            backgroundColor: isSelected ? 'var(--blue-soft)' : undefined,
                          }}
                        >
                          <td data-label="Pilih" style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              aria-label={`Pilih rekaman ${r.indicator_name || r.id}`}
                              checked={isSelected}
                              onChange={() => handleToggleRecord(r.id)}
                            />
                          </td>
                          <td data-label="Cabang" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                            {r.branch_name || r.branch_code}
                          </td>
                          <td data-label="Departemen" style={{ color: 'var(--text-secondary)' }}>
                            {r.department_name || r.department_id}
                          </td>
                          <td
                            data-label="Kode"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: 'var(--accent-blue-text)',
                            }}
                          >
                            {r.indicator_code}
                          </td>
                          <td data-label="Nama Indikator" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                            {r.indicator_name}
                          </td>
                          <td
                            data-label="Target"
                            className="tabular-nums"
                            style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                          >
                            {r.target.toLocaleString('id-ID')}
                          </td>
                          <td
                            data-label="Realisasi"
                            className="tabular-nums"
                            style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-title)', fontFamily: 'var(--font-mono)' }}
                          >
                            {r.realization.toLocaleString('id-ID')}
                          </td>
                          <td data-label="Satuan" style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {r.unit}
                          </td>
                          <td data-label="Capaian" className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  color:
                                    r.status_color === 'green'
                                      ? 'var(--status-good-text)'
                                      : r.status_color === 'yellow'
                                        ? 'var(--status-alert-text)'
                                        : 'var(--status-danger-text)',
                                }}
                              >
                                {r.achievement_pct}%
                              </span>
                              {anomaly.flagged && (
                                <span
                                  className="perm-risk-badge sensitive"
                                  title={anomaly.reason}
                                >
                                  Cek Deviasi
                                </span>
                              )}
                            </div>
                          </td>
                          <td data-label="Status KPI" style={{ textAlign: 'center' }}>
                            <StatusBadge type="traffic_light" color={r.status_color} />
                          </td>
                          <td data-label="Pengunggah" style={{ fontSize: '12px' }}>
                            <div style={{ color: 'var(--text-title)' }}>{r.uploaded_by}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {new Date(r.uploaded_at).toLocaleDateString('id-ID')}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MONITORING MATRIX */}
        {activeTab === 'matrix' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Compliance KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="role-live-summary">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kepatuhan Terverifikasi</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--status-good-text)' }}>
                    {matrixSummary.pct}%
                  </strong>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {matrixSummary.verified}/{matrixSummary.total}
                  </span>
                </div>
                <div className="role-progress-track">
                  <div className="role-progress-fill" style={{ width: `${matrixSummary.pct}%` }} />
                </div>
              </div>

              <div className="role-live-summary">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menunggu Pengesahan</span>
                <strong style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--status-alert-text)' }}>
                  {matrixSummary.pending}
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Klik sel kuning untuk buka antrean</span>
              </div>

              <div className="role-live-summary">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dikembalikan / Revisi</span>
                <strong style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--status-danger-text)' }}>
                  {matrixSummary.revision}
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menunggu perbaikan PIC cabang</span>
              </div>
            </div>

            {isLoading ? (
              <div className="gov-skeleton-stack">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="gov-skeleton-row" />
                ))}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="card-table data-table">
                  <thead>
                    <tr>
                      <th scope="col">Cabang Pelabuhan</th>
                      <th scope="col">Wilayah</th>
                      {matrixData[0]?.departments?.map((d: MatrixDepartmentStatus) => (
                        <th scope="col" key={d.department_id} style={{ textAlign: 'center' }}>
                          {d.department_code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.map((row: MatrixBranchRow) => (
                      <tr key={row.branch_id}>
                        <td data-label="Cabang Pelabuhan" style={{ fontWeight: 700, color: 'var(--text-title)' }}>
                          {row.branch_name}
                        </td>
                        <td data-label="Wilayah" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {row.region}
                        </td>
                        {row.departments.map((d: MatrixDepartmentStatus) => {
                          const isPendingCell = d.status === 'pending_verification';
                          return (
                            <td key={d.department_id} data-label={d.department_code} style={{ textAlign: 'center' }}>
                              {isPendingCell ? (
                                <button
                                  type="button"
                                  onClick={() => handleMatrixCellClick(row.branch_id, d.department_id, d.status)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                  }}
                                  title={`Buka antrean verifikasi ${row.branch_name} — ${d.department_code}`}
                                >
                                  <StatusBadge type="verification" verificationStatus={d.status} />
                                </button>
                              ) : (
                                <StatusBadge type="verification" verificationStatus={d.status} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bulk Action Bar when >= 1 rows selected */}
      {activeTab === 'queue' && selectedRecordIds.length > 0 && (
        <div className="gov-sticky-bulk-bar" role="region" aria-label="Aksi verifikasi massal">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-blue" style={{ fontFamily: 'var(--font-mono)' }}>
              {selectedRecordIds.length} terpilih
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              dari {pendingRecords.length} antrean aktif
            </span>
            <button
              type="button"
              onClick={() => setSelectedRecordIds([])}
              className="pwd-action-chip"
            >
              Bersihkan
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setRevisionModalOpen(true)}
              disabled={!canVerify || isSubmitting}
              className="btn btn-warning btn-sm"
            >
              <AlertTriangle size={14} />
              <span>Minta Revisi ({selectedRecordIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={!canVerify || isSubmitting}
              className="btn btn-success btn-sm"
            >
              <CheckCircle2 size={14} />
              <span>Sahkan &amp; Publikasikan ({selectedRecordIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Revision Modal Dialog */}
      {revisionModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setRevisionModalOpen(false)}>
          <div
            ref={revisionDialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Minta Revisi Data Kinerja"
            tabIndex={-1}
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Minta Revisi Data Kinerja</h3>
              <button
                type="button"
                aria-label="Tutup dialog revisi"
                onClick={() => setRevisionModalOpen(false)}
                className="admin-close-btn"
              >
                <X size={16} />
              </button>
            </div>
            <form method="post" onSubmit={handleRequestRevision}>
              <div className="modal-body">
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                  Anda akan mengembalikan <strong>{selectedRecordIds.length}</strong> indikator ke
                  status <strong>&ldquo;Perlu Revisi&rdquo;</strong>. Masukkan catatan perbaikan
                  yang wajib ditindaklanjuti oleh PIC cabang:
                </p>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Contoh: Realisasi volume petikemas perlu dikonfirmasi ulang dengan manifest ekspor di terminal curah..."
                  required
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setRevisionModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!revisionNotes.trim() || isSubmitting}
                  className="btn btn-warning btn-sm"
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim Catatan Revisi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
