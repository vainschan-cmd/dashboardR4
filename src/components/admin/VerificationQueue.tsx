'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  Send,
  MessageSquare,
  Search,
  RefreshCw,
  Layers,
  Building2,
  UserCheck
} from 'lucide-react';
import { MonthlyRecord, UserRole } from '@/lib/types';
import StatusBadge from '../ui/StatusBadge';

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
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchVerificationData = async () => {
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
  };

  useEffect(() => {
    fetchVerificationData();
  }, [selectedMonth, selectedYear]);

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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
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
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <FileCheck size={20} color="var(--blue-primary)" />
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
              <div style={{ fontSize: '13px', color: '#475569' }}>
                Terpilih: <strong>{selectedRecordIds.length}</strong> dari {pendingRecords.length} indikator
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
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Memuat data antrean...</div>
            ) : pendingRecords.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed #cbd5e1'
              }}>
                <CheckCircle2 size={40} color="#059669" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy-800)' }}>Tidak Ada Antrean Verifikasi</h4>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                  Seluruh data kinerja periode {selectedMonth}/{selectedYear} telah terverifikasi atau belum diunggah oleh cabang.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.length === pendingRecords.length && pendingRecords.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Cabang</th>
                      <th>Departemen</th>
                      <th>Kode</th>
                      <th>Nama Indikator</th>
                      <th style={{ textAlign: 'right' }}>Target</th>
                      <th style={{ textAlign: 'right' }}>Realisasi</th>
                      <th style={{ textAlign: 'center' }}>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Capaian</th>
                      <th style={{ textAlign: 'center' }}>Status KPI</th>
                      <th>Pengunggah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRecords.map((r) => (
                      <tr key={r.id}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.includes(r.id)}
                            onChange={() => handleToggleRecord(r.id)}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.branch_name || r.branch_code}</td>
                        <td>{r.department_name || r.department_id}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.indicator_code}</td>
                        <td style={{ fontWeight: 600 }}>{r.indicator_name}</td>
                        <td style={{ textAlign: 'right' }}>{r.target.toLocaleString('id-ID')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.realization.toLocaleString('id-ID')}</td>
                        <td style={{ textAlign: 'center', fontSize: '12px' }}>{r.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          <span style={{ color: r.status_color === 'green' ? '#059669' : r.status_color === 'yellow' ? '#d97706' : '#dc2626' }}>
                            {r.achievement_pct}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusBadge type="traffic_light" color={r.status_color} />
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{r.uploaded_by}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cabang Pelabuhan</th>
                    <th>Wilayah</th>
                    {matrixData[0]?.departments?.map((d: any) => (
                      <th key={d.department_id} style={{ textAlign: 'center' }}>
                        {d.department_code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map((row: any) => (
                    <tr key={row.branch_id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{row.branch_name}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{row.region}</td>
                      {row.departments.map((d: any) => (
                        <td key={d.department_id} style={{ textAlign: 'center' }}>
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
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Minta Revisi Data Kinerja</h3>
              <button onClick={() => setRevisionModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                Anda akan mengembalikan <strong>{selectedRecordIds.length}</strong> indikator ke status <strong>'Perlu Revisi'</strong>. Masukkan alasan atau catatan perbaikan yang wajib ditindaklanjuti oleh PIC cabang:
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
