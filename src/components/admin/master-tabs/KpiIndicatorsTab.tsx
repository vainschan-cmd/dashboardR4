'use client';

import React, { useState } from 'react';
import { Department, KPIIndicator } from '@/lib/types';
import { History, Plus, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface KpiIndicatorsTabProps {
  indicators: KPIIndicator[];
  departments: Department[];
}

interface TargetVersionItem {
  id: string;
  indicator_id: string;
  version: number;
  target_value: number;
  effective_from: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export default function KpiIndicatorsTab({ indicators, departments }: KpiIndicatorsTabProps) {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedIndicator, setSelectedIndicator] = useState<KPIIndicator | null>(null);
  const [versionHistory, setVersionHistory] = useState<TargetVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTargetValue, setNewTargetValue] = useState('');
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionMsg, setVersionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredIndicators = indicators.filter(
    (i) => selectedDeptFilter === 'ALL' || i.department_id === selectedDeptFilter
  );

  const openVersionModal = async (ind: KPIIndicator) => {
    setSelectedIndicator(ind);
    setShowAddForm(false);
    setVersionMsg(null);
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/master/target-versions?indicator_id=${encodeURIComponent(ind.id)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setVersionHistory(json.data.versions || []);
      } else {
        setVersionHistory([]);
      }
    } catch {
      setVersionHistory([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndicator) return;
    setSavingVersion(true);
    setVersionMsg(null);
    try {
      const res = await fetch('/api/master/target-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicator_id: selectedIndicator.id,
          target_value: Number(newTargetValue),
          effective_from: newEffectiveFrom,
          notes: newNotes,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setVersionMsg({ type: 'success', text: `Versi target ${json.data.version} berhasil disimpan.` });
        setNewTargetValue('');
        setNewEffectiveFrom('');
        setNewNotes('');
        setShowAddForm(false);
        // Refresh versions
        const refRes = await fetch(`/api/master/target-versions?indicator_id=${encodeURIComponent(selectedIndicator.id)}`);
        const refJson = await refRes.json();
        if (refJson.ok && refJson.data) {
          setVersionHistory(refJson.data.versions || []);
        }
      } else {
        setVersionMsg({ type: 'error', text: json.message || 'Gagal menyimpan versi target.' });
      }
    } catch {
      setVersionMsg({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setSavingVersion(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter Departemen:</span>
          <select
            className="filter-select"
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '220px' }}
          >
            <option value="ALL">Semua Departemen (Semua Indikator)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col">Kode</th>
              <th scope="col">Nama Indikator</th>
              <th scope="col">Departemen</th>
              <th scope="col">Kategori</th>
              <th scope="col" style={{ textAlign: 'center' }}>Satuan</th>
              <th scope="col" style={{ textAlign: 'center' }}>Arah Target</th>
              <th scope="col" style={{ textAlign: 'right' }}>Target Standar</th>
              <th scope="col" style={{ textAlign: 'center' }}>KPI Utama</th>
              <th scope="col" style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredIndicators.map((ind) => (
              <tr key={ind.id}>
                <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-blue-text)' }}>
                  {ind.code}
                </td>
                <td data-label="Nama Indikator" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                  <div>{ind.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {ind.formula_desc || 'Target operasional tahunan'}
                  </div>
                </td>
                <td data-label="Departemen">
                  <span className="badge badge-neutral">
                    {departments.find((d) => d.id === ind.department_id)?.code || ind.department_id}
                  </span>
                </td>
                <td data-label="Kategori" style={{ color: 'var(--text-secondary)' }}>{ind.category}</td>
                <td data-label="Satuan" style={{ textAlign: 'center' }}>{ind.unit}</td>
                <td data-label="Arah Target" style={{ textAlign: 'center' }}>
                  <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                    {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                  </span>
                </td>
                <td data-label="Target Standar" className="num-cell" style={{ fontWeight: 700, color: 'var(--text-title)' }}>
                  {ind.default_target.toLocaleString('id-ID')}
                </td>
                <td data-label="KPI Utama" style={{ textAlign: 'center' }}>
                  {ind.is_core_kpi ? (
                    <span className="badge badge-green">KPI Utama</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
                <td data-label="Aksi" style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => openVersionModal(ind)}
                    style={{ fontSize: '12px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Kelola Versi Target / RKAP"
                  >
                    <History size={13} aria-hidden="true" />
                    <span>Versi Target</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Target Versioning Modal */}
      {selectedIndicator && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 id="version-modal-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Riwayat Versi Target: {selectedIndicator.name} ({selectedIndicator.code})
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Target default standar: {selectedIndicator.default_target.toLocaleString('id-ID')} {selectedIndicator.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndicator(null)}
                className="btn btn-secondary"
                style={{ padding: '6px' }}
                aria-label="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {versionMsg && (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: versionMsg.type === 'success' ? 'var(--status-good-bg)' : 'var(--status-danger-bg)',
                    color: versionMsg.type === 'success' ? 'var(--status-good-text)' : 'var(--status-danger-text)',
                    border: `1px solid ${versionMsg.type === 'success' ? 'var(--status-good-border)' : 'var(--status-danger-border)'}`,
                    fontSize: '12px',
                  }}
                >
                  {versionMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{versionMsg.text}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                  Versi Target Tercatat ({versionHistory.length})
                </span>
                {!showAddForm && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAddForm(true)}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} />
                    <span>Tambah Versi Baru</span>
                  </button>
                )}
              </div>

              {showAddForm && (
                <form
                  method="post"
                  onSubmit={handleSaveVersion}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-title)' }}>
                    Form Versi Target / Revisi RKAP Baru
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Nilai Target Baru ({selectedIndicator.unit}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        className="form-input"
                        placeholder="Contoh: 1050000"
                        value={newTargetValue}
                        onChange={(e) => setNewTargetValue(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Berlaku Mulai Tanggal *
                      </label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={newEffectiveFrom}
                        onChange={(e) => setNewEffectiveFrom(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Catatan / Dasar Revisi (Opsional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Penyesuaian RKAP Perubahan 2026"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowAddForm(false)}
                      disabled={savingVersion}
                      style={{ fontSize: '12px' }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingVersion}
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {savingVersion && <Loader2 size={13} className="animate-spin" />}
                      <span>Simpan Versi</span>
                    </button>
                  </div>
                </form>
              )}

              {loadingVersions ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <div>Memuat riwayat versi target...</div>
                </div>
              ) : versionHistory.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Belum ada revisi target tersimpan. Indikator masih menggunakan nilai target standar.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="card-table data-table">
                    <thead>
                      <tr>
                        <th scope="col">Versi</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Target</th>
                        <th scope="col">Berlaku Mulai</th>
                        <th scope="col">Catatan</th>
                        <th scope="col">Pencatat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versionHistory.map((v) => (
                        <tr key={v.id}>
                          <td data-label="Versi">
                            <span className="badge badge-neutral">v{v.version}</span>
                          </td>
                          <td data-label="Target" className="num-cell" style={{ fontWeight: 700, color: 'var(--text-title)' }}>
                            {v.target_value.toLocaleString('id-ID')} {selectedIndicator.unit}
                          </td>
                          <td data-label="Berlaku Mulai">{v.effective_from}</td>
                          <td data-label="Catatan" style={{ color: 'var(--text-secondary)' }}>{v.notes || '-'}</td>
                          <td data-label="Pencatat" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{v.created_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedIndicator(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
