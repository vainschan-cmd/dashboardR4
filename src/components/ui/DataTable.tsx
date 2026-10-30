'use client';

import React, { useState } from 'react';
import { Search, ArrowUpDown, ChevronRight, Eye } from 'lucide-react';
import { MonthlyRecord } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface DataTableProps {
  records: MonthlyRecord[];
  onSelectRecord?: (record: MonthlyRecord) => void;
  showBranchColumn?: boolean;
}

export default function DataTable({
  records,
  onSelectRecord,
  showBranchColumn = true,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof MonthlyRecord>('indicator_code');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: keyof MonthlyRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = records.filter((r) => {
    const text = `${r.indicator_code || ''} ${r.indicator_name || ''} ${r.branch_name || ''} ${r.department_name || ''} ${r.notes || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  filtered.sort((a, b) => {
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            placeholder="Cari indikator, cabang, kode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Menampilkan <strong>{filtered.length}</strong> dari {records.length} indikator
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('indicator_code')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Kode</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('indicator_name')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Nama Indikator</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              {showBranchColumn && <th>Cabang</th>}
              <th style={{ textAlign: 'right' }}>Target</th>
              <th style={{ textAlign: 'right' }}>Realisasi</th>
              <th style={{ textAlign: 'center' }}>Satuan</th>
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('achievement_pct')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span>Capaian (%)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th style={{ textAlign: 'center' }}>Status KPI</th>
              <th style={{ textAlign: 'center' }}>Verifikasi</th>
              <th style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showBranchColumn ? 10 : 9} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  Tidak ada data indikator yang sesuai dengan filter atau kata kunci pencarian.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                    {r.indicator_code || r.indicator_id}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
                    {r.indicator_name || r.indicator_id}
                  </td>
                  {showBranchColumn && (
                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                      {r.branch_name || r.branch_code}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {r.target.toLocaleString('id-ID')}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {r.realization.toLocaleString('id-ID')}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    {r.unit}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    <span style={{
                      color: r.status_color === 'green' ? '#059669' : r.status_color === 'yellow' ? '#d97706' : '#dc2626'
                    }}>
                      {r.achievement_pct}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge type="traffic_light" color={r.status_color} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge type="verification" verificationStatus={r.verification_status} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {onSelectRecord && (
                      <button
                        onClick={() => onSelectRecord(r)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', height: '28px' }}
                        title="Lihat Detail & Audit"
                      >
                        <Eye size={13} />
                        <span>Detail</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
