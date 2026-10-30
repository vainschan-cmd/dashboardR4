'use client';

import React from 'react';
import {
  X,
  Target,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Info,
  Clock,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { MonthlyRecord } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface DetailDrilldownModalProps {
  record: MonthlyRecord | null;
  onClose: () => void;
  allRecords: MonthlyRecord[];
}

export default function DetailDrilldownModal({
  record,
  onClose,
  allRecords,
}: DetailDrilldownModalProps) {
  if (!record) return null;

  // History for this indicator and branch
  const history = allRecords
    .filter(r => r.branch_id === record.branch_id && r.indicator_id === record.indicator_id)
    .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year))
    .slice(-6);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--blue-soft)',
                color: 'var(--blue-primary)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                {record.indicator_code || record.indicator_id}
              </span>
              <StatusBadge type="traffic_light" color={record.status_color} />
              <StatusBadge type="verification" verificationStatus={record.verification_status} />
            </div>
            <h3 className="modal-title" style={{ marginTop: '6px' }}>
              {record.indicator_name || record.indicator_id}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Target & Realization Highlight */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-lg)',
            padding: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase' }}>Target Rencana</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy-900)', marginTop: '4px' }}>
                {record.target.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{record.unit}</div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase' }}>Realisasi Aktual</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                {record.realization.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{record.unit}</div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase' }}>Pencapaian (%)</div>
              <div style={{
                fontSize: '20px',
                fontWeight: 800,
                marginTop: '4px',
                color: record.status_color === 'green' ? '#059669' : record.status_color === 'yellow' ? '#d97706' : '#dc2626'
              }}>
                {record.achievement_pct}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {record.direction === 'higher_is_better' ? 'Higher is Better' : 'Lower is Better'}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} color="#64748b" />
              <span>Cabang: <strong>{record.branch_name || record.branch_code}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="#64748b" />
              <span>Departemen: <strong>{record.department_name}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#64748b" />
              <span>Periode: <strong>Bulan {record.month} / {record.year}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="#64748b" />
              <span>Pengunggah: <strong>{record.uploaded_by}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#64748b" />
              <span>Waktu Unggah: <strong>{new Date(record.uploaded_at).toLocaleDateString('id-ID')}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#64748b" />
              <span>Verifikator: <strong>{record.verified_by || 'Belum Disahkan'}</strong></span>
            </div>
          </div>

          {/* Revision Notes if any */}
          {record.revision_notes && (
            <div className="alert-box alert-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Catatan Revisi dari Verifikator:</strong>
                <p style={{ marginTop: '4px' }}>{record.revision_notes}</p>
              </div>
            </div>
          )}

          {/* Historical trend for this metric */}
          {history.length > 1 && (
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '8px' }}>
                Histori Perkembangan 6 Periode Terakhir:
              </h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Periode</th>
                      <th style={{ textAlign: 'right' }}>Target</th>
                      <th style={{ textAlign: 'right' }}>Realisasi</th>
                      <th style={{ textAlign: 'right' }}>Capaian</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{h.month}/{h.year}</td>
                        <td style={{ textAlign: 'right' }}>{h.target.toLocaleString('id-ID')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{h.realization.toLocaleString('id-ID')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{h.achievement_pct}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusBadge type="traffic_light" color={h.status_color} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
