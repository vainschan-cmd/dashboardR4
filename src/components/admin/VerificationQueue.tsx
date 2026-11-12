'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  Send,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { MonthlyRecord, UserRole, VerificationStatus } from '@/lib/types';
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
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecordIds(pendingRecords.map(r => r.id));
    } else {
      setSelectedRecordIds([]);
    }
  };

  const handleToggleRecord = (id: string) => {
    setSelectedRecordIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
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
          userRole
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memverifikasi data.');
      }
      setMessage({ type: 'success', text: `Sukses! ${selectedRecordIds.length} indikator disahkan menjadi data resmi dashboard.` });
      setSelectedRecordIds([]);
      fetchVerificationData();
      onVerificationDone();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memverifikasi data.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
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
          revisionNotes: revisionNotes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengirim permintaan revisi.');
      }
      setMessage({ type: 'success', text: `Permintaan revisi berhasil dikirimkan ke PIC pengunggah.` });
      setRevisionModalOpen(false);
      setRevisionNotes('');
      setSelectedRecordIds([]);
      fetchVerificationData();
      onVerificationDone();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengirim permintaan revisi.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canVerify = ['super_admin', 'admin_regional'].includes(userRole);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <FileCheck size={20} color="#38bdf8" />
              <span>Pusat Verifikasi & Tata Kelola Validasi Data</span>
            </h2>
            <p className="card-subtitle">
              Pemeriksaan akurasi data laporan bulanan seluruh cabang oleh Admin Regional sebelum dipublikasikan ke Executive Dashboard
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchVerificationData}
              className="btn btn-secondary btn-sm"
              title="Perbarui Data Antrean"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('queue')}
            className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          >
            <Clock size={16} />
            <span>Antrean Menunggu Verifikasi ({pendingRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Matriks Monitoring Pengumpulan Data Cabang</span>
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
                  <strong>Mode Akses Terbatas:</strong> Anda saat ini login dengan role <strong>{userRole}</strong>. Tombol pengesahan hanya aktif untuk <strong>Admin Regional</strong> atau <strong>Super Admin</strong>.
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Terpilih: <strong style={{ color: 'var(--accent-blue-text)' }}>{selectedRecordIds.length}</strong> dari {pendingRecords.length} indikator
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setRevisionModalOpen(true)}
                  disabled={selectedRecordIds.length === 0 || !canVerify || isSubmitting}
                  className="btn btn-warning btn-sm"
                >
                  <AlertTriangle size={14} />
                  <span>Minta Revisi ({selectedRecordIds.length})</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={selectedRecordIds.length === 0 || !canVerify || isSubmitting}
                  className="btn btn-success btn-sm"
                >
                  <CheckCircle2 size={14} />
                  <span>Sahkan & Publikasikan ({selectedRecordIds.length})</span>
                </button>
              </div>
            </div>

            {/* Pending List Table */}
            {isLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data antrean...</div>
            ) : pendingRecords.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-inner)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-subtle)'
              }}>
                <CheckCircle2 size={40} color="#34d399" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>Tidak Ada Antrean Verifikasi Baru</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Seluruh data kinerja periode {selectedMonth}/{selectedYear} telah terverifikasi resmi oleh BOD Regional 4.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="card-table data-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.length === pendingRecords.length && pendingRecords.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col">Cabang</th>
                      <th scope="col">Departemen</th>
                      <th scope="col">Kode</th>
                      <th scope="col">Nama Indikator</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Target</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Realisasi</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Satuan</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Capaian</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Status KPI</th>
                      <th scope="col">Pengunggah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRecords.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Pilih" style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            aria-label={`Pilih rekaman ${r.indicator_name || r.id}`}
                            checked={selectedRecordIds.includes(r.id)}
                            onChange={() => handleToggleRecord(r.id)}
                          />
                        </td>
                        <td data-label="Cabang" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.branch_name || r.branch_code}</td>
                        <td data-label="Departemen" style={{ color: 'var(--text-secondary)' }}>{r.department_name || r.department_id}</td>
                        <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-blue-text)' }}>{r.indicator_code}</td>
                        <td data-label="Nama Indikator" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.indicator_name}</td>
                        <td data-label="Target" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.target.toLocaleString('id-ID')}</td>
                        <td data-label="Realisasi" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-title)' }}>{r.realization.toLocaleString('id-ID')}</td>
                        <td data-label="Satuan" style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>{r.unit}</td>
                        <td data-label="Capaian" style={{ textAlign: 'right', fontWeight: 700 }}>
                          <span style={{ color: r.status_color === 'green' ? 'var(--status-good-text)' : r.status_color === 'yellow' ? 'var(--status-alert-text)' : 'var(--status-danger-text)' }}>
                            {r.achievement_pct}%
                          </span>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MONITORING MATRIX */}
        {activeTab === 'matrix' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="alert-box alert-info">
              <Layers size={18} />
              <div>
                <strong>Matriks Status Pengumpulan Data:</strong> Memantau kelengkapan laporan per cabang dan per departemen untuk periode aktif ({selectedMonth}/{selectedYear}).
              </div>
            </div>

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
                      <td data-label="Cabang Pelabuhan" style={{ fontWeight: 700, color: 'var(--text-title)' }}>{row.branch_name}</td>
                      <td data-label="Wilayah" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.region}</td>
                      {row.departments.map((d: MatrixDepartmentStatus) => (
                        <td key={d.department_id} data-label={d.department_id} style={{ textAlign: 'center' }}>
                          <StatusBadge type="verification" verificationStatus={d.status} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Revision Modal Dialog */}
      {revisionModalOpen && (
        <div className="modal-overlay" onClick={() => setRevisionModalOpen(false)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Minta Revisi Data Kinerja"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Minta Revisi Data Kinerja</h3>
              <button
                type="button"
                aria-label="Tutup dialog revisi"
                onClick={() => setRevisionModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Anda akan mengembalikan <strong>{selectedRecordIds.length}</strong> indikator ke status <strong>&ldquo;Perlu Revisi&rdquo;</strong>. Masukkan alasan atau catatan perbaikan yang wajib ditindaklanjuti oleh PIC cabang:
              </p>
              <textarea
                className="form-textarea"
                rows={4}
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Contoh: Realisasi volume petikemas perlu dikonfirmasi ulang dengan manifest ekspor di terminal curah..."
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setRevisionModalOpen(false)}
                className="btn btn-secondary btn-sm"
              >
                Batal
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={!revisionNotes.trim() || isSubmitting}
                className="btn btn-warning btn-sm"
              >
                <Send size={14} />
                <span>Kirim Catatan Revisi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
